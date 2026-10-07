/*
 * Thin Tuya OpenAPI wrapper for Kilowatch smart plugs.
 * Reads live electrical DPs (power/voltage/current/switch) and sends on/off
 * commands through the cloud project configured in env. Callers treat null /
 * false returns as "device unreachable or not linked to this project."
 *
 * Optional POWER_CALIBRATION / VOLTAGE_CALIBRATION scale raw Tuya readings so
 * live W/V and derived kWh track a reference digital meter (defense accuracy).
 */
const { TuyaContext } = require("@tuya/tuya-connector-nodejs");

const config = require("./config");

const tuya = new TuyaContext({
  baseUrl: config.tuya.endpoint,
  accessKey: config.tuya.accessId,
  secretKey: config.tuya.accessSecret,
});

function applyElectricalCalibration(snapshot) {
  const powerCal = config.powerCalibration;
  const voltageCal = config.voltageCalibration;
  // Keep P ≈ V·I roughly consistent when both power and voltage are scaled.
  const currentCal =
    voltageCal > 0 ? powerCal / voltageCal : powerCal;

  const rawPowerW = snapshot.powerW;
  const rawVoltageV = snapshot.voltageV;
  const rawCurrentMa = snapshot.currentMa;

  snapshot.rawPowerW = rawPowerW;
  snapshot.rawVoltageV = rawVoltageV;
  snapshot.rawCurrentMa = rawCurrentMa;
  snapshot.powerCalibration = powerCal;
  snapshot.voltageCalibration = voltageCal;

  snapshot.powerW = rawPowerW * powerCal;
  snapshot.voltageV = rawVoltageV * voltageCal;
  snapshot.currentMa = rawCurrentMa * currentCal;
  return snapshot;
}

/**
 * Fetches device detail (online flag) and current status DPs in one call.
 * Returns { online, switchOn, powerW, voltageV, currentMa } or null when the
 * device is unknown to the cloud project.
 */
async function getDeviceSnapshot(deviceId) {
  const response = await tuya.request({
    method: "GET",
    path: `/v1.0/devices/${deviceId}`,
  });

  if (!response.success || !response.result) {
    // 1106 = permission deny -> device not linked to this cloud project.
    console.warn(
      `Tuya API error for ${deviceId}: ${response.code} ${response.msg}`
    );
    return null;
  }

  const result = response.result;
  const snapshot = {
    online: Boolean(result.online),
    switchOn: false,
    powerW: 0,
    voltageV: 0,
    currentMa: 0,
  };

  // Map common energy-plug DP codes into a stable snapshot shape.
  (result.status || []).forEach(({ code, value }) => {
    switch (code) {
      case "switch":
      case "switch_1":
        snapshot.switchOn =
          value === true || value === "true" || value === 1 || value === "1";
        break;
      case "cur_power": // 0.1 W steps
        snapshot.powerW = Number(value) / 10;
        break;
      case "cur_voltage": // 0.1 V steps
        snapshot.voltageV = Number(value) / 10;
        break;
      case "cur_current": // mA
        snapshot.currentMa = Number(value);
        break;
      default:
        break;
    }
  });

  return applyElectricalCalibration(snapshot);
}

/**
 * Turn a plug on/off via Tuya cloud.
 * Uses switch_1 (standard energy plugs); falls back to switch.
 */
async function setDeviceSwitch(deviceId, turnOn) {
  const value = Boolean(turnOn);
  const attempts = ["switch_1", "switch"];

  for (const code of attempts) {
    const response = await tuya.request({
      method: "POST",
      path: `/v1.0/devices/${deviceId}/commands`,
      body: {
        commands: [{ code, value }],
      },
    });
    if (response.success) return true;
    console.warn(
      `Tuya switch command failed (${code}) for ${deviceId}:`,
      response.code,
      response.msg
    );
  }
  return false;
}

module.exports = {
  getDeviceSnapshot,
  setDeviceSwitch,
  applyElectricalCalibration,
};
