const fs = require("fs");
const path = require("path");
const {
  withProjectBuildGradle,
  withAndroidManifest,
  withDangerousMod,
} = require("@expo/config-plugins");

const TUYA_MAVEN_MARKER = "maven-other.tuya.com/repository/maven-releases";

const TUYA_MAVEN_REPOS = `
    maven { url 'https://maven-other.tuya.com/repository/maven-releases/' }
    maven { url 'https://maven-other.tuya.com/repository/maven-commercial-releases/' }
    maven { url 'https://maven.aliyun.com/repository/public' }`;

const REPLACE_ATTRS = [
  "android:allowBackup",
  "android:supportsRtl",
  "android:usesCleartextTraffic",
];

function mergeToolsReplace(currentValue, extraKeys) {
  const existing = String(currentValue || "")
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean);
  return Array.from(new Set([...existing, ...extraKeys])).join(",");
}

function addTuyaMavenRepos(buildGradle) {
  if (buildGradle.includes(TUYA_MAVEN_MARKER)) {
    return buildGradle;
  }

  const jitpackRepo = "maven { url 'https://www.jitpack.io' }";
  if (buildGradle.includes(jitpackRepo)) {
    return buildGradle.replace(
      jitpackRepo,
      `${jitpackRepo}${TUYA_MAVEN_REPOS}`
    );
  }

  const allProjectsRepos = /allprojects\s*\{\s*repositories\s*\{/;
  if (allProjectsRepos.test(buildGradle)) {
    return buildGradle.replace(
      allProjectsRepos,
      (match) => `${match}${TUYA_MAVEN_REPOS}`
    );
  }

  return buildGradle;
}

function withAndroidTuyaManifest(config) {
  return withAndroidManifest(config, (mod) => {
    const application = mod.modResults.manifest.application?.[0]?.$;
    if (application) {
      application["tools:replace"] = mergeToolsReplace(
        application["tools:replace"],
        ["android:allowBackup", "android:supportsRtl"]
      );
    }
    return mod;
  });
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

function withAndroidTuyaMaven(config) {
  config = withAndroidTuyaManifest(config);
  config = withAndroidTuyaDebugManifest(config);
  return withProjectBuildGradle(config, (mod) => {
    if (mod.modResults.language === "groovy") {
      mod.modResults.contents = addTuyaMavenRepos(mod.modResults.contents);
    }
    return mod;
  });
}

module.exports = withAndroidTuyaMaven;
