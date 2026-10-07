import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import SettingsHeader from "../../components/header/settings_header/SettingsHeader";
import GSaveLogo from "../../../assets/svg/kilosave/gsave.svg";
import GoSaveLogo from "../../../assets/svg/kilosave/gosave.svg";
import MayaLogo from "../../../assets/svg/kilosave/maya.svg";
import MariBankLogo from "../../../assets/svg/kilosave/maribank.svg";
import SaveManualLogo from "../../../assets/svg/kilosave/save_manual.svg";
import { formatPhp } from "../../utils/formatMoney";
import {
  getKilosaveReminderTarget,
  logWeekSetAside,
} from "../../firebase/kilosave";
import useKilosave from "../../hooks/useKilosave";
import { openSavingsApp } from "../../utils/openSavingsApp";
import { userFacingError } from "../../utils/userFacingError";
import { FlashIcon } from "./KilosaveBits";
import { useThemedStyles } from "../../theme/ThemeContext";
import { createKilosaveStyles } from "./KilosaveStyles";

const APPS = [
  {
    id: "gsave",
    name: "GSave",
    subtitle: "Via Gcash",
    action: "Open App",
    schemes: ["gcash://com.mynt.gcash/app"],
    playStoreId: "com.globe.gcash.android",
    Logo: GSaveLogo,
    logs: false,
  },
  {
    id: "gosave",
    name: "GoSave",
    subtitle: "Via GoTyme - 5% interest",
    action: "Open App",
    schemes: ["gotyme://", "gotymebank://", "ph.com.gotyme://"],
    playStoreId: "ph.com.gotyme",
    Logo: GoSaveLogo,
    logs: false,
  },
  {
    id: "maya",
    name: "Maya Savings",
    subtitle: "Via Maya",
    action: "Open App",
    schemes: ["paymaya://"],
    playStoreId: "com.paymaya",
    Logo: MayaLogo,
    logs: false,
  },
  {
    id: "maribank",
    name: "MariBank",
    subtitle: "Savings",
    action: "Open App",
    schemes: ["seabankph://app/realmain", "seabankph://app/main", "bkebankph://app/realmain"],
    playStoreId: "ph.seabank.seabank",
    Logo: MariBankLogo,
    logs: false,
  },
  {
    id: "manual",
    name: "Save on my own",
    subtitle: "Save manually on your own",
    action: "Log Save",
    schemes: [],
    playStoreId: null,
    Logo: SaveManualLogo,
    logs: true,
  },
];

export default function SetAsideMoney({ navigation }) {
  const data = useKilosave();
  const [busyId, setBusyId] = useState(null);
  const styles = useThemedStyles(createKilosaveStyles);

  const amount = useMemo(
    () => Math.max(0, Number(data.weeklyGoal || data.thisWeekSetAsideAmount) || 0),
    [data.weeklyGoal, data.thisWeekSetAsideAmount]
  );

  /** Oldest missed week, or current week (supports catch-up + early save). */
  const targetWeek = useMemo(() => {
    const savedMap = Object.fromEntries(
      (data.weeksWithStatus || []).map((w) => [
        w.weekKey,
        { status: w.status },
      ])
    );
    const reminder = getKilosaveReminderTarget(
      data.period?.weeks || [],
      savedMap
    );
    if (reminder?.week) return reminder.week;
    return data.currentWeek;
  }, [data.weeksWithStatus, data.period?.weeks, data.currentWeek]);

  const alreadySaved =
    data.weeksWithStatus.find((w) => w.weekKey === targetWeek?.weekKey)
      ?.status === "saved";

  const logSave = async (via) => {
    if (!data.canEdit) {
      Alert.alert("View only", "Ask the home owner for Editor access.");
      return;
    }
    if (!data.homeUid || !targetWeek) return;
    if (alreadySaved) {
      Alert.alert("Already logged", "This week's set-aside is already saved.");
      return;
    }

    setBusyId(via);
    try {
      await logWeekSetAside({
        ownerUid: data.homeUid,
        week: targetWeek,
        amount,
        via,
        periodKey: data.period.periodKey,
      });
      Alert.alert(
        "Set aside logged",
        `${formatPhp(amount)} marked as saved for ${targetWeek.label}.`,
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      Alert.alert("Could not log", userFacingError(error));
    } finally {
      setBusyId(null);
    }
  };

  const handleSelect = async (app) => {
    if (app.logs) {
      await logSave(app.id);
      return;
    }

    // Open the installed bank app, or Play Store if it is not installed.
    setBusyId(app.id);
    try {
      const destination = await openSavingsApp({
        schemes: app.schemes,
        playStoreId: app.playStoreId,
      });

      if (destination === "store") {
        Alert.alert(
          "Install the app",
          `Download ${app.name} from Play Store, then come back here to transfer and log your set-aside.`
        );
        return;
      }

      if (alreadySaved) return;

      Alert.alert(
        "Mark as saved?",
        `Did you transfer ${formatPhp(amount)}? We'll update your KiloSave progress.`,
        [
          { text: "Not yet", style: "cancel" },
          {
            text: "Yes, log it",
            onPress: () => logSave(app.id),
          },
        ]
      );
    } catch (error) {
      Alert.alert(
        "Couldn't open app",
        userFacingError(
          error,
          "Open Play Store, install the savings app, then try again."
        )
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View style={styles.screen}>
      <SettingsHeader title="" showBack />
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.transferEyebrow}>
          TRANSFER THIS AMOUNT TO SAVINGS
        </Text>
        <Text style={styles.transferAmount}>{formatPhp(amount)}</Text>
        <Text style={styles.transferSub}>
          Based on your target goal weekly divided
        </Text>

        <View style={styles.whyCard}>
          <FlashIcon size={42} style={styles.whyIcon} />
          <View style={{ flex: 1 }}>
            <Text style={styles.howStepTitle}>Why set this aside?</Text>
            <Text style={styles.howStepBody}>
              KiloWatch estimates your appliances cost about{" "}
              {formatPhp(Math.max(amount, data.weeksWithStatus.find(
                (w) => w.weekKey === targetWeek?.weekKey
              )?.estimated || amount))}{" "}
              {targetWeek?.label ? `for ${targetWeek.label}` : "this week"}. By setting aside weekly, you're building a fund so when
              your electricity bill arrives you already have money ready. No
              stress, no scrambling.
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Where to save ?</Text>
        {APPS.map((app) => {
          const Logo = app.Logo;
          return (
            <Pressable
              key={app.id}
              style={styles.savingsRow}
              onPress={() => handleSelect(app)}
              disabled={Boolean(busyId)}
            >
              <Logo width={40} height={40} />
              <View style={styles.savingsText}>
                <Text style={styles.savingsName}>{app.name}</Text>
                <Text style={styles.savingsSub}>{app.subtitle}</Text>
              </View>
              <View style={styles.openBtn}>
                {busyId === app.id ? (
                  <ActivityIndicator color="#FE6023" />
                ) : (
                  <Text style={styles.openBtnText}>{app.action}</Text>
                )}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
