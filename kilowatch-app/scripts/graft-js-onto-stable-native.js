/**
 * Pairing-capable release: latest JS + known-good 1.0.0 native shell.
 *
 * Full Gradle release builds crash on Realme RMX3710 inside Tuya
 * libthingmmkv.so (SIGSEGV SEGV_ACCERR) during ThingHomeSdk.init.
 * The 1.0.0 native binary does not. Graft the latest JS bundle into
 * kilowatch-v1.0.0.apk so pairing / local Tuya work again.
 *
 * Usage (from kilowatch-app):
 *   set GRADLE_USER_HOME=D:\g\.gradle
 *   set TEMP=D:\build-cache\temp
 *   cd android && gradlew :app:assembleRelease
 *   node scripts/graft-js-onto-stable-native.js
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const os = require("os");

const root = path.join(__dirname, "..");
const dist = path.join(root, "dist");
const baseApk = path.join(dist, "kilowatch-v1.0.0.apk");
const altDonor = path.join(
  root,
  "android",
  "app",
  "build",
  "outputs",
  "apk",
  "release",
  "app-release.apk"
);
const distDonor = path.join(dist, "kilowatch-v1.0.21-donor.apk");
const outApk = path.join(dist, "kilowatch-v1.0.21.apk");
const work = path.join("D:\\build-cache", "apk-graft-script");

function findBuildTools() {
  const sdk =
    process.env.ANDROID_HOME ||
    path.join(os.homedir(), "AppData", "Local", "Android", "Sdk");
  const btRoot = path.join(sdk, "build-tools");
  const versions = fs
    .readdirSync(btRoot)
    .filter((n) => /^\d/.test(n))
    .sort()
    .reverse();
  if (!versions.length) throw new Error("No Android build-tools found");
  return path.join(btRoot, versions[0]);
}

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: "inherit", shell: true });
  if (r.status !== 0) process.exit(r.status || 1);
}

function main() {
  const donor = fs.existsSync(altDonor)
    ? altDonor
    : fs.existsSync(distDonor)
      ? distDonor
      : null;
  if (!fs.existsSync(baseApk)) throw new Error(`Missing stable base: ${baseApk}`);
  if (!donor) throw new Error("Missing donor APK with new JS (assembleRelease first)");

  fs.mkdirSync(work, { recursive: true });
  const py = `
import zipfile, os
base = r${JSON.stringify(baseApk)}
donor = r${JSON.stringify(donor)}
out_unsigned = r${JSON.stringify(path.join(work, "unsigned.apk"))}
with zipfile.ZipFile(donor) as nz:
    new_bundle = nz.read("assets/index.android.bundle")
    new_cfg = nz.read("assets/app.config")
with zipfile.ZipFile(base, "r") as zin, zipfile.ZipFile(out_unsigned, "w") as zout:
    for info in zin.infolist():
        if info.filename.startswith("META-INF/"):
            continue
        data = zin.read(info.filename)
        if info.filename == "assets/index.android.bundle":
            data = new_bundle
        elif info.filename == "assets/app.config":
            data = new_cfg
        ni = zipfile.ZipInfo(info.filename)
        ni.compress_type = info.compress_type
        ni.external_attr = info.external_attr
        ni.date_time = info.date_time
        zout.writestr(ni, data)
print("unsigned", os.path.getsize(out_unsigned))
`;
  const pyFile = path.join(work, "graft.py");
  fs.writeFileSync(pyFile, py);
  run("python", [pyFile]);

  const bt = findBuildTools();
  const aligned = path.join(work, "aligned.apk");
  const ks = path.join(root, "android", "app", "debug.keystore");
  run(path.join(bt, "zipalign.exe"), [
    "-f",
    "-p",
    "4",
    path.join(work, "unsigned.apk"),
    aligned,
  ]);
  // Windows apksigner.bat + spawnSync array args mangles --ks-pass; use one cmd line.
  // APK must be the last positional argument.
  const signCmd = [
    `"${path.join(bt, "apksigner.bat")}"`,
    "sign",
    `--ks "${ks}"`,
    "--ks-pass pass:android",
    "--ks-key-alias androiddebugkey",
    "--key-pass pass:android",
    `--out "${outApk}"`,
    `"${aligned}"`,
  ].join(" ");
  const signed = spawnSync(signCmd, { stdio: "inherit", shell: true });
  if (signed.status !== 0) process.exit(signed.status || 1);
  console.log("Wrote", outApk);
  console.log(
    "Install this grafted APK for pairing (1.0.0 Tuya native + latest JS)."
  );
}

main();
