process.env.TZ = "Asia/Manila";

const assert = require("assert");
const {
  buildBillingWeeks,
  buildReminderCopy,
  getReminderTarget,
} = require("../src/kilosaveReminderLogic");

const settings = {
  monthlyGoal: 1000,
  weeklyGoal: 250,
  periodStart: "2026-09-28",
};
const weeks = buildBillingWeeks(settings.periodStart);

assert.strictEqual(weeks.length, 4);
assert.strictEqual(weeks[0].weekKey, "2026-09-28_2026-10-04");
assert.strictEqual(weeks[3].endDate, "2026-10-25");

// Before the app's 45%-of-week threshold, no reminder is due.
assert.strictEqual(
  getReminderTarget(settings, {}, new Date("2026-09-30T09:00:00+08:00")),
  null
);

const due = getReminderTarget(
  settings,
  {},
  new Date("2026-09-30T20:00:00+08:00")
);
assert.strictEqual(due.kind, "due");
assert.strictEqual(due.week.weekKey, weeks[0].weekKey);

const missed = getReminderTarget(
  settings,
  {},
  new Date("2026-10-05T09:00:00+08:00")
);
assert.strictEqual(missed.kind, "missed");
assert.strictEqual(missed.week.weekKey, weeks[0].weekKey);

// Saving the oldest week moves eligibility forward instead of re-notifying it.
const savedFirst = {
  [weeks[0].weekKey]: { status: "saved", savedAt: Date.now() },
};
assert.strictEqual(
  getReminderTarget(
    settings,
    savedFirst,
    new Date("2026-10-05T09:00:00+08:00")
  ),
  null
);

const copy = buildReminderCopy(due, settings.weeklyGoal);
assert.strictEqual(copy.title, "Time to set aside");
assert.match(copy.body, /₱250\.00/);

console.log("KiloSave reminder logic tests passed.");
