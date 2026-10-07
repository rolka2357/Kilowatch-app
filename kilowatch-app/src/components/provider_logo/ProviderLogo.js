import { Image, View } from "react-native";

import { CUSTOM_PROVIDER } from "../../firebase/electricityProviders";

export default function ProviderLogo({
  provider,
  width = 40,
  height = 40,
  style,
  imageStyle,
}) {
  const logoUrl = String(provider?.logoUrl || "").trim();
  const Logo = provider?.Logo;

  if (logoUrl) {
    return (
      <Image
        source={{ uri: logoUrl }}
        style={[
          { width, height, borderRadius: 8 },
          imageStyle,
          style,
        ]}
        resizeMode="contain"
      />
    );
  }

  const FallbackLogo = Logo || CUSTOM_PROVIDER.Logo;

  return (
    <View style={[{ width, height, alignItems: "center", justifyContent: "center" }, style]}>
      <FallbackLogo width={width} height={height} />
    </View>
  );
}
