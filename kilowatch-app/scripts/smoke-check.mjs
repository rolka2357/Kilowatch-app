/**
 * Smoke tests for userFacingError + tips eligibility (Node, no RN runtime).
 * Run: node scripts/smoke-check.mjs
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// --- App helper (plain JS, no RN imports) ---
// Re-implement check by dynamically importing via path rewrite isn't needed —
// tip helpers are plain; userFacingError is plain.

async function loadAppUserFacingError() {
  const mod = await import(
    pathToFileURL(path.join(__dirname, "../src/utils/userFacingError.js")).href
  );
  return mod;
}

async function loadAppTips() {
  const mod = await import(
    pathToFileURL(path.join(__dirname, "../src/firebase/tips.js")).href
  );
  return mod;
}

function pathToFileURL(p) {
  const { pathToFileURL: toUrl } = require("node:url");
  return toUrl(p);
}

function daysAgo(n) {
  return Date.now() - n * 24 * 60 * 60 * 1000;
}

function dayKey(offsetDays) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function main() {
  const { userFacingError, GENERIC_ERROR_MESSAGE } =
    await loadAppUserFacingError();
  const {
    evaluateTipsEligibility,
    isTipsCooldownActive,
    buildLayoutFingerprint,
    tipsPreviousMonthKey,
    tipsMonthKey,
  } = await loadAppTips();

  // userFacingError
  assert.equal(
    userFacingError({ code: "auth/wrong-password" }),
    "Incorrect email or password."
  );
  assert.equal(
    userFacingError({ message: "Firebase: Error (auth/network-request-failed)." }),
    "Please check your internet connection."
  );
  assert.equal(
    userFacingError({ message: "PERMISSION_DENIED: Client doesn't have permission" }),
    GENERIC_ERROR_MESSAGE
  );
  assert.equal(
    userFacingError({ message: "Enter a room name." }),
    "Enter a room name."
  );
  assert.equal(userFacingError(null), GENERIC_ERROR_MESSAGE);

  // tips eligibility — no plugs
  let el = evaluateTipsEligibility({ appliancesMap: {} });
  assert.equal(el.canGenerate, false);
  assert.equal(el.reason, "no_plugs");

  // too new + no history
  el = evaluateTipsEligibility({
    appliancesMap: {
      a1: { createdAt: daysAgo(2), deviceId: "d1" },
    },
    devicesMap: { d1: { pairedAt: daysAgo(2) } },
    historyByDevice: {},
  });
  assert.equal(el.canGenerate, false);
  assert.equal(el.reason, "too_new");

  // mature age but thin history
  el = evaluateTipsEligibility({
    appliancesMap: {
      a1: { createdAt: daysAgo(10), deviceId: "d1" },
    },
    devicesMap: { d1: { pairedAt: daysAgo(10) } },
    historyByDevice: { d1: { daily: {} } },
  });
  assert.equal(el.canGenerate, false);
  assert.equal(el.reason, "thin_history");

  // eligible: earliest ≥7d + several history days
  const history = { daily: {} };
  for (let i = 1; i <= 5; i += 1) {
    history.daily[dayKey(-i)] = { kwh: 0.3 };
  }
  el = evaluateTipsEligibility({
    appliancesMap: {
      a1: { createdAt: daysAgo(10), deviceId: "d1" },
      a2: { createdAt: daysAgo(1), deviceId: "d2" }, // newest young — still OK (earliest rule)
    },
    devicesMap: {
      d1: { pairedAt: daysAgo(10) },
      d2: { pairedAt: daysAgo(1) },
    },
    historyByDevice: { d1: history, d2: { daily: {} } },
  });
  assert.equal(el.canGenerate, true, el.message);

  // layout fingerprint: rename should NOT change layout
  const rooms = { r1: { name: "Kitchen" } };
  const apps = { a1: { name: "Fan", roomId: "r1", deviceId: "d1" } };
  const layout1 = buildLayoutFingerprint(rooms, apps);
  const layout2 = buildLayoutFingerprint(
    { r1: { name: "Renamed Kitchen" } },
    { a1: { name: "Ceiling Fan", roomId: "r1", deviceId: "d1" } }
  );
  assert.equal(layout1, layout2);

  // add plug changes layout
  const layout3 = buildLayoutFingerprint(rooms, {
    ...apps,
    a2: { name: "TV", roomId: "r1", deviceId: "d2" },
  });
  assert.notEqual(layout1, layout3);

  // cooldown
  const weekKey = "2099-W01";
  assert.equal(
    isTipsCooldownActive(
      {
        promptVersion: "v3",
        layoutFingerprint: layout1,
        weekKey,
        rooms: [{ id: "r1" }],
      },
      layout1,
      weekKey
    ),
    true
  );

  // previous month key rolls back one calendar month
  assert.equal(tipsPreviousMonthKey(new Date(2026, 7, 1)), "2026-07"); // Aug -> Jul
  assert.equal(tipsPreviousMonthKey(new Date(2026, 0, 15)), "2025-12"); // Jan -> Dec
  assert.notEqual(tipsPreviousMonthKey(), tipsMonthKey());

  console.log("OK: smoke-check passed (" + [
    "userFacingError",
    "tips eligibility",
    "layout fingerprint",
    "cooldown",
    "tipsPreviousMonthKey",
  ].join(", ") + ")");
}

main().catch((err) => {
  console.error("FAIL:", err);
  process.exit(1);
});
