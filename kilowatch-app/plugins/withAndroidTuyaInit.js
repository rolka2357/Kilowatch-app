const fs = require("fs");
const path = require("path");
const {
  withMainApplication,
  withAndroidManifest,
  withAppBuildGradle,
  withDangerousMod,
} = require("@expo/config-plugins");
const { TUYA_CONFIG } = require("../src/tuya/tuyaConfig");

const INIT_MARKER = "TuyaCoreModule.initTuyaSDk";
const INSTALL_MARKER = "TuyaTrialDialogSuppressor.install";
const IMPORT_LINE = "import com.tuya.smart.rnsdk.core.TuyaCoreModule";
const SECURITY_AAR = "security-algorithm-1.0.0-beta.aar";
const SUPPRESSOR_FILE = "TuyaTrialDialogSuppressor.kt";
const REPLACE_ATTRS = [
  "android:allowBackup",
  "android:supportsRtl",
  "android:usesCleartextTraffic",
];

function ensureMetaData(application, name, value) {
  if (!application["meta-data"]) {
    application["meta-data"] = [];
  }
  const existing = application["meta-data"].find(
    (item) => item.$?.["android:name"] === name
  );
  if (existing) {
    existing.$["android:value"] = value;
    return;
  }
  application["meta-data"].push({
    $: {
      "android:name": name,
      "android:value": value,
    },
  });
}

function mergeToolsReplace(currentValue, extraKeys) {
  const existing = String(currentValue || "")
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean);
  return Array.from(new Set([...existing, ...extraKeys])).join(",");
}

function injectMainApplicationInit(contents, appKey, appSecret) {
  let next = contents;

  if (!next.includes(IMPORT_LINE)) {
    if (next.includes("import expo.modules.ReactNativeHostWrapper")) {
      next = next.replace(
        "import expo.modules.ReactNativeHostWrapper",
        `import expo.modules.ReactNativeHostWrapper\n\n${IMPORT_LINE}`
      );
    } else {
      next = `${IMPORT_LINE}\n${next}`;
    }
  }

  if (!next.includes(INIT_MARKER)) {
    // Prefer after loadReactNative when present — avoids MMKV SIGSEGV on some OEMs.
    const initBlock = `
    try {
      TuyaCoreModule.initTuyaSDk(
        "${appKey}",
        "${appSecret}",
        this
      )
      TuyaCoreModule.setSDKDebug(BuildConfig.DEBUG)
      // Tuya Development-edition trial dialog ("for testing only...") — auto-dismiss for demos.
      TuyaTrialDialogSuppressor.install(this)
    } catch (error: Throwable) {
      android.util.Log.e("Kilowatch", "Tuya SDK init failed", error)
    }
`;
    if (next.includes("loadReactNative(this)")) {
      next = next.replace(
        /loadReactNative\(this\)\s*\n(\s*ApplicationLifecycleDispatcher\.onApplicationCreate\(this\))?/,
        (match) => `${match}\n${initBlock}`
      );
    } else {
      next = next.replace(
        /override fun onCreate\(\) \{\s*\n\s*super\.onCreate\(\)/,
        `override fun onCreate() {\n    super.onCreate()${initBlock}`
      );
    }
  } else if (!next.includes(INSTALL_MARKER)) {
    next = next.replace(
      /TuyaCoreModule\.setSDKDebug\(BuildConfig\.DEBUG\)/,
      `TuyaCoreModule.setSDKDebug(BuildConfig.DEBUG)\n    // Tuya Development-edition trial dialog ("for testing only...") — auto-dismiss for demos.\n    TuyaTrialDialogSuppressor.install(this)`
    );
  }

  return next;
}

function injectAppBuildGradle(contents) {
  let next = contents;

  if (!next.includes("pickFirst 'lib/*/libc++_shared.so'")) {
    next = next.replace(
      /packagingOptions\s*\{/,
      `packagingOptions {\n        pickFirst 'lib/*/libc++_shared.so'`
    );
  }

  if (!next.includes("implementation fileTree(dir: 'libs', include: ['*.aar'])")) {
    next = next.replace(
      /dependencies\s*\{/,
      `dependencies {\n    implementation fileTree(dir: 'libs', include: ['*.aar'])`
    );
  }

  return next;
}

function withAndroidTuyaSecurityAar(config) {
  return withDangerousMod(config, [
    "android",
    async (mod) => {
      const projectRoot = mod.modRequest.projectRoot;
      const sourceAar = path.join(
        projectRoot,
        "native",
        "android",
        "libs",
        SECURITY_AAR
      );
      const targetDir = path.join(
        mod.modRequest.platformProjectRoot,
        "app",
        "libs"
      );
      const targetAar = path.join(targetDir, SECURITY_AAR);

      if (!fs.existsSync(sourceAar)) {
        throw new Error(
          `Missing ${SECURITY_AAR}. Download it from Tuya IoT Platform and place it at native/android/libs/${SECURITY_AAR}`
        );
      }

      fs.mkdirSync(targetDir, { recursive: true });
      fs.copyFileSync(sourceAar, targetAar);

      // Keep trial-dialog suppressor in the Android project across prebuilds.
      const sourceSuppressor = path.join(
        projectRoot,
        "native",
        "android",
        "java",
        "com",
        "kilowatch",
        "app",
        SUPPRESSOR_FILE
      );
      const targetSuppressorDir = path.join(
        mod.modRequest.platformProjectRoot,
        "app",
        "src",
        "main",
        "java",
        "com",
        "kilowatch",
        "app"
      );
      if (fs.existsSync(sourceSuppressor)) {
        fs.mkdirSync(targetSuppressorDir, { recursive: true });
        fs.copyFileSync(
          sourceSuppressor,
          path.join(targetSuppressorDir, SUPPRESSOR_FILE)
        );
      }

      return mod;
    },
  ]);
}

function withAndroidTuyaDebugManifest(config) {
  return withDangerousMod(config, [
    "android",
    async (mod) => {
      const debugManifestPath = path.join(
        mod.modRequest.platformProjectRoot,
        "app",
        "src",
        "debug",
        "AndroidManifest.xml"
      );
      if (!fs.existsSync(debugManifestPath)) {
        return mod;
      }

      const contents = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools">

    <uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW"/>

    <application
        android:usesCleartextTraffic="true"
        android:allowBackup="true"
        android:supportsRtl="true"
        tools:targetApi="28"
        tools:ignore="GoogleAppIndexingWarning"
        tools:replace="android:usesCleartextTraffic,android:allowBackup,android:supportsRtl" />
</manifest>
`;
      fs.writeFileSync(debugManifestPath, contents);
      return mod;
    },
  ]);
}

function withAndroidTuyaInit(config) {
  const appKey = TUYA_CONFIG.appKey;
  const appSecret = TUYA_CONFIG.appSecret;

  if (!appKey || !appSecret) {
    throw new Error(
      "TUYA_CONFIG.appKey and appSecret are required in src/tuya/tuyaConfig.js"
    );
  }

  config = withAndroidTuyaSecurityAar(config);
  config = withAndroidTuyaDebugManifest(config);

  config = withAndroidManifest(config, (mod) => {
    const application = mod.modResults.manifest.application?.[0];
    if (application) {
      ensureMetaData(application, "THING_SMART_APPKEY", appKey);
      ensureMetaData(application, "THING_SMART_SECRET", appSecret);
      application.$["tools:replace"] = mergeToolsReplace(
        application.$["tools:replace"],
        ["android:allowBackup", "android:supportsRtl"]
      );
    }
    return mod;
  });

  config = withMainApplication(config, (mod) => {
    if (mod.modResults.language === "kt") {
      mod.modResults.contents = injectMainApplicationInit(
        mod.modResults.contents,
        appKey,
        appSecret
      );
    }
    return mod;
  });

  config = withAppBuildGradle(config, (mod) => {
    if (mod.modResults.language === "groovy") {
      mod.modResults.contents = injectAppBuildGradle(mod.modResults.contents);
    }
    return mod;
  });

  return config;
}

module.exports = withAndroidTuyaInit;
