/**
 * Builds a member-shareable release APK without expo-dev-client / DevLauncher.
 *
 * Usage (from kilowatch-app):
 *   node scripts/build-release-apk.js
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const os = require("os");

const root = path.join(__dirname, "..");
const pkgPath = path.join(root, "package.json");
const androidDir = path.join(root, "android");
const distDir = path.join(root, "dist");
const outApk = path.join(distDir, "kilowatch-v1.0.21-donor.apk");
const releaseApk = path.join(
  androidDir,
  "app",
  "build",
  "outputs",
  "apk",
  "release",
  "app-release.apk"
);

const DEV_EXCLUDE = [
  "expo-dev-client",
  "expo-dev-launcher",
  "expo-dev-menu",
  "expo-dev-menu-interface",
];

const pkgRaw = fs.readFileSync(pkgPath, "utf8");
const pkg = JSON.parse(pkgRaw);
const previousExpo = pkg.expo ? { ...pkg.expo } : undefined;

pkg.expo = {
  ...(pkg.expo || {}),
  autolinking: {
    ...((pkg.expo && pkg.expo.autolinking) || {}),
    exclude: DEV_EXCLUDE,
  },
};
fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

function restorePkg() {
  const restored = JSON.parse(pkgRaw);
  fs.writeFileSync(pkgPath, `${JSON.stringify(restored, null, 2)}\n`);
}

function run(command, args, opts = {}) {
  // Keep Gradle + temp off C: (builds fill C:\Users\...\.gradle and %TEMP%).
  const gradleHome =
    process.env.GRADLE_USER_HOME || "D:\\g\\.gradle";
  const tempHome = process.env.TEMP || "D:\\build-cache\\temp";
  fs.mkdirSync(gradleHome, { recursive: true });
  fs.mkdirSync(tempHome, { recursive: true });

  const result = spawnSync(command, args, {
    cwd: opts.cwd || root,
    env: {
      ...process.env,
      KILOWATCH_RELEASE: "1",
      GRADLE_USER_HOME: gradleHome,
      TEMP: tempHome,
      TMP: tempHome,
    },
    stdio: "inherit",
    shell: true,
  });
  if (result.status !== 0) {
    restorePkg();
    process.exit(result.status || 1);
  }
}

try {
  // Drop stale native build dirs that break `gradlew clean` on Windows.
  for (const rel of ["android/app/.cxx", "android/app/build"]) {
    const target = path.join(root, rel);
    if (fs.existsSync(target)) {
      try {
        fs.rmSync(target, { recursive: true, force: true });
      } catch (err) {
        console.warn(`Could not fully remove ${rel}: ${err.code || err.message}`);
      }
    }
  }

  console.log("Autolinking exclude:", DEV_EXCLUDE.join(", "));
  run(
    process.platform === "win32" ? "gradlew.bat" : "./gradlew",
    ["assembleRelease"],
    { cwd: androidDir }
  );

  if (!fs.existsSync(releaseApk)) {
    throw new Error(`Missing release APK at ${releaseApk}`);
  }
  fs.mkdirSync(distDir, { recursive: true });
  fs.copyFileSync(releaseApk, outApk);
  console.log(`\nBuilt: ${outApk}`);
} finally {
  restorePkg();
}
