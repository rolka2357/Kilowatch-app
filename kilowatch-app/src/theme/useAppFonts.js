import { useFonts } from "expo-font";

/**
 * Load each Roobert face under the exact family name styles will request.
 * Regular is registered as both "Roobert TRIAL" (app default) and
 * "Roobert TRIAL Regular" (PostScript-style name).
 */
export function useAppFonts() {
  const [loaded, error] = useFonts({
    "Roobert TRIAL": require("../../assets/fonts/RoobertTRIAL-Regular.otf"),
    "Roobert TRIAL Regular": require("../../assets/fonts/RoobertTRIAL-Regular.otf"),
    "Roobert TRIAL Medium": require("../../assets/fonts/RoobertTRIAL-Medium.otf"),
    "Roobert TRIAL SemiBold": require("../../assets/fonts/RoobertTRIAL-SemiBold.otf"),
    "Roobert TRIAL Bold": require("../../assets/fonts/RoobertTRIAL-Bold.otf"),
  });

  return {
    fontsLoaded: loaded,
    fontError: error,
    hasCustomFonts: true,
  };
}
