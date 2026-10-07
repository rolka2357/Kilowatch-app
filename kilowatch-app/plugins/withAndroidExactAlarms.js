const { withAndroidManifest } = require("@expo/config-plugins");

const PERMS = [
  "android.permission.SCHEDULE_EXACT_ALARM",
  "android.permission.WAKE_LOCK",
];

function ensurePermission(manifest, name) {
  if (!Array.isArray(manifest["uses-permission"])) {
    manifest["uses-permission"] = [];
  }
  const exists = manifest["uses-permission"].some(
    (row) => row.$?.["android:name"] === name
  );
  if (!exists) {
    manifest["uses-permission"].push({ $: { "android:name": name } });
  }
}

/**
 * Exact alarms + wake lock so expo-notifications DATE triggers (KiloSave)
 * can use AlarmManager.setExactAndAllowWhileIdle without the backend.
 */
function withAndroidExactAlarms(config) {
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;
    PERMS.forEach((name) => ensurePermission(manifest, name));
    return mod;
  });
}

module.exports = withAndroidExactAlarms;
