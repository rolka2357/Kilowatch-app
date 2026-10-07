const { setDeviceSwitch, getDeviceSnapshot } = require("../src/tuyaClient");

const deviceId = "a3b07d89e693bbdff09a4k";

(async () => {
  const before = await getDeviceSnapshot(deviceId);
  console.log("before", before);
  const ok = await setDeviceSwitch(deviceId, true);
  console.log("switch on", ok);
  await new Promise((r) => setTimeout(r, 1500));
  const after = await getDeviceSnapshot(deviceId);
  console.log("after", after);
  process.exit(ok ? 0 : 1);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
