/**
 * QA helper: backup then clear usage history/live so chart empty states can be tested.
 * Restore later with: node scripts/qa-empty-charts.mjs restore
 *
 * Usage:
 *   node scripts/qa-empty-charts.mjs backup-clear [uidOrNameFragment]
 *   node scripts/qa-empty-charts.mjs restore
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "../..");
const BACKEND = path.join(ROOT, "kilowatch-backend");
const KEY = path.join(BACKEND, "serviceAccountKey.json");
const BACKUP_DIR = path.join(ROOT, ".qa-db-backup");
const MANIFEST = path.join(BACKUP_DIR, "manifest.json");

const require = createRequire(path.join(BACKEND, "package.json"));
const admin = require("firebase-admin");

const cmd = process.argv[2] || "backup-clear";
const whoArg = process.argv[3] || "Karol";

if (!fs.existsSync(KEY)) {
  console.error("Missing service account:", KEY);
  process.exit(1);
}

const sa = JSON.parse(fs.readFileSync(KEY, "utf8"));
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(sa),
    databaseURL:
      "https://energy-monitoring-system-f182d-default-rtdb.asia-southeast1.firebasedatabase.app",
  });
}

const db = admin.database();

async function findOwnerUid(fragment) {
  const snap = await db.ref("users").once("value");
  const users = snap.val() || {};
  const q = String(fragment || "").toLowerCase();
  const hits = Object.entries(users).filter(([uid, u]) => {
    const name = String(u?.displayName || u?.name || "").toLowerCase();
    const email = String(u?.email || "").toLowerCase();
    return uid === fragment || name.includes(q) || email.includes(q);
  });
  if (hits.length === 0) {
    throw new Error(`No user matched "${fragment}"`);
  }
  if (hits.length > 1) {
    console.log(
      "Multiple matches:",
      hits.map(([uid, u]) => `${uid} (${u?.displayName || u?.email || "?"})`).join(", ")
    );
  }
  const [uid, user] = hits[0];
  console.log(`Using ${uid} — ${user?.displayName || user?.email || "?"}`);
  return uid;
}

async function backupClear(uid) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const paths = {
    history: `history/${uid}`,
    live: `live/${uid}`,
    tips: `tips/${uid}`,
    historyLinks: `historyLinks/${uid}`,
  };

  const backup = {
    savedAt: new Date().toISOString(),
    uid,
    data: {},
  };

  for (const [key, p] of Object.entries(paths)) {
    const snap = await db.ref(p).once("value");
    backup.data[key] = snap.val();
    console.log(`backed up ${key}:`, snap.exists() ? "yes" : "empty");
  }

  const file = path.join(BACKUP_DIR, `${uid}-${Date.now()}.json`);
  fs.writeFileSync(file, JSON.stringify(backup, null, 2));
  fs.writeFileSync(
    MANIFEST,
    JSON.stringify({ latest: file, uid, savedAt: backup.savedAt }, null, 2)
  );
  console.log("Backup written:", file);

  // Clear history + tips so charts / tips unlocks look empty.
  await db.ref(paths.history).remove();
  await db.ref(paths.historyLinks).remove();
  await db.ref(paths.tips).remove();

  // Zero live kWh (keep switch/online so room still shows plugs).
  const live = backup.data.live || {};
  const liveUpdates = {};
  for (const [deviceId, row] of Object.entries(live)) {
    liveUpdates[deviceId] = {
      ...(row && typeof row === "object" ? row : {}),
      kwh: 0,
      powerW: 0,
      currentMa: 0,
      updatedAt: Date.now(),
    };
  }
  if (Object.keys(liveUpdates).length) {
    await db.ref(paths.live).set(liveUpdates);
  } else {
    await db.ref(paths.live).remove();
  }

  console.log(
    "Cleared history, historyLinks, tips; zeroed live kWh/power for",
    uid
  );
  console.log("Rooms/appliances/devices/KiloSave settings kept.");
  console.log('Restore later with: node scripts/qa-empty-charts.mjs restore');
}

async function restore() {
  if (!fs.existsSync(MANIFEST)) {
    throw new Error(`No manifest at ${MANIFEST}`);
  }
  const { latest, uid } = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  if (!latest || !fs.existsSync(latest)) {
    throw new Error(`Backup file missing: ${latest}`);
  }
  const backup = JSON.parse(fs.readFileSync(latest, "utf8"));
  const owner = backup.uid || uid;
  const data = backup.data || {};

  const writes = [];
  if (data.history !== undefined) {
    writes.push(db.ref(`history/${owner}`).set(data.history));
  }
  if (data.live !== undefined) {
    writes.push(db.ref(`live/${owner}`).set(data.live));
  }
  if (data.tips !== undefined) {
    writes.push(db.ref(`tips/${owner}`).set(data.tips));
  }
  if (data.historyLinks !== undefined) {
    writes.push(db.ref(`historyLinks/${owner}`).set(data.historyLinks));
  }
  await Promise.all(writes);
  console.log("Restored history/live/tips/historyLinks for", owner, "from", latest);
}

async function main() {
  if (cmd === "restore") {
    await restore();
    return;
  }
  if (cmd === "backup-clear" || cmd === "clear") {
    const uid = await findOwnerUid(whoArg);
    await backupClear(uid);
    return;
  }
  console.error("Usage: node scripts/qa-empty-charts.mjs backup-clear [name|uid]");
  console.error("       node scripts/qa-empty-charts.mjs restore");
  process.exit(1);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("FAIL:", err.message || err);
    process.exit(1);
  });
