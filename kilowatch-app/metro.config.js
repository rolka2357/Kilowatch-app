const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.transformer.babelTransformerPath = require.resolve(
  "react-native-svg-transformer"
);
config.resolver.assetExts = config.resolver.assetExts.filter(
  (ext) => ext !== "svg"
);
config.resolver.sourceExts.push("svg");

const roobertText = path.resolve(__dirname, "src/theme/RoobertText.js");
const roobertTextInput = path.resolve(
  __dirname,
  "src/theme/RoobertTextInput.js"
);

const defaultResolveRequest = config.resolver.resolveRequest;

function isTextModule(moduleName = "") {
  const normalized = moduleName.replace(/\\/g, "/");
  return (
    normalized === "react-native/Libraries/Text/Text" ||
    normalized.endsWith("/Libraries/Text/Text") ||
    normalized === "./Libraries/Text/Text"
  );
}

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const from = (context.originModulePath || "").replace(/\\/g, "/");
  const isOurWrapper =
    from.endsWith("/src/theme/RoobertText.js") ||
    from.endsWith("/src/theme/RoobertTextInput.js");

  if (!isOurWrapper) {
    if (isTextModule(moduleName)) {
      return { filePath: roobertText, type: "sourceFile" };
    }

    const normalized = String(moduleName).replace(/\\/g, "/");
    if (
      normalized ===
        "react-native/Libraries/Components/TextInput/TextInput" ||
      normalized.endsWith("/Libraries/Components/TextInput/TextInput") ||
      normalized === "./Libraries/Components/TextInput/TextInput"
    ) {
      return { filePath: roobertTextInput, type: "sourceFile" };
    }
  }

  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
