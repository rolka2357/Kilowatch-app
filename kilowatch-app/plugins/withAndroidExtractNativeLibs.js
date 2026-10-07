/**
 * Ensures android:extractNativeLibs="true" so Tuya native libs
 * (libthingmmkv.so) are extracted to disk instead of loaded from the APK.
 * Loading from base.apk!... causes SIGSEGV SEGV_ACCERR on some Realme/Oppo devices.
 */
const { withAndroidManifest } = require("@expo/config-plugins");

function withAndroidExtractNativeLibs(config) {
  return withAndroidManifest(config, (mod) => {
    const app = mod.modResults.manifest.application?.[0];
    if (app?.$) {
      app.$["android:extractNativeLibs"] = "true";
      app.$["android:allowNativeHeapPointerTagging"] = "false";
    }
    return mod;
  });
}

module.exports = withAndroidExtractNativeLibs;
