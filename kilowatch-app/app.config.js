const appJson = require("./app.json");

const DEV_CLIENT_PLUGIN = "expo-dev-client";

function pluginName(plugin) {
  return Array.isArray(plugin) ? plugin[0] : plugin;
}

module.exports = () => {
  // Member / release APKs: no expo-dev-client (removes "Development Build" launcher).
  // Local dev: set KILOWATCH_DEV_CLIENT=1 before prebuild, or omit KILOWATCH_RELEASE.
  const includeDevClient =
    process.env.KILOWATCH_RELEASE !== "1" &&
    process.env.KILOWATCH_DEV_CLIENT !== "0";

  const plugins = (appJson.expo.plugins || []).filter(
    (plugin) => pluginName(plugin) !== DEV_CLIENT_PLUGIN
  );

  if (includeDevClient) {
    const tuyaInitIndex = plugins.findIndex(
      (plugin) => pluginName(plugin) === "./plugins/withAndroidTuyaInit.js"
    );
    const insertAt = tuyaInitIndex >= 0 ? tuyaInitIndex + 1 : 0;
    plugins.splice(insertAt, 0, [
      DEV_CLIENT_PLUGIN,
      { launchMode: "most-recent" },
    ]);
  }

  return {
    ...appJson.expo,
    plugins,
    // Also honored when package.json is patched by scripts/build-release-apk.js
    autolinking: includeDevClient
      ? undefined
      : {
          exclude: [
            "expo-dev-client",
            "expo-dev-launcher",
            "expo-dev-menu",
            "expo-dev-menu-interface",
          ],
        },
  };
};
