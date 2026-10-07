/**
 * Wall-clock helpers in a fixed IANA zone so schedules and usage limits match
 * phones in PH even if the host machine is set to UTC.
 * Exports calendar parts, minute-level fire keys for schedules, day-level keys
 * for usage limits, and Mon=0…Sun=6 day indices used by the app UI.
 */
const DEFAULT_TZ = process.env.APP_TIMEZONE || "Asia/Manila";

// Break an instant into numeric Y/M/D/H/M/S + JS weekday in the target zone.
function partsInZone(date = new Date(), timeZone = DEFAULT_TZ) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  });
  const bag = {};
  for (const part of fmt.formatToParts(date)) {
    if (part.type !== "literal") bag[part.type] = part.value;
  }
  const weekdayMap = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0 };
  return {
    year: Number(bag.year),
    month: Number(bag.month),
    day: Number(bag.day),
    hour: Number(bag.hour),
    minute: Number(bag.minute),
    second: Number(bag.second),
    jsDay: weekdayMap[bag.weekday] ?? 0,
  };
}

function pad(n) {
  return String(n).padStart(2, "0");
}

// Minute resolution — schedules fire once per matching HH:MM.
function fireKeyFor(date = new Date(), timeZone = DEFAULT_TZ) {
  const p = partsInZone(date, timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}-${pad(p.hour)}-${pad(p.minute)}`;
}

// Day resolution — each usage limit fires at most once per calendar day.
function usageLimitFireKey(date = new Date(), timeZone = DEFAULT_TZ) {
  const p = partsInZone(date, timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

function jsDayToScheduleDay(jsDay) {
  return (jsDay + 6) % 7; // Mon=0 … Sun=6
}

module.exports = {
  DEFAULT_TZ,
  partsInZone,
  fireKeyFor,
  usageLimitFireKey,
  jsDayToScheduleDay,
};
