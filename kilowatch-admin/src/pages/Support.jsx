/**
 * Customer support tools: password reset, pairing lookup, and demo data.
 * Seeds/clears dummy plugs and tips-test data under an existing user, and
 * lists plug ↔ user pairing from devices/{uid}/{plugId}.
 */
import { useEffect, useMemo, useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { get, onValue, ref, remove, update } from "firebase/database";

import {
  buildBillingWeeks,
  resolveDemoPeriodStart,
  resolveUserBillingDay,
  withPreservedBillingDay,
} from "../demoActions";
import { auth, database } from "../firebase";
import { paths } from "../paths";
import { userFacingError } from "../userFacingError";

// Dummy node ids (must stay distinct from real plugs)
const DUMMY_DEVICE = "dummy_plug_001";
const DUMMY_ROOM = "dummy_room_001";
const DUMMY_APPLIANCE = "dummy_appliance_001";
/** Separate nodes for tips eligibility testing (backdated + richer history). */
const DUMMY_TIPS_DEVICE = "dummy_tips_plug_001";
const DUMMY_TIPS_ROOM = "dummy_tips_room_001";
const DUMMY_TIPS_APPLIANCE = "dummy_tips_appliance_001";
const LEGACY_DUMMY_OWNER = "dummy_kilowatch_demo";
const LEGACY_DUMMY_NEWS = "dummy_news_001";
const TIPS_DUMMY_REGISTERED_DAYS_AGO = 10;
const TIPS_DUMMY_HISTORY_DAYS = 14;

// --- Local date / history-bucket helpers ---

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}`;
}

function getIsoWeekKey(date) {
  const target = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );
  const dayNumber = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNumber + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstDayNumber = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNumber + 3);
  const weekNumber =
    1 + Math.round((target - firstThursday) / (7 * 24 * 3600 * 1000));
  return `${target.getUTCFullYear()}-W${pad(weekNumber)}`;
}

function getBucketKeys(date = new Date()) {
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hour = pad(date.getHours());
  const dayKey = `${year}-${month}-${day}`;
  return {
    hourly: `${dayKey}-${hour}`,
    daily: dayKey,
    weekly: getIsoWeekKey(date),
    monthly: `${year}-${month}`,
    yearly: `${year}`,
  };
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatWhen(ts) {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function userLabel(uid, profile = {}) {
  const name = profile.fullName || profile.email || uid;
  const email = profile.email ? ` · ${profile.email}` : "";
  return `${name}${email}`;
}

export default function Support() {
  const [users, setUsers] = useState({});
  const [devicesTree, setDevicesTree] = useState({});
  const [resetEmail, setResetEmail] = useState("");
  const [resetBusy, setResetBusy] = useState(false);
  const [pairQuery, setPairQuery] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [dummyBusy, setDummyBusy] = useState(false);
  const [tipsDummyBusy, setTipsDummyBusy] = useState(false);
  const [dummyUid, setDummyUid] = useState("");
  const [tipsDummyUid, setTipsDummyUid] = useState("");

  useEffect(() => {
    // Live users + devices for selectors and pairing table
    const unsubs = [
      onValue(ref(database, paths.users()), (snap) =>
        setUsers(snap.val() || {})
      ),
      onValue(ref(database, paths.devicesRoot()), (snap) =>
        setDevicesTree(snap.val() || {})
      ),
    ];
    return () => unsubs.forEach((u) => u && u());
  }, []);

  const userOptions = useMemo(
    () =>
      Object.entries(users)
        .filter(([uid]) => uid !== LEGACY_DUMMY_OWNER)
        .map(([uid, profile]) => ({
          uid,
          label: userLabel(uid, profile || {}),
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [users]
  );

  const selectedUser = dummyUid ? users[dummyUid] : null;

  // Flatten all plugs with owner info for the pairing table
  const pairingRows = useMemo(() => {
    const list = [];
    Object.entries(devicesTree || {}).forEach(([ownerUid, devices]) => {
      Object.entries(devices || {}).forEach(([plugId, device]) => {
        const owner = users[ownerUid] || {};
        list.push({
          plugId,
          ownerUid,
          ownerName: owner.fullName || owner.email || "—",
          ownerEmail: owner.email || "",
          identifier: device?.identifier || null,
          online: Boolean(device?.online),
          pairedAt: device?.pairedAt || null,
        });
      });
    });
    return list.sort((a, b) => a.plugId.localeCompare(b.plugId));
  }, [devicesTree, users]);

  // Search plug ID / user / email / QR within pairing rows
  const pairMatches = useMemo(() => {
    const q = pairQuery.trim().toLowerCase();
    if (!q) return [];
    return pairingRows.filter(
      (row) =>
        row.plugId.toLowerCase().includes(q) ||
        row.ownerUid.toLowerCase().includes(q) ||
        String(row.ownerEmail || "").toLowerCase().includes(q) ||
        String(row.ownerName || "").toLowerCase().includes(q) ||
        String(row.identifier || "").toLowerCase().includes(q)
    );
  }, [pairingRows, pairQuery]);

  // Firebase Auth password-reset email
  async function onResetPassword(event) {
    event.preventDefault();
    const email = resetEmail.trim();
    if (!email) return;
    setResetBusy(true);
    setMessage("");
    setError("");
    try {
      await sendPasswordResetEmail(auth, email);
      setMessage(`Password reset email sent to ${email}.`);
    } catch (err) {
      setError(userFacingError(err, "Failed to send reset email."));
    } finally {
      setResetBusy(false);
    }
  }

  // Seed dummy_* room/plug/live/history (+ optional KiloSave) under selected user
  async function seedDummyData() {
    if (!dummyUid || !users[dummyUid]) {
      setError("Pick an existing user first.");
      return;
    }

    const who = userLabel(dummyUid, users[dummyUid]);
    if (
      !window.confirm(
        `Add dummy room, plug, live reading, history, and KiloSave sample under:\n\n${who}\n\nOnly dummy_* nodes are written. Clear removes those dummy nodes for this user.`
      )
    ) {
      return;
    }

    setDummyBusy(true);
    setMessage("");
    setError("");
    const now = Date.now();
    const today = new Date();

    try {
      const updates = {};

      updates[`${paths.roomsRoot()}/${dummyUid}/${DUMMY_ROOM}`] = {
        roomId: DUMMY_ROOM,
        name: "Demo Living Room",
        imageUri: null,
        createdAt: now,
        isDummy: true,
      };
      updates[`${paths.appliancesRoot()}/${dummyUid}/${DUMMY_APPLIANCE}`] = {
        applianceId: DUMMY_APPLIANCE,
        name: "Demo Smart Plug",
        deviceId: DUMMY_DEVICE,
        roomId: DUMMY_ROOM,
        createdAt: now,
        isDummy: true,
      };
      updates[`${paths.devicesRoot()}/${dummyUid}/${DUMMY_DEVICE}`] = {
        deviceId: DUMMY_DEVICE,
        homeId: null,
        identifier: "DUMMY-QR-001",
        productId: null,
        provider: "tuya",
        pairedAt: now,
        roomId: DUMMY_ROOM,
        applianceId: DUMMY_APPLIANCE,
        online: true,
        switchOn: true,
        updatedAt: now,
        isDummy: true,
      };
      updates[`${paths.liveRoot()}/${dummyUid}/${DUMMY_DEVICE}`] = {
        kwh: 2.48,
        currentMa: 320,
        powerW: 75,
        voltageV: 220,
        online: true,
        timestamp: now,
        date: formatDate(today),
        time: new Date(now).toTimeString().slice(0, 8),
        isDummy: true,
      };

      // History: last 7 days daily + current hour/week/month/year
      let rolling = 0;
      for (let i = 6; i >= 0; i -= 1) {
        const day = addDays(startOfDay(today), -i);
        const dayKwh = 0.25 + (6 - i) * 0.12 + (i % 2) * 0.05;
        rolling += dayKwh;
        const keys = getBucketKeys(day);
        const dayBase = paths.historyBucket(
          dummyUid,
          DUMMY_DEVICE,
          "daily",
          keys.daily
        );
        updates[`${dayBase}/kwh`] = Number(dayKwh.toFixed(4));
        updates[`${dayBase}/bucket`] = keys.daily;
        updates[`${dayBase}/date`] = keys.daily;
        updates[`${dayBase}/updatedAt`] = day.getTime();
        updates[`${dayBase}/isDummy`] = true;
      }

      const nowKeys = getBucketKeys(today);
      const stampHistory = (granularity, bucketKey, kwh) => {
        const base = paths.historyBucket(
          dummyUid,
          DUMMY_DEVICE,
          granularity,
          bucketKey
        );
        updates[`${base}/kwh`] = Number(kwh.toFixed(4));
        updates[`${base}/bucket`] = bucketKey;
        updates[`${base}/date`] = formatDate(today);
        updates[`${base}/updatedAt`] = now;
        updates[`${base}/isDummy`] = true;
      };
      stampHistory("hourly", nowKeys.hourly, 0.08);
      stampHistory("weekly", nowKeys.weekly, rolling);
      stampHistory("monthly", nowKeys.monthly, rolling + 1.1);
      stampHistory("yearly", nowKeys.yearly, rolling + 4.2);

      // KiloSave sample — only if missing or previously seeded as dummy
      const existingKilosave = await get(
        ref(database, paths.kilosaveSettings(dummyUid))
      );
      const kilosaveVal = existingKilosave.val();
      const canWriteKilosave = !kilosaveVal || kilosaveVal.isDummy === true;

      if (canWriteKilosave) {
        // Preserve real billing day; seed period from that day (not today−7).
        const billingDay =
          Number(kilosaveVal?.billingDayOfMonth) >= 1 &&
          Number(kilosaveVal?.billingDayOfMonth) <= 31
            ? Number(kilosaveVal.billingDayOfMonth)
            : await resolveUserBillingDay(dummyUid);
        const periodStart = resolveDemoPeriodStart({
          billingDayOfMonth: billingDay,
          fallbackDate: addDays(today, -7),
        });
        const period = buildBillingWeeks(periodStart);
        const weekStart = period.weeks[0].start;
        const weekEnd = period.weeks[0].end;
        const weekKey = period.weeks[0].weekKey;
        const periodKey = period.periodKey;

        updates[paths.kilosaveSettings(dummyUid)] = withPreservedBillingDay(
          kilosaveVal || {},
          {
            monthlyGoal: 500,
            weeklyGoal: 125,
            periodKey,
            periodStart: formatDate(period.periodStart),
            periodEnd: formatDate(period.periodEnd),
            createdAt: kilosaveVal?.createdAt || now,
            updatedAt: now,
            isDummy: true,
          },
          billingDay
        );
        updates[paths.kilosaveWeek(dummyUid, weekKey)] = {
          weekKey,
          weekIndex: 1,
          label: "Week 1",
          dateLabel: `${formatDate(weekStart)} – ${formatDate(weekEnd)}`,
          startDate: formatDate(weekStart),
          endDate: formatDate(weekEnd),
          amount: 125,
          status: "saved",
          via: "manual",
          savedAt: now,
          periodKey,
          isDummy: true,
        };
      }

      await update(ref(database), updates);
      setMessage(
        canWriteKilosave
          ? `Dummy data added for ${who}: room, plug, live, 7-day history, and KiloSave sample.`
          : `Dummy data added for ${who}: room, plug, live, and 7-day history. KiloSave skipped (user already has real settings).`
      );
    } catch (err) {
      setError(userFacingError(err, "Dummy seed failed."));
    } finally {
      setDummyBusy(false);
    }
  }

  // Remove dummy_* nodes only (never KiloSave)
  async function clearDummyData() {
    if (!dummyUid) {
      setError("Pick an existing user first.");
      return;
    }

    const who = userLabel(dummyUid, users[dummyUid] || {});
    if (
      !window.confirm(
        `Remove dummy_* room / plug / live / history for:\n\n${who}\n\nKiloSave will NOT be cleared.`
      )
    ) {
      return;
    }

    setDummyBusy(true);
    setMessage("");
    setError("");
    try {
      const removals = [
        remove(ref(database, `${paths.roomsRoot()}/${dummyUid}/${DUMMY_ROOM}`)),
        remove(
          ref(
            database,
            `${paths.appliancesRoot()}/${dummyUid}/${DUMMY_APPLIANCE}`
          )
        ),
        remove(
          ref(database, `${paths.devicesRoot()}/${dummyUid}/${DUMMY_DEVICE}`)
        ),
        remove(ref(database, `${paths.liveRoot()}/${dummyUid}/${DUMMY_DEVICE}`)),
        remove(ref(database, paths.historyDevice(dummyUid, DUMMY_DEVICE))),
      ];

      // Clean leftover legacy demo user if present
      removals.push(
        remove(ref(database, paths.user(LEGACY_DUMMY_OWNER))),
        remove(ref(database, `${paths.roomsRoot()}/${LEGACY_DUMMY_OWNER}`)),
        remove(ref(database, `${paths.appliancesRoot()}/${LEGACY_DUMMY_OWNER}`)),
        remove(ref(database, `${paths.devicesRoot()}/${LEGACY_DUMMY_OWNER}`)),
        remove(ref(database, `${paths.liveRoot()}/${LEGACY_DUMMY_OWNER}`)),
        remove(ref(database, paths.newsItem(LEGACY_DUMMY_NEWS)))
      );

      await Promise.all(removals);
      setMessage(
        `Dummy data cleared for ${who}. KiloSave was left untouched.`
      );
    } catch (err) {
      setError(userFacingError(err, "Clear failed."));
    } finally {
      setDummyBusy(false);
    }
  }

  // Backdated tips-test plug + history for Generate eligibility
  async function seedTipsDummyData() {
    if (!tipsDummyUid || !users[tipsDummyUid]) {
      setError("Pick an existing user first for tips dummy.");
      return;
    }

    const who = userLabel(tipsDummyUid, users[tipsDummyUid]);
    if (
      !window.confirm(
        `Add tips-test dummy (backdated plug + ${TIPS_DUMMY_HISTORY_DAYS}-day history) under:\n\n${who}\n\nNodes: ${DUMMY_TIPS_ROOM}, ${DUMMY_TIPS_DEVICE}. Does not touch the regular demo dummy.`
      )
    ) {
      return;
    }

    setTipsDummyBusy(true);
    setMessage("");
    setError("");
    const now = Date.now();
    const today = new Date();
    const registeredAt = addDays(
      startOfDay(today),
      -TIPS_DUMMY_REGISTERED_DAYS_AGO
    ).getTime();

    try {
      const updates = {};

      updates[`${paths.roomsRoot()}/${tipsDummyUid}/${DUMMY_TIPS_ROOM}`] = {
        roomId: DUMMY_TIPS_ROOM,
        name: "Tips Test Room",
        imageUri: null,
        createdAt: registeredAt,
        isDummy: true,
        isTipsDummy: true,
      };
      updates[
        `${paths.appliancesRoot()}/${tipsDummyUid}/${DUMMY_TIPS_APPLIANCE}`
      ] = {
        applianceId: DUMMY_TIPS_APPLIANCE,
        name: "Tips Test Plug",
        deviceId: DUMMY_TIPS_DEVICE,
        roomId: DUMMY_TIPS_ROOM,
        createdAt: registeredAt,
        isDummy: true,
        isTipsDummy: true,
      };
      updates[`${paths.devicesRoot()}/${tipsDummyUid}/${DUMMY_TIPS_DEVICE}`] = {
        deviceId: DUMMY_TIPS_DEVICE,
        homeId: null,
        identifier: "DUMMY-TIPS-QR-001",
        productId: null,
        provider: "tuya",
        pairedAt: registeredAt,
        roomId: DUMMY_TIPS_ROOM,
        applianceId: DUMMY_TIPS_APPLIANCE,
        online: true,
        switchOn: true,
        updatedAt: now,
        isDummy: true,
        isTipsDummy: true,
      };
      updates[`${paths.liveRoot()}/${tipsDummyUid}/${DUMMY_TIPS_DEVICE}`] = {
        kwh: 4.12,
        currentMa: 280,
        powerW: 62,
        voltageV: 220,
        online: true,
        timestamp: now,
        date: formatDate(today),
        time: new Date(now).toTimeString().slice(0, 8),
        isDummy: true,
        isTipsDummy: true,
      };

      let rolling = 0;
      for (let i = TIPS_DUMMY_HISTORY_DAYS - 1; i >= 0; i -= 1) {
        const day = addDays(startOfDay(today), -i);
        const dayKwh = 0.22 + ((TIPS_DUMMY_HISTORY_DAYS - 1 - i) % 5) * 0.11;
        rolling += dayKwh;
        const keys = getBucketKeys(day);
        const dayBase = paths.historyBucket(
          tipsDummyUid,
          DUMMY_TIPS_DEVICE,
          "daily",
          keys.daily
        );
        updates[`${dayBase}/kwh`] = Number(dayKwh.toFixed(4));
        updates[`${dayBase}/bucket`] = keys.daily;
        updates[`${dayBase}/date`] = keys.daily;
        updates[`${dayBase}/updatedAt`] = day.getTime();
        updates[`${dayBase}/isDummy`] = true;
        updates[`${dayBase}/isTipsDummy`] = true;
      }

      const nowKeys = getBucketKeys(today);
      const stampHistory = (granularity, bucketKey, kwh) => {
        const base = paths.historyBucket(
          tipsDummyUid,
          DUMMY_TIPS_DEVICE,
          granularity,
          bucketKey
        );
        updates[`${base}/kwh`] = Number(kwh.toFixed(4));
        updates[`${base}/bucket`] = bucketKey;
        updates[`${base}/date`] = formatDate(today);
        updates[`${base}/updatedAt`] = now;
        updates[`${base}/isDummy`] = true;
        updates[`${base}/isTipsDummy`] = true;
      };
      stampHistory("hourly", nowKeys.hourly, 0.09);
      stampHistory("weekly", nowKeys.weekly, rolling * 0.45);
      stampHistory("monthly", nowKeys.monthly, rolling);
      stampHistory("yearly", nowKeys.yearly, rolling + 3.5);

      await update(ref(database), updates);
      setMessage(
        `Tips dummy seeded for ${who}: plug dated ${TIPS_DUMMY_REGISTERED_DAYS_AGO} days ago + ${TIPS_DUMMY_HISTORY_DAYS}-day history. Open Tips & News and tap Generate.`
      );
    } catch (err) {
      setError(userFacingError(err, "Tips dummy seed failed."));
    } finally {
      setTipsDummyBusy(false);
    }
  }

  // Remove tips-test dummy nodes only
  async function clearTipsDummyData() {
    if (!tipsDummyUid) {
      setError("Pick an existing user first for tips dummy.");
      return;
    }

    const who = userLabel(tipsDummyUid, users[tipsDummyUid] || {});
    if (
      !window.confirm(
        `Remove tips-test dummy nodes for:\n\n${who}\n\n${DUMMY_TIPS_ROOM}, ${DUMMY_TIPS_APPLIANCE}, ${DUMMY_TIPS_DEVICE}, live + history.`
      )
    ) {
      return;
    }

    setTipsDummyBusy(true);
    setMessage("");
    setError("");
    try {
      await Promise.all([
        remove(
          ref(database, `${paths.roomsRoot()}/${tipsDummyUid}/${DUMMY_TIPS_ROOM}`)
        ),
        remove(
          ref(
            database,
            `${paths.appliancesRoot()}/${tipsDummyUid}/${DUMMY_TIPS_APPLIANCE}`
          )
        ),
        remove(
          ref(
            database,
            `${paths.devicesRoot()}/${tipsDummyUid}/${DUMMY_TIPS_DEVICE}`
          )
        ),
        remove(
          ref(database, `${paths.liveRoot()}/${tipsDummyUid}/${DUMMY_TIPS_DEVICE}`)
        ),
        remove(
          ref(database, paths.historyDevice(tipsDummyUid, DUMMY_TIPS_DEVICE))
        ),
      ]);
      setMessage(`Tips dummy cleared for ${who}.`);
    } catch (err) {
      setError(userFacingError(err, "Tips dummy clear failed."));
    } finally {
      setTipsDummyBusy(false);
    }
  }

  const selectedTipsUser = tipsDummyUid ? users[tipsDummyUid] : null;

  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">Helpdesk</p>
        <h1>Customer support</h1>
        <p className="muted">
          Account controls, plug ↔ user pairing lookup, and safe demo data.
        </p>
      </header>

      {message ? <div className="banner ok-banner">{message}</div> : null}
      {error ? <div className="banner error-banner">{error}</div> : null}

      <div className="support-grid">
        {/* Password reset */}
        <section className="panel support-panel">
          <div className="panel-head">
            <div>
              <h2>Account controls</h2>
              <p className="muted small">
                Sends Firebase password-reset email to the customer
              </p>
            </div>
          </div>
          <form className="support-body" onSubmit={onResetPassword}>
            <label>
              Customer email
              <input
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="user@email.com"
                required
              />
            </label>
            <button
              type="submit"
              className="btn primary"
              disabled={resetBusy}
            >
              {resetBusy ? "Sending…" : "Reset password"}
            </button>
            <p className="muted small">
              Works for email/password accounts. Google-only sign-ins may not
              use a password.
            </p>
          </form>
        </section>

        {/* Regular demo plug seed/clear */}
        <section className="panel support-panel">
          <div className="panel-head">
            <div>
              <h2>Dummy data</h2>
              <p className="muted small">
                Seed demo room / plug / history / KiloSave on an existing user
              </p>
            </div>
          </div>
          <div className="support-body">
            <label>
              Existing user
              <select
                value={dummyUid}
                onChange={(e) => setDummyUid(e.target.value)}
              >
                <option value="">Select a user…</option>
                {userOptions.map((row) => (
                  <option key={row.uid} value={row.uid}>
                    {row.label}
                  </option>
                ))}
              </select>
            </label>
            {selectedUser ? (
              <p className="muted small mono" style={{ marginTop: 8 }}>
                {dummyUid}
              </p>
            ) : null}
            <p className="muted small" style={{ marginTop: 10 }}>
              Adds <code>{DUMMY_ROOM}</code>, <code>{DUMMY_DEVICE}</code>, live
              reading, 7-day history, and a KiloSave sample. Does not create a
              new account.
            </p>
            <div className="row gap" style={{ marginTop: 12 }}>
              <button
                type="button"
                className="btn primary"
                disabled={dummyBusy || !dummyUid}
                onClick={seedDummyData}
              >
                {dummyBusy ? "Working…" : "Seed for user"}
              </button>
              <button
                type="button"
                className="btn danger"
                disabled={dummyBusy || !dummyUid}
                onClick={clearDummyData}
              >
                Clear for user
              </button>
            </div>
          </div>
        </section>

        {/* Tips eligibility test dummy */}
        <section className="panel support-panel">
          <div className="panel-head">
            <div>
              <h2>Tips test dummy</h2>
              <p className="muted small">
                Backdated plug + history so Generate tips unlocks in the app
              </p>
            </div>
          </div>
          <div className="support-body">
            <label>
              Existing user
              <select
                value={tipsDummyUid}
                onChange={(e) => setTipsDummyUid(e.target.value)}
              >
                <option value="">Select a user…</option>
                {userOptions.map((row) => (
                  <option key={row.uid} value={row.uid}>
                    {row.label}
                  </option>
                ))}
              </select>
            </label>
            {selectedTipsUser ? (
              <p className="muted small mono" style={{ marginTop: 8 }}>
                {tipsDummyUid}
              </p>
            ) : null}
            <p className="muted small" style={{ marginTop: 10 }}>
              Adds <code>{DUMMY_TIPS_ROOM}</code>, <code>{DUMMY_TIPS_DEVICE}</code>{" "}
              with <code>createdAt</code>/<code>pairedAt</code>{" "}
              {TIPS_DUMMY_REGISTERED_DAYS_AGO} days ago and{" "}
              {TIPS_DUMMY_HISTORY_DAYS} days of usage. Separate from the regular
              dummy above. Pick the same account you use in the app.
            </p>
            <div className="row gap" style={{ marginTop: 12 }}>
              <button
                type="button"
                className="btn primary"
                disabled={tipsDummyBusy || !tipsDummyUid}
                onClick={seedTipsDummyData}
              >
                {tipsDummyBusy ? "Working…" : "Seed tips dummy"}
              </button>
              <button
                type="button"
                className="btn danger"
                disabled={tipsDummyBusy || !tipsDummyUid}
                onClick={clearTipsDummyData}
              >
                Clear tips dummy
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Plug ↔ user pairing lookup */}
      <section className="panel section">
        <div className="panel-head">
          <div>
            <h2>Device pairing status</h2>
            <p className="muted small">
              Which Plug ID is paired to which User ID (from{" "}
              <code>devices/&#123;uid&#125;/&#123;plugId&#125;</code>)
            </p>
          </div>
        </div>
        <div className="support-body">
          <input
            className="search"
            style={{ width: "100%", maxWidth: 420, marginBottom: 14 }}
            placeholder="Search plug ID, user ID, email, name…"
            value={pairQuery}
            onChange={(e) => setPairQuery(e.target.value)}
          />

          {!pairQuery.trim() ? (
            <div className="table-wrap" style={{ borderRadius: 12 }}>
              <table>
                <thead>
                  <tr>
                    <th>Plug ID</th>
                    <th>User ID</th>
                    <th>Owner</th>
                    <th>Status</th>
                    <th>Paired</th>
                  </tr>
                </thead>
                <tbody>
                  {pairingRows.slice(0, 25).map((row) => (
                    <tr key={`${row.ownerUid}:${row.plugId}`}>
                      <td>
                        <div className="mono small">{row.plugId}</div>
                        {row.identifier ? (
                          <div className="muted small">QR {row.identifier}</div>
                        ) : null}
                      </td>
                      <td>
                        <div className="mono small">{row.ownerUid}</div>
                      </td>
                      <td>
                        <strong>{row.ownerName}</strong>
                        <div className="muted small">{row.ownerEmail || "—"}</div>
                      </td>
                      <td>
                        <span
                          className={`badge-pill ${row.online ? "ok" : "warn"}`}
                        >
                          {row.online ? "Online" : "Offline"}
                        </span>
                      </td>
                      <td className="muted small">{formatWhen(row.pairedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {pairingRows.length > 25 ? (
                <p className="muted small" style={{ padding: 12 }}>
                  Showing 25 of {pairingRows.length}. Search to narrow results.
                </p>
              ) : null}
              {pairingRows.length === 0 ? (
                <div className="empty-inline">No paired plugs yet.</div>
              ) : null}
            </div>
          ) : pairMatches.length === 0 ? (
            <div className="empty-inline">No pairing matches that search.</div>
          ) : (
            <div className="table-wrap" style={{ borderRadius: 12 }}>
              <table>
                <thead>
                  <tr>
                    <th>Plug ID</th>
                    <th>User ID</th>
                    <th>Owner</th>
                    <th>Status</th>
                    <th>Paired</th>
                  </tr>
                </thead>
                <tbody>
                  {pairMatches.map((row) => (
                    <tr key={`${row.ownerUid}:${row.plugId}`}>
                      <td>
                        <div className="mono small">{row.plugId}</div>
                        {row.identifier ? (
                          <div className="muted small">QR {row.identifier}</div>
                        ) : null}
                      </td>
                      <td>
                        <div className="mono small">{row.ownerUid}</div>
                      </td>
                      <td>
                        <strong>{row.ownerName}</strong>
                        <div className="muted small">{row.ownerEmail || "—"}</div>
                      </td>
                      <td>
                        <span
                          className={`badge-pill ${row.online ? "ok" : "warn"}`}
                        >
                          {row.online ? "Online" : "Offline"}
                        </span>
                      </td>
                      <td className="muted small">{formatWhen(row.pairedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
