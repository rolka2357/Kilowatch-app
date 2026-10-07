const { withAndroidManifest } = require("@expo/config-plugins");

const PACKAGES = [
  "com.globe.gcash.android",
  "ph.com.gotyme",
  "com.paymaya",
  "ph.seabank.seabank",
  "com.android.vending",
];

const SCHEMES = [
  "gcash",
  "gotyme",
  "gotymebank",
  "paymaya",
  "bkebankph",
  "seabankph",
  "market",
];

function ensureQueries(manifest) {
  if (!Array.isArray(manifest.queries) || manifest.queries.length === 0) {
    manifest.queries = [{}];
  }
  return manifest.queries[0];
}

function withAndroidBankQueries(config) {
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;
    const queries = ensureQueries(manifest);

    queries.package = queries.package || [];
    for (const name of PACKAGES) {
      const exists = queries.package.some(
        (row) => row.$?.["android:name"] === name
      );
      if (!exists) {
        queries.package.push({ $: { "android:name": name } });
      }
    }

    queries.intent = queries.intent || [];
    for (const scheme of SCHEMES) {
      const exists = queries.intent.some((row) =>
        (row.data || []).some((data) => data.$?.["android:scheme"] === scheme)
      );
      if (!exists) {
        queries.intent.push({
          action: [{ $: { "android:name": "android.intent.action.VIEW" } }],
          data: [{ $: { "android:scheme": scheme } }],
        });
      }
    }

    return mod;
  });
}

module.exports = withAndroidBankQueries;
