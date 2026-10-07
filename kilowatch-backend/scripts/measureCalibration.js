/*
 * Calibration helper for defense accuracy checks.
 *
 * Usage:
 *   node scripts/measureCalibration.js
 *   node scripts/measureCalibration.js 80.4 255.4
 *
 * With no args: prints one raw vs calibrated Tuya snapshot.
 * With meterW meterV: also prints error % vs that digital meter reading.
 */
const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

const config = require("../src/config");
const { getDeviceSnapshot } = require("../src/tuyaClient");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(fs.readFileSync(config.firebase.credentialPath, "utf8"))
    ),
    databaseURL: config.firebase.databaseURL,
  });
}

function pctError(meter, ours) {
  if (!(meter > 0)) return null;
  return ((ours - meter) / meter) * 100;
}

async function pickDeviceId() {
  const argId = process.argv[4];
  if (argId) return argId;
  const root = (await admin.database().ref("devices").get()).val() || {};
  for (const [, devices] of Object.entries(root)) {
    for (const deviceId of Object.keys(devices || {})) {
      if (!String(deviceId).startsWith("dummy_")) return deviceId;
    }
  }
  throw new Error("No real plug found under devices/.");
}

async function main() {
  const meterW = Number(process.argv[2]);
  const meterV = Number(process.argv[3]);
  const deviceId = await pickDeviceId();
  const snap = await getDeviceSnapshot(deviceId);
  if (!snap) throw new Error(`No Tuya snapshot for ${deviceId}`);

  const rawW = Number(snap.rawPowerW ?? snap.powerW);
  const rawV = Number(snap.rawVoltageV ?? snap.voltageV);
  const calW = Number(snap.powerW);
  const calV = Number(snap.voltageV);

  const report = {
    deviceId,
    online: snap.online,
    factors: {
      power: config.powerCalibration,
      voltage: config.voltageCalibration,
    },
    tuyaRaw: { powerW: rawW, voltageV: rawV, currentMa: snap.rawCurrentMa },
    calibrated: {
      powerW: calW,
      voltageV: calV,
      currentMa: snap.currentMa,
    },
    suggestedFactorsIfUsingThisMeterSample: {
      power: rawW > 0 && meterW > 0 ? Number((meterW / rawW).toFixed(6)) : null,
      voltage: rawV > 0 && meterV > 0 ? Number((meterV / rawV).toFixed(6)) : null,
    },
  };

  if (meterW > 0 || meterV > 0) {
    report.vsDigitalMeter = {
      meter: { powerW: meterW || null, voltageV: meterV || null },
      errorPctCalibrated: {
        power: meterW > 0 ? Number(pctError(meterW, calW).toFixed(2)) : null,
        voltage: meterV > 0 ? Number(pctError(meterV, calV).toFixed(2)) : null,
      },
      errorPctRaw: {
        power: meterW > 0 ? Number(pctError(meterW, rawW).toFixed(2)) : null,
        voltage: meterV > 0 ? Number(pctError(meterV, rawV).toFixed(2)) : null,
      },
      passMax8pct: {
        power:
          meterW > 0 ? Math.abs(pctError(meterW, calW)) <= 8 : null,
        voltage:
          meterV > 0 ? Math.abs(pctError(meterV, calV)) <= 8 : null,
      },
    };
  }

  console.log(JSON.stringify(report, null, 2));
  console.log(
    "\nTip: run 3 loads, average suggestedFactors.power, set POWER_CALIBRATION in .env, restart backend, re-check."
  );
}

main().catch((error) => {
  console.error(String(error.stack || error));
  process.exit(1);
});
