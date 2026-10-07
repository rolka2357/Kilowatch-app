/*
 * Backend-driven KiloSave reminders.
 *
 * Scans owner-scoped KiloSave settings after the configured local reminder
 * hour, atomically claims one delivery per target/day, writes a deterministic
 * in-app alert, and sends FCM to the home owner. A short lease makes a crashed
 * worker recoverable while the daily delivery marker prevents duplicates.
 */
const admin = require("firebase-admin");

const config = require("./config");
const {
  buildReminderCopy,
  getReminderTarget,
} = require("./kilosaveReminderLogic");
const { sendFcmToHome, resolveHomeName } = require("./notify");
const { partsInZone, usageLimitFireKey } = require("./time");

const db = admin.database();
const CLAIM_LEASE_MS = 10 * 60 * 1000;
const RETRY_DELAY_MS = 30 * 60 * 1000;
/** Demo triggers already handed off to deliver (avoids re-entry on unrelated kilosave writes). */
const handledDemoTriggers = new Set();

function isActiveDemoTrigger(trigger, nowMs = Date.now()) {
  if (!trigger?.weekKey || !trigger?.createdAt) return false;
  const ageMs = nowMs - Number(trigger.createdAt || 0);
  return ageMs >= 0 && ageMs <= 60 * 60 * 1000;
}

function demoTriggerId(ownerUid, trigger) {
  return `${ownerUid}:${trigger.weekKey}:${trigger.createdAt}`;
}

/**
 * Deliver one admin Feature Demo reminder immediately.
 * Uses a demo-scoped day key so it never blocks the real daily reminder claim.
 */
async function deliverDemoReminder(ownerUid, settings, trigger, nowMs = Date.now()) {
  const target = {
    kind: trigger.kind === "due" ? "due" : "missed",
    week: {
      weekKey: String(trigger.weekKey),
      label: String(trigger.weekLabel || "Demo week"),
    },
  };
  const dayKey = `demo_${String(trigger.weekKey)}`;
  const result = await deliverReminder(
    ownerUid,
    settings || {},
    target,
    dayKey,
    nowMs
  );
  if (Number(result?.sent || 0) > 0) {
    await db.ref(`kilosave/${ownerUid}/adminDemo/reminderTrigger`).remove();
  }
  return result;
}

async function maybeHandleDemoTrigger(ownerUid, value, nowMs = Date.now()) {
  const trigger = value?.adminDemo?.reminderTrigger;
  if (!isActiveDemoTrigger(trigger, nowMs)) return { handled: false };
  const id = demoTriggerId(ownerUid, trigger);
  if (handledDemoTriggers.has(id)) return { handled: false, duplicate: true };
  handledDemoTriggers.add(id);
  try {
    const result = await deliverDemoReminder(
      ownerUid,
      value?.settings || {},
      trigger,
      nowMs
    );
    return { handled: true, sent: Number(result?.sent || 0) };
  } catch (error) {
    // Allow the 5-minute poll (or a later write) to retry.
    handledDemoTriggers.delete(id);
    throw error;
  }
}

function reminderStatePath(ownerUid, dayKey) {
  return `kilosave/${ownerUid}/reminders/backend/${dayKey}`;
}

function alertKey(dayKey) {
  return `kilosave_backend_${dayKey}`;
}

async function claimDelivery(ownerUid, dayKey, target, nowMs) {
  const stateRef = db.ref(reminderStatePath(ownerUid, dayKey));
  const result = await stateRef.transaction(
    (current) => {
      if (
        current?.status === "sent" &&
        current?.weekKey === target.week.weekKey
      ) {
        return;
      }
      if (
        current?.status === "sending" &&
        current?.weekKey === target.week.weekKey &&
        Number(current?.leaseUntil || 0) > nowMs
      ) {
        return;
      }
      if (
        current?.status === "failed" &&
        current?.weekKey === target.week.weekKey &&
        Number(current?.nextAttemptAt || 0) > nowMs
      ) {
        return;
      }
      return {
        status: "sending",
        kind: target.kind,
        weekKey: target.week.weekKey,
        claimedAt: nowMs,
        leaseUntil: nowMs + CLAIM_LEASE_MS,
      };
    },
    undefined,
    false
  );
  return result.committed ? stateRef : null;
}

async function deliverReminder(ownerUid, settings, target, dayKey, nowMs) {
  const stateRef = await claimDelivery(
    ownerUid,
    dayKey,
    target,
    nowMs
  );
  if (!stateRef) return { skipped: true };

  const weeklyGoal =
    Number(settings?.weeklyGoal || 0) ||
    Number(settings?.monthlyGoal || 0) / 4;
  const copy = buildReminderCopy(target, weeklyGoal);

  try {
    const homeName = (await resolveHomeName(ownerUid)) || "Home";
    const title = `${copy.title} · ${homeName}`;
    const body = `${homeName} — ${copy.body}`;
    const alertId = alertKey(dayKey);

    // A deterministic id prevents retry attempts from creating duplicate inbox rows.
    await db.ref(`homes/${ownerUid}/alerts/${alertId}`).set({
      type: "kilosave",
      kind: target.kind,
      weekKey: target.week.weekKey,
      weekLabel: target.week.label,
      amount: weeklyGoal,
      homeUid: ownerUid,
      homeName,
      title,
      body,
      alertId,
      source: "backend",
      createdAt: nowMs,
    });

    // KiloSave is owner-private. ownerOnly resolves homes/{homeId}/meta.ownerUid
    // so reminders follow the current owner after a transfer (path key stays put).
    const delivery = await sendFcmToHome(
      ownerUid,
      {
        title,
        body,
        data: {
          type: "kilosave",
          kind: target.kind,
          weekKey: target.week.weekKey,
          amount: weeklyGoal,
          homeUid: ownerUid,
          homeName,
          alertId,
        },
      },
      { ownerOnly: true }
    );

    if (!(delivery?.sent > 0)) {
      await stateRef.set({
        status: "failed",
        kind: target.kind,
        weekKey: target.week.weekKey,
        failedAt: Date.now(),
        nextAttemptAt: Date.now() + RETRY_DELAY_MS,
        reason: "no-delivered-fcm-token",
      });
      return { sent: 0 };
    }

    await stateRef.set({
      status: "sent",
      kind: target.kind,
      weekKey: target.week.weekKey,
      sentAt: Date.now(),
      deliveredTokens: delivery.sent,
    });
    console.log(
      `  kilosave ${ownerUid}/${target.week.weekKey} kind=${target.kind} fcm=${delivery.sent}`
    );
    return { sent: delivery.sent };
  } catch (error) {
    await stateRef
      .set({
        status: "failed",
        kind: target.kind,
        weekKey: target.week.weekKey,
        failedAt: Date.now(),
        nextAttemptAt: Date.now() + RETRY_DELAY_MS,
        reason: String(error?.message || error).slice(0, 200),
      })
      .catch(() => undefined);
    throw error;
  }
}

async function runKilosaveReminders(now = new Date()) {
  const parts = partsInZone(now);
  const normalWindowOpen = parts.hour >= config.kilosaveReminderHour;

  const rootSnap = await db.ref("kilosave").get();
  const owners = rootSnap.val() || {};
  const dayKey = usageLimitFireKey(now);
  let checked = 0;
  let sent = 0;

  for (const [ownerUid, value] of Object.entries(owners)) {
    const settings = value?.settings || {};
    const demoTrigger = value?.adminDemo?.reminderTrigger;
    const demoActive = isActiveDemoTrigger(demoTrigger, now.getTime());

    // Demo triggers: prefer the live watcher; poll is a fallback if backend
    // was down when admin clicked, or the instant send had no FCM token yet.
    if (demoActive) {
      checked += 1;
      try {
        const result = await deliverDemoReminder(
          ownerUid,
          settings,
          demoTrigger,
          now.getTime()
        );
        sent += Number(result?.sent || 0);
        if (Number(result?.sent || 0) > 0) {
          handledDemoTriggers.add(demoTriggerId(ownerUid, demoTrigger));
        }
      } catch (error) {
        console.warn(`KiloSave demo reminder failed ${ownerUid}:`, error.message);
      }
      continue;
    }

    if (!normalWindowOpen) continue;
    const target = getReminderTarget(settings, value?.weeks || {}, now);
    if (!target) continue;
    checked += 1;
    try {
      const result = await deliverReminder(
        ownerUid,
        settings,
        target,
        dayKey,
        now.getTime()
      );
      sent += Number(result?.sent || 0);
    } catch (error) {
      console.warn(`KiloSave reminder failed ${ownerUid}:`, error.message);
    }
  }

  return { checked, sent };
}

/**
 * Instant path for admin Feature Demo: send as soon as reminderTrigger is written.
 * Real mid-week / missed-week reminders still use the periodic scan only.
 */
function watchKilosaveDemoReminderTriggers() {
  const root = db.ref("kilosave");

  const onOwnerNode = async (uidSnap) => {
    const ownerUid = uidSnap.key;
    try {
      const result = await maybeHandleDemoTrigger(ownerUid, uidSnap.val() || {});
      if (result?.handled && result.sent > 0) {
        console.log(
          `  kilosave demo instant ${ownerUid} fcm=${result.sent}`
        );
      }
    } catch (error) {
      console.warn(
        `KiloSave demo instant reminder failed ${ownerUid}:`,
        error.message
      );
    }
  };

  root.on(
    "child_added",
    onOwnerNode,
    (error) =>
      console.warn("kilosave demo child_added error:", error.message)
  );
  root.on(
    "child_changed",
    onOwnerNode,
    (error) =>
      console.warn("kilosave demo child_changed error:", error.message)
  );

  console.log(
    "Listening for KiloSave adminDemo/reminderTrigger writes (instant demo FCM)."
  );
}

function startKilosaveReminderScheduler() {
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      await runKilosaveReminders();
    } catch (error) {
      console.warn("KiloSave reminder scan failed:", error.message);
    } finally {
      running = false;
    }
  };

  watchKilosaveDemoReminderTriggers();
  run();
  const timer = setInterval(run, config.kilosaveCheckIntervalMs);
  timer.unref?.();
  console.log(
    `KiloSave backend reminders enabled at/after ${String(
      config.kilosaveReminderHour
    ).padStart(2, "0")}:00 (${config.timezone}); checking every ${
      config.kilosaveCheckIntervalMs / 60000
    }m`
  );
}

module.exports = {
  deliverReminder,
  deliverDemoReminder,
  runKilosaveReminders,
  startKilosaveReminderScheduler,
  watchKilosaveDemoReminderTriggers,
};
