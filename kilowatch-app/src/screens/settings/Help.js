import { ScrollView, Text, View } from "react-native";

import SettingsHeader from "../../components/header/settings_header/SettingsHeader";
import { useTheme, useThemedStyles } from "../../theme/ThemeContext";
import { createSettingsStyles } from "./SettingsStyles";
import TipsNewsIcon from "../../../assets/svg/shared/tips_news_icon.svg";

function Section({ title, body, colors }) {
  return (
    <View style={{ gap: 6, marginTop: 18 }}>
      <Text
        style={{
          color: colors.text,
          fontFamily: "Roobert TRIAL",
          fontSize: 16,
          fontWeight: "700",
          letterSpacing: -0.3,
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          color: colors.textSecondary,
          fontFamily: "Roobert TRIAL",
          fontSize: 14,
          lineHeight: 21,
        }}
      >
        {body}
      </Text>
    </View>
  );
}

function BillPeriodMock({ colors }) {
  return (
    <View
      style={{
        marginTop: 20,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
        borderRadius: 12,
        padding: 16,
        gap: 12,
      }}
    >
      <Text
        style={{
          color: colors.text,
          fontFamily: "Roobert TRIAL",
          fontSize: 15,
          fontWeight: "700",
        }}
      >
        Your electric bill
      </Text>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View
          style={{
            flex: 1,
            borderWidth: 1.5,
            borderColor: colors.primary,
            borderRadius: 8,
            paddingVertical: 10,
            paddingHorizontal: 10,
            backgroundColor: colors.primarySoft,
          }}
        >
          <Text
            style={{
              color: colors.primary,
              fontFamily: "Roobert TRIAL",
              fontSize: 12,
              fontWeight: "700",
            }}
          >
            Billing Period
          </Text>
          <Text
            style={{
              color: colors.text,
              fontFamily: "Roobert TRIAL",
              fontSize: 12,
              marginTop: 4,
            }}
          >
            Start – End dates
          </Text>
        </View>
        <View
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 8,
            paddingVertical: 10,
            paddingHorizontal: 10,
          }}
        >
          <Text
            style={{
              color: colors.textMuted,
              fontFamily: "Roobert TRIAL",
              fontSize: 12,
              fontWeight: "600",
            }}
          >
            Bill Date
          </Text>
          <Text
            style={{
              color: colors.textSecondary,
              fontFamily: "Roobert TRIAL",
              fontSize: 12,
              marginTop: 4,
            }}
          >
            Issue date
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function Help() {
  const styles = useThemedStyles(createSettingsStyles);
  const { colors } = useTheme();

  return (
    <View style={styles.screenWhite}>
      <SettingsHeader title="Help & Support" showBack />

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 40, paddingTop: 8 }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            borderRadius: 12,
            padding: 14,
          }}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              backgroundColor: colors.primarySoft,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <TipsNewsIcon width={22} height={22} color={colors.primary} />
          </View>
          <Text
            style={{
              flex: 1,
              color: colors.textSecondary,
              fontFamily: "Roobert TRIAL",
              fontSize: 13,
              lineHeight: 19,
            }}
          >
            Quick read but worth it — understanding billing cycles will help you
            get the most accurate cost estimates from KiloWatch.
          </Text>
        </View>

        <Text
          style={{
            color: colors.text,
            fontFamily: "Roobert TRIAL",
            fontSize: 22,
            fontWeight: "700",
            letterSpacing: -0.5,
            marginTop: 22,
            lineHeight: 28,
          }}
        >
          Why do I need to reset my billing cycle?
        </Text>
        <Text
          style={{
            color: colors.textSecondary,
            fontFamily: "Roobert TRIAL",
            fontSize: 14,
            lineHeight: 21,
            marginTop: 10,
          }}
        >
          Resetting your billing cycle tells KiloWatch when your new electricity
          bill has started, so your monthly cost estimates stay aligned with
          your actual bill.
        </Text>

        <Section
          colors={colors}
          title="What is a billing cycle reset?"
          body="It clears your monthly tracker back to zero so KiloWatch starts fresh for your new billing period."
        />
        <Section
          colors={colors}
          title="Why does it matter?"
          body="Your Meralco bill is based on a specific billing period — not a fixed calendar month. Every time a new bill arrives, a new period begins. Resetting your tracker aligns KiloWatch’s monthly estimates with your actual billing period, so your cost estimates are as accurate as possible."
        />
        <Section
          colors={colors}
          title="Where can I find my billing period?"
          body='Your billing period is printed on your electricity bill. Look for the section that says "Billing Period" or "Service Period" — it shows the start and end date of your current bill.'
        />

        <BillPeriodMock colors={colors} />

        <Text style={[styles.helperText, { marginTop: 24 }]}>
          Still stuck? Reach us at support@kilowatch.app
        </Text>
      </ScrollView>
    </View>
  );
}
