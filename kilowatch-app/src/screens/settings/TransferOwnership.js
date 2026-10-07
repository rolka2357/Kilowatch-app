import { useEffect, useMemo, useState } from "react";
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

import SettingsHeader from "../../components/header/settings_header/SettingsHeader";
import { useHome } from "../../context/HomeContext";
import { auth, database } from "../../firebase/firebaseConfig";
import { paths } from "../../firebase/dbPaths";
import {
  ROLES,
  roleLabel,
  transferHomeOwnership,
} from "../../firebase/household";
import { useThemedStyles } from "../../theme/ThemeContext";
import { userFacingError } from "../../utils/userFacingError";
import Arrow from "../../../assets/svg/shared/button_arrow_icon.svg";
import { createPeopleStyles } from "./PeopleStyles";
import { createSettingsStyles } from "./SettingsStyles";

function initials(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export default function TransferOwnership({ navigation }) {
  const peopleStyles = useThemedStyles(createPeopleStyles);
  const settingsStyles = useThemedStyles(createSettingsStyles);
  const { activeHomeOwnerUid, isHomeOwner } = useHome();
  const user = auth.currentUser;
  const homeId = activeHomeOwnerUid;

  const [members, setMembers] = useState([]);
  const [selectedUid, setSelectedUid] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!homeId) return undefined;

    return onValue(ref(database, paths.homeMembers(homeId)), (snapshot) => {
      const value = snapshot.val() || {};
      setMembers(
        Object.entries(value).map(([uid, member]) => ({
          uid,
          ...member,
        }))
      );
    });
  }, [homeId]);

  const candidates = useMemo(
    () =>
      members
        .filter(
          (member) =>
            member.uid &&
            member.uid !== user?.uid &&
            member.role !== ROLES.OWNER &&
            member.status === "active"
        )
        .sort((a, b) =>
          String(a.fullName || a.email || "").localeCompare(
            String(b.fullName || b.email || "")
          )
        ),
    [members, user?.uid]
  );

  const selected = candidates.find((member) => member.uid === selectedUid);

  const handleTransfer = () => {
    if (!selected || saving) return;

    const name =
      selected.fullName || selected.email?.split("@")[0] || "this person";

    Alert.alert(
      "Transfer ownership?",
      `${name} will become the owner of this home. You'll leave this home and get a new empty home of your own.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Transfer",
          style: "destructive",
          onPress: async () => {
            setSaving(true);
            try {
              const result = await transferHomeOwnership({
                homeId,
                toUid: selected.uid,
              });
              navigation.replace("TransferSuccess", {
                toName: result?.toName || name,
                homeName: result?.homeName || "Home",
              });
            } catch (error) {
              const details = String(
                error?.details || error?.message || ""
              ).trim();
              Alert.alert(
                "Transfer failed",
                userFacingError(
                  error,
                  details && details.length < 160
                    ? details
                    : "Unable to transfer ownership."
                )
              );
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={peopleStyles.screen}>
      <SettingsHeader title="" showBack />

      <ScrollView
        style={peopleStyles.content}
        contentContainerStyle={peopleStyles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={peopleStyles.title}>Transfer Ownership</Text>
        <Text style={[peopleStyles.inviteLead, { marginBottom: 18 }]}>
          Hand this home to an active household member. Rooms, appliances, and
          KiloSave stay with the home.
        </Text>

        {!isHomeOwner ? (
          <Text style={settingsStyles.helperText}>
            Only the current owner can transfer this home.
          </Text>
        ) : candidates.length === 0 ? (
          <Text style={settingsStyles.helperText}>
            Invite someone in People first. They must accept before you can
            transfer ownership.
          </Text>
        ) : (
          <View style={peopleStyles.memberList}>
            {candidates.map((member) => {
              const selectedCard = member.uid === selectedUid;
              const displayName =
                member.fullName ||
                member.email?.split("@")[0] ||
                member.email ||
                "Member";

              return (
                <Pressable
                  key={member.uid}
                  style={[
                    peopleStyles.memberCard,
                    selectedCard && peopleStyles.memberCardSelected,
                  ]}
                  onPress={() => setSelectedUid(member.uid)}
                >
                  <View style={peopleStyles.avatar}>
                    {member.photoURL ? (
                      <Image
                        source={{ uri: member.photoURL }}
                        style={peopleStyles.avatarImage}
                      />
                    ) : (
                      <Text style={peopleStyles.avatarInitials}>
                        {initials(displayName)}
                      </Text>
                    )}
                  </View>
                  <View style={peopleStyles.memberInfo}>
                    <Text style={peopleStyles.memberName}>{displayName}</Text>
                    <Text style={peopleStyles.memberStatus}>
                      {roleLabel(member.role)}
                      {member.email ? ` · ${member.email}` : ""}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        {isHomeOwner && candidates.length > 0 ? (
          <View style={settingsStyles.bottomAction}>
            <Pressable
              style={[
                settingsStyles.primaryButton,
                (!selected || saving) && settingsStyles.primaryButtonDisabled,
              ]}
              onPress={handleTransfer}
              disabled={!selected || saving}
            >
              {saving ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Text style={settingsStyles.primaryButtonText}>
                    Transfer to {selected?.fullName?.split(" ")[0] || "member"}
                  </Text>
                  <Arrow color="#FFFFFF" width={14} height={12} />
                </>
              )}
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
