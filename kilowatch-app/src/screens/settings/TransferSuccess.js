import { Pressable, Text, View } from "react-native";

import SettingsHeader from "../../components/header/settings_header/SettingsHeader";
import { useTheme, useThemedStyles } from "../../theme/ThemeContext";
import { createSettingsStyles } from "./SettingsStyles";
import Arrow from "../../../assets/svg/shared/button_arrow_icon.svg";

export default function TransferSuccess({ navigation, route }) {
  const styles = useThemedStyles(createSettingsStyles);
  const { colors } = useTheme();
  const toName = route.params?.toName || "the new owner";
  const homeName = route.params?.homeName || "this home";
  const first = String(toName).trim().split(/\s+/)[0] || "the new owner";

  return (
    <View style={styles.screenWhite}>
      <SettingsHeader title="" showBack={false} />

      <View style={[styles.content, { justifyContent: "center", flex: 1 }]}>
        <View
          style={{
            alignItems: "center",
            gap: 16,
            paddingHorizontal: 8,
            marginBottom: 32,
          }}
        >
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: colors.primarySoft,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 34, color: colors.success }}>✓</Text>
          </View>
          <Text
            style={{
              color: colors.text,
              fontFamily: "Roobert TRIAL",
              fontSize: 24,
              fontWeight: "600",
              letterSpacing: -0.5,
              textAlign: "center",
            }}
          >
            Transfer successful
          </Text>
          <Text
            style={[
              styles.helperText,
              {
                marginTop: 0,
                textAlign: "center",
                fontSize: 15,
                lineHeight: 22,
              },
            ]}
          >
            {first} is now the owner of &quot;{homeName}&quot;. You&apos;ve left
            that home and have a new empty home of your own. They&apos;ll see an
            in-app notification about the transfer.
          </Text>
        </View>

        <Pressable
          style={styles.primaryButton}
          onPress={() => navigation.navigate("SettingsHome")}
        >
          <Text style={styles.primaryButtonText}>Back to Settings</Text>
          <Arrow color="#FFFFFF" width={14} height={12} />
        </Pressable>
      </View>
    </View>
  );
}
