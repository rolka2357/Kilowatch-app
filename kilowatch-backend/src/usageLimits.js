/*
 * Enforces per-device daily spend (₱) limits against today's live kWh.
 * When a threshold is crossed, optionally auto-offs the plug via Tuya and/or
 * pushes a home alert. Each limit fires at most once per calendar day so
 * notify-only and auto-off thresholds at different amounts can both run.
 */
const admin = require("firebase-admin");

const { setDeviceSwitch } = require("./tuyaClient");
const { formatDate, paths } = require("./energy");
const {
  partsInZone,
  usageLimitFireKey,
  jsDayToScheduleDay,
} = require("./time");
const {
  publishHomeAlertAndPush,
  resolveApplianceInfo,
  resolveApplianceName,
} = require("./notify");

const db = admin.database();
const ADMIN_DEMO_TRIGGER_TTL_MS = 10 * 60 * 1000;

function isDummy(deviceId, device) {
  if (device?.isDummy || device?.isTipsDummy) return true;
  return String(deviceId || "").startsWith("dummy_");
}

// Whether this limit's day-of-week filter includes today in the home timezone.
function usageLimitAppliesToday(limit, parts) {
  if (!limit || limit.enabled === false) return false;
  const days = limit.days;
  const today = jsDayToScheduleDay(parts.jsDay);
  const everyday =
    days === "everyday" || (Array.isArray(days) && days.length === 7);
  if (everyday) return true;
  return Array.isArray(days) && days.includes(today);
}

function formatAmount(limitPhp) {
  if (!(Number.isFinite(limitPhp) && limitPhp > 0)) return "your usage limit";
  return `₱${limitPhp.toFixed(limitPhp % 1 === 0 ? 0 : 2)}`;
}

// Owner electricity rate (₱/kWh); falls back to env/default when unset.
async function getElectricityRate(ownerUid) {
  const snap = await db.ref(`users/${ownerUid}`).get();
  const profile = snap.val() || {};
  const rate = Number(profile.electricityRate || profile.rate || 0);
  return rate > 0 ? rate : Number(process.env.PHP_PER_KWH || 15) || 15;
}

/** Same rule as the app: ignore live kWh left over from a previous day. */
function liveTodayKwh(live, now = new Date()) {
  if (!live) return 0;
  if (String(live.date || "") !== formatDate(now)) return 0;
  return Math.max(0, Number(live.kwh || 0));
}

// Main pass: compare today₱ to each enabled limit, then notify / auto-off.
async function runUsageLimits(usersDevices) {
  const users = usersDevices || (await db.ref(paths.devicesRoot()).get()).val() || {};
  const now = new Date();
  const parts = partsInZone(now);
  const dayKey = usageLimitFireKey(now);

  for (const [uid, devices] of Object.entries(users)) {
    let rate = null;
    let liveMap = null;

    for (const [deviceId, device] of Object.entries(devices || {})) {
      if (isDummy(deviceId, device)) continue;
      const limits = device?.usageLimits || {};
      const limitEntries = Object.entries(limits);
      if (!limitEntries.length) continue;

      // Lazy-load rate and live map once per owner with active limits.
      if (rate == null) rate = await getElectricityRate(uid);
      if (liveMap == null) {
        const liveSnap = await db.ref(`live/${uid}`).get();
        liveMap = liveSnap.val() || {};
      }

      const adminDemoTrigger = device?.usageLimitState?.adminDemoTrigger;
      const adminDemoActive =
        Number(adminDemoTrigger?.kwh || 0) > 0 &&
        now.getTime() - Number(adminDemoTrigger?.createdAt || 0) >= 0 &&
        now.getTime() - Number(adminDemoTrigger?.createdAt || 0) <=
          ADMIN_DEMO_TRIGGER_TTL_MS;
      const todayKwh = adminDemoActive
        ? Math.max(
            liveTodayKwh(liveMap[deviceId], now),
            Number(adminDemoTrigger.kwh)
          )
        : liveTodayKwh(liveMap[deviceId], now);
      const todayPhp = todayKwh * rate;

      const activeEntries = limitEntries.filter(
        ([, limit]) => limit && limit.enabled !== false
      );
      if (!activeEntries.length) {
        if (adminDemoTrigger) {
          await db
            .ref(
              `${paths.device(uid, deviceId)}/usageLimitState/adminDemoTrigger`
            )
            .remove();
        }
        continue;
      }

      // Ascending ₱ so lower thresholds can fire before higher ones same day.
      activeEntries.sort(
        (a, b) => Number(a[1]?.limitPhp || 0) - Number(b[1]?.limitPhp || 0)
      );

      // Each limit fires once per day via its own lastFiredKey.
      // A lower auto-off (or auto-off-only) must not swallow a higher one.
      for (const [limitId, limit] of activeEntries) {
        if (!adminDemoActive && !usageLimitAppliesToday(limit, parts)) continue;
        const limitPhp = Number(limit.limitPhp) || 0;
        if (!(limitPhp > 0)) continue;
        if (limit.lastFiredKey === dayKey) continue;

        const notifyEnabled = limit.notifyEnabled !== false;
        const autoOffEnabled = limit.autoOffEnabled !== false;
        if (!notifyEnabled && !autoOffEnabled) continue;
        if (todayPhp + 1e-9 < limitPhp) continue;

        const applianceName = await resolveApplianceName(uid, deviceId);
        const applianceInfo = await resolveApplianceInfo(uid, deviceId);
        let success = true;

        if (autoOffEnabled) {
          const alreadyOff = device?.switchOn === false;
          if (!alreadyOff) {
            const ok = await setDeviceSwitch(deviceId, false);
            success = ok;
            if (ok) {
              await db.ref().update({
                [`${paths.device(uid, deviceId)}/switchOn`]: false,
                [`${paths.device(uid, deviceId)}/updatedAt`]: Date.now(),
              });
              device.switchOn = false;
            } else {
              console.warn(`Usage-limit auto-off failed ${uid}/${deviceId}`);
            }
          }
        }

        // Persist fire keys so this threshold does not re-trigger later today.
        const handledUpdates = {
          [`${paths.device(uid, deviceId)}/usageLimits/${limitId}/lastFiredKey`]:
            dayKey,
          [`${paths.device(uid, deviceId)}/usageLimits/${limitId}/lastFiredAt`]:
            Date.now(),
          [`${paths.device(uid, deviceId)}/usageLimitState/handledDay`]: dayKey,
          [`${paths.device(uid, deviceId)}/usageLimitState/handledAt`]:
            Date.now(),
          [`${paths.device(uid, deviceId)}/usageLimitState/lastLimitId`]:
            limitId,
        };
        if (autoOffEnabled) {
          handledUpdates[
            `${paths.device(uid, deviceId)}/usageLimitState/autoOffDay`
          ] = dayKey;
        }
        await db.ref().update(handledUpdates);

        if (notifyEnabled) {
          const amount = formatAmount(limitPhp);
          let title = "Usage limit reached";
          let body = `${applianceName} hit ${amount} today.`;
          if (autoOffEnabled && success) {
            body = `${applianceName} was turned off after hitting ${amount} today.`;
          } else if (autoOffEnabled && !success) {
            title = "Usage limit couldn't run";
            body = `Couldn't turn off ${applianceName} for usage limit. Check Wi‑Fi and try again.`;
          } else if (!autoOffEnabled) {
            body = `${applianceName} hit ${amount} today. Turn it off now, or turn it off manually when you’re ready.`;
          }

          try {
            await publishHomeAlertAndPush(uid, {
              type: "usageLimit",
              title,
              body,
              deviceId,
              applianceId: applianceInfo?.applianceId || null,
              roomId: applianceInfo?.roomId || null,
              applianceName,
              limitPhp,
              success,
              autoOff: autoOffEnabled,
              source: "backend",
            });
          } catch (error) {
            console.warn("Usage-limit notify failed:", error.message);
          }
        }

        console.log(
          `  usageLimit ${deviceId}/${limitId} php=${todayPhp.toFixed(2)}/${limitPhp}`
        );
      }

      if (adminDemoTrigger) {
        await db
          .ref(
            `${paths.device(uid, deviceId)}/usageLimitState/adminDemoTrigger`
          )
          .remove();
      }
    }
  }
}

module.exports = { runUsageLimits };
