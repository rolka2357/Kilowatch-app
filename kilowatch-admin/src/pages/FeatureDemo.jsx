/**
 * Defense / panelist feature demo panel.
 * Select a real user (and optional appliance), then run demoActions helpers
 * for usage limits, KiloSave, live kWh, history, dummy data, and tips skips.
 */
import { useEffect, useMemo, useState } from "react";
import { onValue, ref } from "firebase/database";

import {
  bumpLiveKwh,
  clearAllKilosave,
  clearDummyData,
  clearDummyKilosave,
  clearTipsDummyData,
  ensureKilosaveGoal,
  isDummyId,
  loadKilosaveStatus,
  loadUserContext,
  prepBillLogDemo,
  prepKilosaveDemo,
  resetUsageLimitAlerts,
  seedDummyData,
  seedKilosaveRolloverDemo,
  saveKilosaveNextWeekDemo,
  seedFullAnalyticsHistory,
  seedMonthlyCompareHistory,
  seedTipsDummyData,
  seedWeekHistory,
  seedWeeklyCompareHistory,
  seedYearlyCompareHistory,
  clearMonthlyCompareHistory,
  clearSeededAnalyticsHistory,
  clearWeeklyCompareHistory,
  clearYearlyCompareHistory,
  skipTipsFourteenDays,
  skipTipsSevenDays,
  triggerKilosaveBackendReminderDemo,
  tripUsageLimits,
} from "../demoActions";
import { database } from "../firebase";
import { paths } from "../paths";
import { userFacingError } from "../userFacingError";

function userLabel(uid, profile = {}) {
  const name = profile.fullName || profile.email || uid;
  const email = profile.email ? ` · ${profile.email}` : "";
  return `${name}${email}`;
}

/** Catalog of demo buttons grouped for the UI (ids map to runFeature cases). */
const FEATURES = [
  {
    id: "usage-limit-trip",
    group: "Usage Limit",
    title: "Trip usage limit",
    body: "On real plugs with an enabled actionable limit: sends a one-time test override to kilowatch-backend. The backend applies the limit even though Tuya keeps refreshing live kWh.",
    needsAppliance: false,
    needsLimits: true,
  },
  {
    id: "usage-limit-reset",
    group: "Usage Limit",
    title: "Reset usage-limit alert",
    body: "Clears lastFiredKey only so the same day can fire again without changing live kWh.",
    needsAppliance: false,
    needsLimits: true,
  },
  {
    id: "kilosave-goal",
    group: "KiloSave",
    title: "Ensure budget goal",
    body: "Creates or refreshes a ₱500 monthly KiloSave goal and 4-week period if missing.",
    needsAppliance: false,
  },
  {
    id: "kilosave-setaside",
    group: "KiloSave",
    title: "Log sample set-aside",
    body: "Marks Week 1 as saved so Overview / History show progress during defense.",
    needsAppliance: false,
  },
  {
    id: "kilosave-clear-missed",
    group: "KiloSave",
    title: "Trigger backend reminder",
    body: "Queues an owner-only missed-week reminder for kilowatch-backend without changing real saved weeks. FCM should arrive within a few seconds (app can stay closed).",
    needsAppliance: false,
    confirm: "Send a KiloSave demo reminder to the selected user?",
  },
  {
    id: "kilosave-bill",
    group: "KiloSave",
    title: "Prep bill logging",
    body: "Writes a sample bill-log snapshot (actual bill, estimate, coverage) for History.",
    needsAppliance: false,
  },
  {
    id: "kilosave-rollover-demo",
    group: "KiloSave",
    title: "Seed completed period + new period",
    body: "Selected user only: archives a finished 4-week period (all weeks saved + bill in History), then starts a new current period. Each re-seed advances the calendar 4 weeks forward so dates move up.",
    needsAppliance: false,
    confirm:
      "Replace KiloSave for the SELECTED user with demo data?\n\n• Previous period: fully saved + History snapshot\n• Current period: new 4-week goal starting today\n\nThis overwrites that user’s KiloSave settings/weeks.",
  },
  {
    id: "kilosave-save-next-week",
    group: "KiloSave",
    title: "Dummy save next week",
    body: "Selected user only: each click saves the next unsaved week (W1→W2→W3→W4). After Week 4, archives that period to History and starts the next month (saves its Week 1).",
    needsAppliance: false,
  },
  {
    id: "kilosave-clear-all",
    group: "KiloSave",
    title: "Clear ALL KiloSave (selected user)",
    body: "Deletes settings, weeks, periods, and backups for the selected user only. Irreversible.",
    needsAppliance: false,
    confirm:
      "DELETE ALL KiloSave data for the SELECTED user only?\n\nThis removes goal, weeks, History periods, and backups. Cannot undo.",
  },
  {
    id: "monitor-bump",
    group: "Appliances",
    title: "Bump live kWh",
    body: "Sets today’s live reading on the selected real plug (~2.5 kWh) for dashboard / appliance screens.",
    needsAppliance: true,
  },
  {
    id: "analytics-history",
    group: "Analytics",
    title: "Seed 7-day history",
    body: "Adds daily history buckets on the selected real plug so Analytics charts have data.",
    needsAppliance: true,
  },
  {
    id: "analytics-full-seed",
    group: "Analytics",
    title: "Seed full analytics",
    body: "Seeds daily, weekly, monthly, and yearly history on the selected real plug (35 days + hourly today) so Day / Week / Month / Year tabs unlock.",
    needsAppliance: true,
    confirm:
      "Seed full Analytics history on the selected plug?\n\nThis writes demo daily/weekly/monthly/yearly buckets (and today’s hourly bars).",
  },
  {
    id: "analytics-full-clear",
    group: "Analytics",
    title: "Clear seeded analytics",
    body: "Deletes only Feature Demo–seeded analytics buckets on the selected plug (or all real plugs if none selected). Real monitored history without the demo marker is kept.",
    needsAppliance: false,
    confirm:
      "Delete seeded analytics history for this user?\n\nOnly buckets marked as admin demo seeds are removed.",
  },
  {
    id: "analytics-compare-weekly-seed",
    group: "Analytics",
    title: "Seed weekly comparison",
    body: "Seeds this week + last week daily bars so Comparison Trend → Weekly shows This week vs Last week.",
    needsAppliance: true,
    confirm: "Seed weekly comparison history on the selected plug?",
  },
  {
    id: "analytics-compare-weekly-clear",
    group: "Analytics",
    title: "Clear weekly comparison",
    body: "Deletes only weekly-comparison demo buckets (this/last week).",
    needsAppliance: false,
    confirm: "Delete seeded weekly comparison history?",
  },
  {
    id: "analytics-compare-monthly-seed",
    group: "Analytics",
    title: "Seed monthly comparison",
    body: "Seeds this month + last month daily/weekly bars so Comparison Trend → Monthly unlocks.",
    needsAppliance: true,
    confirm: "Seed monthly comparison history on the selected plug?",
  },
  {
    id: "analytics-compare-monthly-clear",
    group: "Analytics",
    title: "Clear monthly comparison",
    body: "Deletes only monthly-comparison demo buckets (this/last month).",
    needsAppliance: false,
    confirm: "Delete seeded monthly comparison history?",
  },
  {
    id: "analytics-compare-yearly-seed",
    group: "Analytics",
    title: "Seed yearly comparison",
    body: "Seeds this year + last year monthly/yearly bars so Comparison Trend → Yearly unlocks.",
    needsAppliance: true,
    confirm: "Seed yearly comparison history on the selected plug?",
  },
  {
    id: "analytics-compare-yearly-clear",
    group: "Analytics",
    title: "Clear yearly comparison",
    body: "Deletes only yearly-comparison demo buckets (this/last year).",
    needsAppliance: false,
    confirm: "Delete seeded yearly comparison history?",
  },
  {
    id: "dummy-seed",
    group: "Demo data",
    title: "Seed demo plug",
    body: "Adds dummy_* room, plug, live reading, 7-day history, and optional KiloSave sample (safe — only dummy nodes).",
    needsAppliance: false,
    confirm:
      "Add dummy room, plug, live, history, and optional KiloSave under this user?",
  },
  {
    id: "dummy-clear",
    group: "Demo data",
    title: "Clear demo plug",
    body: "Removes dummy_* room/plug/live/history only. Does NOT touch KiloSave (goal/weeks stay).",
    needsAppliance: false,
    confirm:
      "Remove dummy_* demo room/plug/history for this user? KiloSave will NOT be changed.",
  },
  {
    id: "dummy-clear-kilosave",
    group: "Demo data",
    title: "Clear dummy KiloSave only",
    body: "Deletes KiloSave only if settings.isDummy === true. Real goals are refused.",
    needsAppliance: false,
    confirm:
      "Delete this user’s KiloSave ONLY if it was seeded as demo (isDummy)? Real goals will be blocked.",
  },
  {
    id: "tips-seed",
    group: "Tips",
    title: "Seed tips test data",
    body: "Backdated plug + 14-day history for Tips eligibility. Open Tips in app → Generate.",
    needsAppliance: false,
    confirm: "Add tips-test dummy (backdated plug + 14-day history)?",
  },
  {
    id: "tips-skip-14",
    group: "Tips",
    title: "Skip 14 days (first generate)",
    body: "Backdates plugs 14 days, seeds history, auto-generates tips, and pushes a “tips ready” notification to the owner + household.",
    needsAppliance: false,
    confirm:
      "Pretend 14 days passed, auto-generate tips, and notify the household?",
  },
  {
    id: "tips-skip-7",
    group: "Tips",
    title: "Skip 7 days (next generate)",
    body: "Each press skips another week, auto-generates new tips, and sends another household notification. Stacks every click.",
    needsAppliance: false,
  },
  {
    id: "tips-clear",
    group: "Tips",
    title: "Clear tips test data",
    body: "Removes tips dummy nodes only (does not touch the regular demo plug).",
    needsAppliance: false,
    confirm: "Remove tips-test dummy nodes for this user?",
  },
];

export default function FeatureDemo() {
  const [users, setUsers] = useState({});
  const [selectedUid, setSelectedUid] = useState("");
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [context, setContext] = useState(null);
  const [kilosave, setKilosave] = useState(null);
  const [loadingCtx, setLoadingCtx] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    // Live user list for the selector
    return onValue(ref(database, paths.users()), (snap) =>
      setUsers(snap.val() || {})
    );
  }, []);

  const userOptions = useMemo(
    () =>
      Object.entries(users)
        .filter(([uid]) => !isDummyId(uid))
        .map(([uid, profile]) => ({
          uid,
          label: userLabel(uid, profile || {}),
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [users]
  );

  // When user changes: load appliances + KiloSave status
  useEffect(() => {
    if (!selectedUid) {
      setContext(null);
      setKilosave(null);
      setSelectedDeviceId("");
      return undefined;
    }

    let cancelled = false;
    setLoadingCtx(true);
    Promise.all([loadUserContext(selectedUid), loadKilosaveStatus(selectedUid)])
      .then(([ctx, ks]) => {
        if (cancelled) return;
        setContext(ctx);
        setKilosave(ks);
        const first = ctx.realAppliances[0]?.deviceId || "";
        setSelectedDeviceId((prev) =>
          ctx.realAppliances.some((a) => a.deviceId === prev) ? prev : first
        );
      })
      .catch((err) => {
        if (!cancelled) setError(userFacingError(err, "Could not load user."));
      })
      .finally(() => {
        if (!cancelled) setLoadingCtx(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedUid]);

  const selectedAppliance = useMemo(
    () =>
      context?.realAppliances?.find((a) => a.deviceId === selectedDeviceId) ||
      null,
    [context, selectedDeviceId]
  );

  const hasUsageLimits = useMemo(
    () =>
      (context?.realAppliances || []).some(
        (a) =>
          Object.values(a.usageLimits || {}).some(
            (limit) =>
              limit &&
              limit.enabled !== false &&
              (limit.notifyEnabled !== false ||
                limit.autoOffEnabled !== false)
          )
      ),
    [context]
  );

  // Dispatch selected FEATURE id to the matching demoActions helper
  async function runFeature(featureId) {
    if (!selectedUid) {
      setError("Select a user first.");
      return;
    }

    const feature = FEATURES.find((f) => f.id === featureId);
    if (feature?.confirm && !window.confirm(`${feature.confirm}\n\nUser: ${selectedUid}`)) {
      return;
    }

    setBusyId(featureId);
    setMessage("");
    setError("");

    try {
      let result;
      switch (featureId) {
        case "usage-limit-trip":
          result = await tripUsageLimits(selectedUid, {
            deviceId: selectedDeviceId || null,
          });
          setMessage(
            `Usage limit tripped for ${result
              .map((r) => `${r.name} (${r.kwh.toFixed(2)} kWh ≈ ₱${r.php})`)
              .join("; ")}. Backend should process it within one poll cycle (~15s); the app may stay closed.`
          );
          break;
        case "usage-limit-reset":
          result = await resetUsageLimitAlerts(selectedUid, {
            deviceId: selectedDeviceId || null,
          });
          setMessage(`Reset today's usage-limit guard on ${result} limit(s).`);
          break;
        case "kilosave-goal":
          result = await ensureKilosaveGoal(selectedUid);
          setMessage(
            `KiloSave goal set to ₱${result.monthlyGoal} (${result.periodKey}).`
          );
          break;
        case "kilosave-setaside":
          result = await prepKilosaveDemo(selectedUid);
          setMessage(`Week 1 marked saved (₱${result.amount}).`);
          break;
        case "kilosave-clear-missed":
          result = await triggerKilosaveBackendReminderDemo(selectedUid);
          setMessage(
            `Backend reminder queued (₱${result.amount}). Expect an owner-only FCM push within a few seconds; the phone app may stay closed.`
          );
          break;
        case "kilosave-bill":
          result = await prepBillLogDemo(selectedUid);
          setMessage(
            `Bill log sample ready: actual ₱${result.actualBillPhp}, estimate ₱${result.estimatedPhp}, coverage ${result.coveragePct}%.`
          );
          break;
        case "kilosave-rollover-demo":
          result = await seedKilosaveRolloverDemo(selectedUid);
          setMessage(
            `Seed #${result.demoRun}: previous ${result.previousLabel} (₱${result.totalSetAside} in History). Current ${result.currentLabel} (Week 1 ${result.currentWeek1}). Each re-seed advances 4 weeks forward.`
          );
          break;
        case "kilosave-save-next-week":
          result = await saveKilosaveNextWeekDemo(selectedUid);
          setMessage(
            result.rolledOver
              ? `Period complete → archived ${result.previousPeriodLabel} to History. New period ${result.periodLabel}; ${result.weekLabel} saved (₱${result.amount}).`
              : `Saved ${result.weekLabel} (${result.weekRange}) · ₱${result.amount} · ${result.savedCount}/${result.totalWeeks} weeks in ${result.periodLabel}.`
          );
          break;
        case "kilosave-clear-all":
          await clearAllKilosave(selectedUid);
          setMessage("All KiloSave data cleared for the selected user.");
          break;
        case "monitor-bump":
          if (!selectedDeviceId) throw new Error("Select a real appliance.");
          result = await bumpLiveKwh(selectedUid, selectedDeviceId, 2.5);
          setMessage(`Live kWh set to ${result} on selected plug.`);
          break;
        case "analytics-history":
          if (!selectedDeviceId) throw new Error("Select a real appliance.");
          result = await seedWeekHistory(selectedUid, selectedDeviceId);
          setMessage(
            `7-day history seeded (~${result.toFixed(2)} kWh rolling) on selected plug.`
          );
          break;
        case "analytics-full-seed":
          if (!selectedDeviceId) throw new Error("Select a real appliance.");
          result = await seedFullAnalyticsHistory(
            selectedUid,
            selectedDeviceId
          );
          setMessage(
            `Full analytics seeded on selected plug: ${result.days} daily · ${result.weeklyBuckets} weekly · ${result.monthlyBuckets} monthly · ${result.yearlyBuckets} yearly (~${result.totalKwh} kWh). Open Analytics Day/Week/Month/Year.`
          );
          break;
        case "analytics-full-clear":
          result = await clearSeededAnalyticsHistory(selectedUid, {
            deviceId: selectedDeviceId || null,
          });
          setMessage(
            `Cleared seeded analytics on ${result.devices} plug(s) · ${result.buckets} bucket(s) removed.`
          );
          break;
        case "analytics-compare-weekly-seed":
          if (!selectedDeviceId) throw new Error("Select a real appliance.");
          result = await seedWeeklyCompareHistory(
            selectedUid,
            selectedDeviceId
          );
          setMessage(
            `Weekly comparison seeded: this week ${result.thisWeekDays}d · last week ${result.lastWeekDays}d (~${result.totalKwh} kWh). Open Analytics → Comparison Trend → Weekly.`
          );
          break;
        case "analytics-compare-weekly-clear":
          result = await clearWeeklyCompareHistory(selectedUid, {
            deviceId: selectedDeviceId || null,
          });
          setMessage(
            `Cleared weekly comparison on ${result.devices} plug(s) · ${result.buckets} bucket(s) removed.`
          );
          break;
        case "analytics-compare-monthly-seed":
          if (!selectedDeviceId) throw new Error("Select a real appliance.");
          result = await seedMonthlyCompareHistory(
            selectedUid,
            selectedDeviceId
          );
          setMessage(
            `Monthly comparison seeded: this month ${result.thisMonthDays}d · last month ${result.lastMonthDays}d (${result.monthlyBuckets} monthly buckets). Open Analytics → Comparison Trend → Monthly.`
          );
          break;
        case "analytics-compare-monthly-clear":
          result = await clearMonthlyCompareHistory(selectedUid, {
            deviceId: selectedDeviceId || null,
          });
          setMessage(
            `Cleared monthly comparison on ${result.devices} plug(s) · ${result.buckets} bucket(s) removed.`
          );
          break;
        case "analytics-compare-yearly-seed":
          if (!selectedDeviceId) throw new Error("Select a real appliance.");
          result = await seedYearlyCompareHistory(
            selectedUid,
            selectedDeviceId
          );
          setMessage(
            `Yearly comparison seeded: ${result.months} months · ${result.yearlyBuckets} yearly buckets (~${result.totalKwh} kWh). Open Analytics → Comparison Trend → Yearly.`
          );
          break;
        case "analytics-compare-yearly-clear":
          result = await clearYearlyCompareHistory(selectedUid, {
            deviceId: selectedDeviceId || null,
          });
          setMessage(
            `Cleared yearly comparison on ${result.devices} plug(s) · ${result.buckets} bucket(s) removed.`
          );
          break;
        case "dummy-seed":
          result = await seedDummyData(selectedUid);
          setMessage(
            result.kilosaveWritten
              ? "Demo plug + KiloSave sample added (dummy_* nodes)."
              : "Demo plug added. KiloSave skipped (user has real settings)."
          );
          break;
        case "dummy-clear":
          await clearDummyData(selectedUid);
          setMessage(
            "Demo dummy plug/room cleared. KiloSave was left untouched."
          );
          break;
        case "dummy-clear-kilosave":
          await clearDummyKilosave(selectedUid);
          setMessage("Dummy KiloSave cleared (isDummy only).");
          break;
        case "tips-seed":
          result = await seedTipsDummyData(selectedUid);
          setMessage(
            `Tips dummy ready: plug ${result.registeredDaysAgo} days old, ${result.historyDays}-day history. Open Tips → Generate.`
          );
          break;
        case "tips-skip-14":
          result = await skipTipsFourteenDays(selectedUid);
          setMessage(
            result.generateError
              ? `Skipped 14 days on ${result.plugs} plug(s), but generate/notify failed: ${result.generateError}`
              : Number(result.fcmSent || 0) > 0
                ? `Skipped 14 days on ${result.plugs} plug(s). Tips auto-generated; FCM sent=${result.fcmSent} (${result.via || "ok"}). Check the phone.`
                : `Skipped 14 days on ${result.plugs} plug(s). Tips path finished (${result.via || "unknown"}) but FCM sent=0 — check users/{uid}/fcmTokens.`
          );
          break;
        case "tips-skip-7":
          result = await skipTipsSevenDays(selectedUid);
          setMessage(
            result.generateError
              ? `Skipped week #${result.weeksSkipped} on ${result.plugs} plug(s), but generate/notify failed: ${result.generateError}`
              : Number(result.fcmSent || 0) > 0
                ? `Skipped week #${result.weeksSkipped} on ${result.plugs} plug(s). Tips regenerated; FCM sent=${result.fcmSent} (${result.via || "ok"}). Check the phone.`
                : `Skipped week #${result.weeksSkipped} on ${result.plugs} plug(s). Tips path finished (${result.via || "unknown"}) but FCM sent=0 — check users/{uid}/fcmTokens.`
          );
          break;
        case "tips-clear":
          await clearTipsDummyData(selectedUid);
          setMessage("Tips dummy cleared.");
          break;
        default:
          throw new Error("Unknown feature.");
      }

      if (selectedUid) {
        const [ctx, ks] = await Promise.all([
          loadUserContext(selectedUid),
          loadKilosaveStatus(selectedUid),
        ]);
        setContext(ctx);
        setKilosave(ks);
      }
    } catch (err) {
      setError(userFacingError(err, "Demo action failed."));
    } finally {
      setBusyId("");
    }
  }

  const grouped = useMemo(() => {
    const map = new Map();
    FEATURES.forEach((f) => {
      if (!map.has(f.group)) map.set(f.group, []);
      map.get(f.group).push(f);
    });
    return [...map.entries()];
  }, []);

  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">Defense demo</p>
        <h1>Feature demo panel</h1>
        <p className="muted">
          Pick the panelist’s app account, then trigger each feature from here.
          Real plugs only — dummy_* nodes are ignored for usage limit / live
          bumps.
        </p>
      </header>

      {message ? <div className="banner ok-banner">{message}</div> : null}
      {error ? <div className="banner error-banner">{error}</div> : null}

      {/* Step 1: pick the panelist’s app account */}
      <section className="panel section">
        <div className="panel-head">
          <div>
            <h2>1. Select user</h2>
            <p className="muted small">
              Same account they use on the phone (Editor on their home).
            </p>
          </div>
        </div>
        <div className="support-body">
          <label>
            App user
            <select
              value={selectedUid}
              onChange={(e) => setSelectedUid(e.target.value)}
            >
              <option value="">Select a user…</option>
              {userOptions.map((row) => (
                <option key={row.uid} value={row.uid}>
                  {row.label}
                </option>
              ))}
            </select>
          </label>
          {selectedUid ? (
            <p className="muted small mono" style={{ marginTop: 8 }}>
              {selectedUid}
            </p>
          ) : null}
        </div>
      </section>

      {selectedUid ? (
        // Step 2: optional real plug for live/history demos
        <section className="panel section">
          <div className="panel-head">
            <div>
              <h2>2. Real appliance (optional)</h2>
              <p className="muted small">
                Required for live kWh bump and analytics history. Usage limit
                uses all real plugs with limits if left on “All”.
              </p>
            </div>
          </div>
          <div className="support-body">
            {loadingCtx ? (
              <p className="muted small">Loading appliances…</p>
            ) : context?.realAppliances?.length ? (
              <>
                <label>
                  Target plug
                  <select
                    value={selectedDeviceId}
                    onChange={(e) => setSelectedDeviceId(e.target.value)}
                  >
                    <option value="">All plugs with limits / first for others</option>
                    {context.realAppliances.map((row) => (
                      <option key={row.deviceId} value={row.deviceId}>
                        {row.name} · {row.liveKwh.toFixed(2)} kWh today
                        {Object.keys(row.usageLimits || {}).length
                          ? " · has limit"
                          : ""}
                      </option>
                    ))}
                  </select>
                </label>
                {selectedAppliance ? (
                  <p className="muted small" style={{ marginTop: 8 }}>
                    Device ID: <code>{selectedAppliance.deviceId}</code>
                  </p>
                ) : null}
                {!hasUsageLimits ? (
                  <p className="muted small" style={{ marginTop: 8 }}>
                    No usage limits on real plugs yet — add one in the app first
                    (Appliance → Usage Limit).
                  </p>
                ) : null}
              </>
            ) : (
              <p className="muted small">
                No real appliances found. Pair a plug in the app first (not
                dummy_*).
              </p>
            )}
          </div>
        </section>
      ) : null}

      {selectedUid && kilosave?.settings ? (
        // Live KiloSave weeks for the selected user
        <section className="panel section">
          <div className="panel-head">
            <div>
              <h2>KiloSave status</h2>
              <p className="muted small">
                Goal ₱{Number(kilosave.settings.monthlyGoal || 0)} · period{" "}
                {kilosave.settings.periodStart} → {kilosave.settings.periodEnd}
                {kilosave.settings.billingDayOfMonth
                  ? ` · billing day ${kilosave.settings.billingDayOfMonth}`
                  : " · billing day unset"}
                {kilosave.backup?.weekKey
                  ? ` · backup ready: ${kilosave.backup.label || kilosave.backup.weekKey}`
                  : ""}
              </p>
            </div>
          </div>
          <div className="support-body">
            <ul className="muted small" style={{ margin: 0, paddingLeft: 18 }}>
              {(kilosave.weeks || []).map((week) => (
                <li key={week.weekKey}>
                  <strong>{week.label}</strong> ({week.dateLabel}) —{" "}
                  {week.status}
                  {week.saved ? ` · ₱${week.amount}` : ""}
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {/* Step 3: run demo action buttons by group */}
      <section className="panel section">
        <div className="panel-head">
          <div>
            <h2>3. Run feature</h2>
            <p className="muted small">
              Usage limits and schedules on real plugs are enforced by
              kilowatch-backend — keep <code>npm start</code> running. The
              phone app can remain closed; open it only to watch the UI update.
            </p>
          </div>
        </div>
        <div className="demo-feature-grid">
          {grouped.map(([group, items]) => (
            <div key={group} className="demo-feature-group">
              <h3 className="demo-feature-group-title">{group}</h3>
              {items.map((feature) => {
                const disabled =
                  !selectedUid ||
                  busyId === feature.id ||
                  (feature.needsAppliance &&
                    (!context?.realAppliances?.length || !selectedDeviceId)) ||
                  (feature.needsLimits && !hasUsageLimits);
                return (
                  <article key={feature.id} className="demo-feature-card">
                    <div>
                      <strong>{feature.title}</strong>
                      <p className="muted small" style={{ marginTop: 6 }}>
                        {feature.body}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn primary sm"
                      disabled={Boolean(disabled)}
                      onClick={() => runFeature(feature.id)}
                    >
                      {busyId === feature.id ? "Working…" : "Run demo"}
                    </button>
                  </article>
                );
              })}
            </div>
          ))}
        </div>
      </section>

      <section className="panel section">
        <div className="panel-head">
          <div>
            <h2>Also in admin</h2>
            <p className="muted small">
              Features managed elsewhere — open these tabs during defense.
            </p>
          </div>
        </div>
        <ul className="demo-links muted small">
          <li>
            <strong>News highlights</strong> — News tab → toggle Highlight on an
            article
          </li>
          <li>
            <strong>Providers / rates</strong> — Providers tab
          </li>
          <li>
            <strong>Tips dummy + password reset</strong> — Support tab
          </li>
          <li>
            <strong>Schedules</strong> — set in app (Appliance → Schedule); fires
            through the backend even while the app is closed
          </li>
        </ul>
      </section>
    </div>
  );
}
