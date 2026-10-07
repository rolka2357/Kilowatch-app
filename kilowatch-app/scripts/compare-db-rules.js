const fs = require("fs");
const path = require("path");

const livePath = process.argv[2];
if (!livePath) {
  console.error("Usage: node compare-db-rules.js <live-rules.json>");
  process.exit(1);
}

const live = JSON.parse(fs.readFileSync(livePath, "utf8"));
const local = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "database.rules.json"), "utf8")
);

function pick(rulesRoot) {
  const rules = rulesRoot.rules || rulesRoot;
  return {
    owners: rules.deviceOwners,
    identifiers: rules.deviceIdentifiers,
    deviceValidate: rules.devices?.$uid?.$deviceId,
    homesAlerts: rules.homes?.$ownerUid?.alerts,
  };
}

const L = pick(local);
const V = pick(live);
const ownersWrite = String(V.owners?.$deviceId?.[".write"] || "");

const report = {
  ownersMatch: JSON.stringify(L.owners) === JSON.stringify(V.owners),
  identifiersMatch:
    JSON.stringify(L.identifiers) === JSON.stringify(V.identifiers),
  deviceValidateMatch:
    JSON.stringify(L.deviceValidate) === JSON.stringify(V.deviceValidate),
  homesAlertsPresent: Boolean(V.homesAlerts),
  liveOwnersAllowsHomeEditor: ownersWrite.includes("homes") && ownersWrite.includes("editor"),
  liveOwnersOldAuthUidOnly:
    ownersWrite.includes("newData.val() === auth.uid") && !ownersWrite.includes("homes"),
};

report.allCriticalOwnershipRulesMatch =
  report.ownersMatch && report.identifiersMatch && report.deviceValidateMatch;

console.log(JSON.stringify(report, null, 2));
process.exit(report.allCriticalOwnershipRulesMatch ? 0 : 2);
