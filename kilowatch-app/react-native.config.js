/**
 * Release member APKs must not autolink expo-dev-client (DevLauncher).
 * Set KILOWATCH_RELEASE=1 before `gradlew assembleRelease`.
 */
const isReleaseApk = process.env.KILOWATCH_RELEASE === "1";

const blocked = isReleaseApk
  ? {
      "expo-dev-client": { platforms: { android: null, ios: null } },
      "expo-dev-launcher": { platforms: { android: null, ios: null } },
      "expo-dev-menu": { platforms: { android: null, ios: null } },
      "expo-dev-menu-interface": { platforms: { android: null, ios: null } },
    }
  : {};

module.exports = {
  dependencies: blocked,
};
