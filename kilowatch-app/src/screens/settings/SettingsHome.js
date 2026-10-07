import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { onValue, ref } from "firebase/database";

import SettingsRow, { SettingsSwitchRow } from "./components/SettingsRow";
import { createSettingsStyles } from "./SettingsStyles";
import { createPeopleStyles } from "./PeopleStyles";
import useElectricityRate from "../../hooks/useElectricityRate";
import { formatRateLabel } from "../../firebase/electricityProviders";
import { auth, database } from "../../firebase/firebaseConfig";
import { normalizeEmailKey, paths } from "../../firebase/dbPaths";
import {
  acceptInvite,
  declineInvite,
} from "../../firebase/household";
import { useTheme, useThemedStyles } from "../../theme/ThemeContext";
import { userFacingError } from "../../utils/userFacingError";

import AccountIcon from "../../../assets/svg/settings/tabler_user.svg";
import PeopleIcon from "../../../assets/svg/settings/eva_people-outline.svg";
import SecurityIcon from "../../../assets/svg/settings/material-symbols_shield-outline.svg";
import RatesIcon from "../../../assets/svg/settings/mdi_electricity-outline.svg";
import HelpIcon from "../../../assets/svg/settings/mingcute_question-line.svg";
import AboutIcon from "../../../assets/svg/settings/ix_about.svg";
import ThemeIcon from "../../../assets/svg/settings/theme_icon.svg";
import CloseIcon from "../../../assets/svg/shared/close_icon.svg";
import Arrow from "../../../assets/svg/shared/button_arrow_icon.svg";

function InviteAvatar({ name, photoURL }) {
  const peopleStyles = useThemedStyles(createPeopleStyles);
  if (photoURL) {
    return (
      <View style={peopleStyles.avatar}>
        <Image source={{ uri: photoURL }} style={peopleStyles.avatarImage} />
      </View>
    );
  }

  const initial = String(name || "?").trim().charAt(0).toUpperCase() || "?";
  return (
    <View style={peopleStyles.avatar}>
      <Text style={peopleStyles.avatarInitials}>{initial}</Text>
    </View>
  );
}

export default function SettingsHome({ navigation }) {
  const user = auth.currentUser;
  const { providerName, rate } = useElectricityRate();
  const [invites, setInvites] = useState([]);
  const [acceptingId, setAcceptingId] = useState(null);
  const { isDark, setPreference, colors } = useTheme();
  const styles = useThemedStyles(createSettingsStyles);
  const peopleStyles = useThemedStyles(createPeopleStyles);

  useEffect(() => {
    if (!user?.uid) return undefined;

    let emailUnsub = null;
    const profileUnsub = onValue(
      ref(database, paths.userProfile(user.uid)),
      (snapshot) => {
        const profile = snapshot.val() || {};
        const emailKey =
          profile.emailKey ||
          normalizeEmailKey(profile.email || user.email || "");

        if (emailUnsub) emailUnsub();
        if (!emailKey) {
          setInvites([]);
          return;
        }

        emailUnsub = onValue(
          ref(database, paths.emailInvites(emailKey)),
          (inviteSnap) => {
            const value = inviteSnap.val() || {};
            setInvites(
              Object.values(value).filter(
                (invite) => invite?.status === "pending"
              )
            );
          }
        );
      }
    );

    return () => {
      profileUnsub();
      if (emailUnsub) emailUnsub();
    };
  }, [user?.uid, user?.email]);

  const handleAccept = async (invite) => {
    setAcceptingId(invite.inviteId);
    try {
      await acceptInvite(invite);
    } catch (error) {
      Alert.alert("Accept failed", userFacingError(error));
    } finally {
      setAcceptingId(null);
    }
  };

  const handleDecline = (invite) => {
    Alert.alert("Decline invitation?", "You can be invited again later.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Decline",
        style: "destructive",
        onPress: async () => {
          try {
            await declineInvite(invite);
          } catch (error) {
            Alert.alert("Decline failed", userFacingError(error));
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {invites.length > 0 ? (
          <View style={peopleStyles.invitationsSection}>
            <Text style={peopleStyles.invitationsTitle}>Invitations</Text>
            {invites.map((invite) => (
              <View key={invite.inviteId} style={peopleStyles.inviteCard}>
                <View style={peopleStyles.inviteCardTop}>
                  <InviteAvatar
                    name={invite.fromName}
                    photoURL={invite.fromPhotoURL}
                  />
                  <View style={peopleStyles.inviteCardTextWrap}>
                    <Text style={peopleStyles.inviteCardTitle}>
                      Join "{invite.homeName || "Home"}"
                    </Text>
                    <Text style={peopleStyles.inviteCardBody}>
                      @{invite.fromEmail || "user"} invited you to their
                      monitoring household
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => handleDecline(invite)}
                    hitSlop={10}
                  >
                    <CloseIcon width={12} height={12} color={colors.icon} />
                  </Pressable>
                </View>

                <Pressable
                  style={peopleStyles.acceptButton}
                  onPress={() => handleAccept(invite)}
                  disabled={acceptingId === invite.inviteId}
                >
                  {acceptingId === invite.inviteId ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <>
                      <Text style={peopleStyles.acceptButtonText}>
                        Accept Invite
                      </Text>
                      <Arrow color="#FFFFFF" width={12} height={10} />
                    </>
                  )}
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.rowList}>
          <SettingsRow
            icon={AccountIcon}
            title="Account"
            subtitle="Profile, photo, and ownership settings"
            onPress={() => navigation.navigate("Account")}
          />
          <SettingsRow
            icon={PeopleIcon}
            title="People"
            subtitle="Add and manage your household members"
            onPress={() => navigation.navigate("People")}
          />
          <SettingsRow
            icon={RatesIcon}
            title="Electricity Rates"
            subtitle={`${providerName || "Meralco"} — ₱${formatRateLabel(rate)}/kWh`}
            onPress={() => navigation.navigate("ElectricityRate")}
          />
          <SettingsRow
            icon={RatesIcon}
            title="Billing period"
            subtitle="Bill arrival day for KiloSave"
            onPress={() => navigation.navigate("BillingPeriod")}
          />
          <SettingsSwitchRow
            icon={ThemeIcon}
            title="Dark mode"
            subtitle={isDark ? "Dark theme is on" : "Light theme is on"}
            value={isDark}
            onValueChange={(on) => setPreference(on ? "dark" : "light")}
          />
          <SettingsRow
            icon={SecurityIcon}
            title="Security"
            subtitle="Rename homes you own"
            onPress={() => navigation.navigate("Security")}
          />
          <SettingsRow
            icon={HelpIcon}
            title="Help"
            subtitle="Need help with something ?"
            onPress={() => navigation.navigate("Help")}
          />
          <SettingsRow
            icon={AboutIcon}
            title="About"
            subtitle="App info, version, and legal"
            onPress={() => navigation.navigate("About")}
          />
        </View>

        <View style={styles.footerMeta}>
          <Text style={styles.footerMetaText}>Version 1.0.21</Text>
          <Text style={styles.footerMetaText}>
            Copyright 2026 kiloWatch, Inc.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
