import { Linking, Pressable, ScrollView, Text, View } from "react-native";

import SettingsHeader from "../../components/header/settings_header/SettingsHeader";
import { useTheme, useThemedStyles } from "../../theme/ThemeContext";
import { createSettingsStyles } from "./SettingsStyles";

const APP_VERSION = "1.0.21";

export default function About() {
  const styles = useThemedStyles(createSettingsStyles);
  const { colors } = useTheme();

  const rows = [
    { label: "App", value: "Kilowatch" },
    { label: "Version", value: APP_VERSION },
    { label: "Platform", value: "Android" },
    { label: "Purpose", value: "Smart plug energy monitoring & savings" },
    {
      label: "Features",
      value:
        "Appliance control, schedules, usage limits, Analytics, KiloSave, Tips & News, household sharing",
    },
    {
      label: "Integrations",
      value: "Tuya smart plugs · Firebase Auth & Realtime Database",
    },
  ];

  return (
    <View style={styles.screenWhite}>
      <SettingsHeader title="About" showBack />

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 40, paddingTop: 8, gap: 12 }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            borderRadius: 12,
            padding: 16,
            gap: 8,
          }}
        >
          <Text
            style={{
              color: colors.primary,
              fontFamily: "Roobert TRIAL",
              fontSize: 22,
              fontWeight: "700",
              letterSpacing: -0.5,
            }}
          >
            Kilowatch
          </Text>
          <Text
            style={{
              color: colors.textSecondary,
              fontFamily: "Roobert TRIAL",
              fontSize: 14,
              lineHeight: 20,
            }}
          >
            Track how your home uses electricity, estimate bill costs, and save
            with smarter plug schedules and KiloSave goals.
          </Text>
        </View>

        {rows.map((row) => (
          <View
            key={row.label}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
              borderRadius: 12,
              paddingVertical: 14,
              paddingHorizontal: 14,
              gap: 4,
            }}
          >
            <Text style={styles.sectionLabel}>{row.label}</Text>
            <Text
              style={{
                color: colors.text,
                fontFamily: "Roobert TRIAL",
                fontSize: 15,
                lineHeight: 21,
                marginTop: -4,
              }}
            >
              {row.value}
            </Text>
          </View>
        ))}

        <Text style={[styles.helperText, { marginTop: 8 }]}>
          Built for Philippine households using time-of-use aware estimates and
          your electricity rate (e.g. Meralco). Pairing uses the release
          Kilowatch app with Tuya-compatible smart plugs.
        </Text>

        <Pressable
          onPress={() => Linking.openURL("mailto:support@kilowatch.app")}
          style={{ marginTop: 4 }}
        >
          <Text style={{ color: colors.primary, fontFamily: "Roobert TRIAL", fontSize: 14 }}>
            support@kilowatch.app
          </Text>
        </Pressable>

        <View style={styles.footerMeta}>
          <Text style={styles.footerMetaText}>Version {APP_VERSION}</Text>
          <Text style={styles.footerMetaText}>
            Copyright 2026 Kilowatch, Inc.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
