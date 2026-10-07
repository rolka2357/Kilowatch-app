/*
 * Pure KiloSave calendar/reminder logic shared by the backend scheduler and
 * focused tests. Dates are handled as YYYY-MM-DD calendar values so reminder
 * eligibility is stable in the configured backend timezone.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

function pad(value) {
  return String(value).padStart(2, "0");
}

function parseDateKey(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const utc = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isFinite(utc) ? utc : null;
}

function localDateFromKey(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function dateKeyFromUtc(utc) {
  const date = new Date(utc);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(
    date.getUTCDate()
  )}`;
}

function addDays(dateKey, days) {
  const utc = parseDateKey(dateKey);
  if (utc == null) return null;
  return dateKeyFromUtc(utc + Number(days || 0) * DAY_MS);
}

function buildBillingWeeks(periodStart) {
  if (parseDateKey(periodStart) == null) return [];
  return Array.from({ length: 4 }, (_, index) => {
    const startDate = addDays(periodStart, index * 7);
    const endDate = addDays(startDate, 6);
    return {
      weekIndex: index + 1,
      weekKey: `${startDate}_${endDate}`,
      startDate,
      endDate,
      label: `Week ${index + 1}`,
    };
  });
}

/**
 * Return the same oldest missed/current due target used by the mobile app.
 * The current week becomes due after 45% of its seven-day range has elapsed.
 */
function getReminderTarget(settings, weeksMap = {}, now = new Date()) {
  const monthlyGoal = Number(settings?.monthlyGoal || 0);
  if (!(monthlyGoal > 0)) return null;

  const weeks = buildBillingWeeks(settings?.periodStart);
  if (!weeks.length) return null;

  const todayKey = dateKeyFromUtc(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  );
  const todayUtc = parseDateKey(todayKey);

  for (const week of weeks) {
    if (weeksMap[week.weekKey]?.status === "saved") continue;
    if (todayUtc > parseDateKey(week.endDate)) {
      return { kind: "missed", week };
    }
  }

  const current = weeks.find(
    (week) =>
      todayUtc >= parseDateKey(week.startDate) &&
      todayUtc <= parseDateKey(week.endDate)
  );
  if (!current || weeksMap[current.weekKey]?.status === "saved") return null;

  const start = localDateFromKey(current.startDate)?.getTime();
  const end = localDateFromKey(current.endDate)?.getTime();
  const dueAt = start + (end - start) * 0.45;
  if (now.getTime() < dueAt) return null;

  return { kind: "due", week: current };
}

function formatPhp(value) {
  return `₱${Math.max(0, Number(value) || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function buildReminderCopy(target, weeklyGoal) {
  const amount = formatPhp(weeklyGoal);
  const label = target?.week?.label || "this week";
  if (target?.kind === "missed") {
    return {
      title: "You missed a KiloSave week",
      body: `You missed ${label}'s set-aside of ${amount}. Catch up today to stay on track.`,
    };
  }
  return {
    title: "Time to set aside",
    body: `Set aside ${amount} for ${label} toward your KiloSave goal.`,
  };
}

module.exports = {
  addDays,
  buildBillingWeeks,
  buildReminderCopy,
  getReminderTarget,
  parseDateKey,
};
