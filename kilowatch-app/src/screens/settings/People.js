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
import AsyncStorage from "@react-native-async-storage/async-storage";
import { onValue, ref } from "firebase/database";

import PeopleHeader from "../../components/header/people_header/PeopleHeader";
import { useHome } from "../../context/HomeContext";
import { auth, database } from "../../firebase/firebaseConfig";
import { paths } from "../../firebase/dbPaths";
import {
  removeMembers,
  ROLES,
  roleLabel,
  updateMemberRole,
} from "../../firebase/household";
import RoleDropdown from "./RoleDropdown";
import { useTheme, useThemedStyles } from "../../theme/ThemeContext";
import { createPeopleStyles } from "./PeopleStyles";
import { userFacingError } from "../../utils/userFacingError";

import ArrowDown from "../../../assets/svg/settings/iconamoon_arrow-down-2-light.svg";
import CloseIcon from "../../../assets/svg/shared/close_icon.svg";
import FlashTip from "../../../assets/images/flash-dynamic-color.png";

const TIP_KEY = "@kilowatch/peopleTipDismissed";

function initials(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function MemberAvatar({ name, photoURL }) {
  const styles = useThemedStyles(createPeopleStyles);
  if (photoURL) {
    return (
      <View style={styles.avatar}>
        <Image source={{ uri: photoURL }} style={styles.avatarImage} />
      </View>
    );
  }

  return (
    <View style={styles.avatar}>
      <Text style={styles.avatarInitials}>{initials(name)}</Text>
    </View>
  );
}

export default function People({ navigation }) {
  const user = auth.currentUser;
  const { activeHomeOwnerUid, isHomeOwner } = useHome();
  const ownerUid = activeHomeOwnerUid;
  const styles = useThemedStyles(createPeopleStyles);
  const { colors } = useTheme();
  const [members, setMembers] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [liveProfiles, setLiveProfiles] = useState({});
  const [editing, setEditing] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [tipVisible, setTipVisible] = useState(true);
  const [roleTarget, setRoleTarget] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(TIP_KEY).then((value) => {
      if (value === "1") setTipVisible(false);
    });
  }, []);

  useEffect(() => {
    if (!ownerUid) return undefined;

    const unsubscribeMembers = onValue(
      ref(database, paths.homeMembers(ownerUid)),
      (snapshot) => {
        const value = snapshot.val() || {};
        setMembers(
          Object.entries(value).map(([uid, member]) => ({
            uid,
            ...member,
          }))
        );
      }
    );

    const unsubscribeInvites = onValue(
      ref(database, paths.homeInvites(ownerUid)),
      (snapshot) => {
        const value = snapshot.val() || {};
        setPendingInvites(
          Object.values(value).filter((invite) => invite?.status === "pending")
        );
      }
    );

    return () => {
      unsubscribeMembers();
      unsubscribeInvites();
    };
  }, [ownerUid]);

  // Live profile names (admin + in-app edits) — membership rows can be stale.
  const memberUidKey = useMemo(
    () =>
      members
        .map((m) => m.uid)
        .filter(Boolean)
        .sort()
        .join("|"),
    [members]
  );

  useEffect(() => {
    if (!memberUidKey) {
      setLiveProfiles({});
      return undefined;
    }
    const uids = memberUidKey.split("|");
    const unsubs = uids.map((uid) =>
      onValue(
        ref(database, paths.userProfile(uid)),
        (snapshot) => {
          const profile = snapshot.val() || {};
          setLiveProfiles((prev) => ({
            ...prev,
            [uid]: {
              fullName: profile.fullName || null,
              photoURL: profile.photoURL || null,
              email: profile.email || null,
            },
          }));
        },
        () => {}
      )
    );
    return () => unsubs.forEach((unsub) => unsub());
  }, [memberUidKey]);

  const peopleRows = useMemo(() => {
    const rows = members.map((member) => {
      const live = liveProfiles[member.uid] || {};
      return {
        ...member,
        fullName: live.fullName || member.fullName,
        photoURL: live.photoURL || member.photoURL,
        email: member.email || live.email,
      };
    });
    const memberEmails = new Set(
      rows.map((member) => String(member.email || "").toLowerCase())
    );

    pendingInvites.forEach((invite) => {
      const email = String(invite.email || "").toLowerCase();
      if (invite.inviteeUid && rows.some((m) => m.uid === invite.inviteeUid)) {
        return;
      }
      if (email && memberEmails.has(email)) return;

      rows.push({
        uid: invite.inviteeUid || `invite:${invite.inviteId}`,
        inviteId: invite.inviteId,
        email: invite.email,
        fullName: invite.email?.split("@")[0] || "Guest",
        role: invite.role || ROLES.VIEWER,
        status: "pending",
        photoURL: null,
        isInviteOnly: true,
      });
    });

    rows.sort((a, b) => {
      if (a.role === ROLES.OWNER) return -1;
      if (b.role === ROLES.OWNER) return 1;
      if (a.status === "pending" && b.status !== "pending") return 1;
      if (b.status === "pending" && a.status !== "pending") return -1;
      return String(a.fullName || a.email || "").localeCompare(
        String(b.fullName || b.email || "")
      );
    });

    return rows;
  }, [members, pendingInvites, liveProfiles]);

  const removableIds = useMemo(
    () =>
      peopleRows
        .filter(
          (member) =>
            member.role !== ROLES.OWNER &&
            !member.isInviteOnly &&
            member.uid &&
            !String(member.uid).startsWith("invite:")
        )
        .map((m) => m.uid),
    [peopleRows]
  );

  const dismissTip = async () => {
    setTipVisible(false);
    await AsyncStorage.setItem(TIP_KEY, "1");
  };

  const toggleSelected = (uid) => {
    if (!removableIds.includes(uid)) return;
    setSelectedIds((current) =>
      current.includes(uid)
        ? current.filter((id) => id !== uid)
        : [...current, uid]
    );
  };

  const handleRemoveSelected = () => {
    if (selectedIds.length === 0) return;

    Alert.alert(
      "Remove members",
      `Remove ${selectedIds.length} member${selectedIds.length > 1 ? "s" : ""} from your household?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            setSaving(true);
            try {
              await removeMembers(ownerUid, selectedIds);
              setSelectedIds([]);
              setEditing(false);
            } catch (error) {
              Alert.alert("Remove failed", userFacingError(error));
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  const handleRoleSelect = async (role) => {
    if (!roleTarget) return;
    try {
      await updateMemberRole(ownerUid, roleTarget.uid, role);
    } catch (error) {
      Alert.alert("Update failed", userFacingError(error));
    }
  };

  return (
    <View style={styles.screen}>
      <PeopleHeader
        editing={editing}
        canManage={isHomeOwner}
        onToggleEdit={() => {
          setEditing((value) => !value);
          setSelectedIds([]);
        }}
        onAdd={() => navigation.navigate("InvitePerson")}
      />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>People</Text>

        <View style={styles.memberList}>
          {peopleRows.map((member) => {
            const isOwner = member.role === ROLES.OWNER;
            const isPending = member.status === "pending";
            const selected = selectedIds.includes(member.uid);
            const displayName =
              member.fullName ||
              (isPending ? member.email?.split("@")[0] : null) ||
              member.email ||
              "Member";

            return (
              <Pressable
                key={member.uid || member.email || member.inviteId}
                style={[
                  styles.memberCard,
                  editing && selected && styles.memberCardSelected,
                ]}
                onPress={() => {
                  if (editing) toggleSelected(member.uid);
                }}
                disabled={!editing || isOwner || member.isInviteOnly}
              >
                <MemberAvatar name={displayName} photoURL={member.photoURL} />

                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{displayName}</Text>
                  <Text style={styles.memberStatus}>
                    {isPending
                      ? "Invitation Pending"
                      : isOwner
                        ? "Resident ( Owner )"
                        : "Resident"}
                  </Text>
                </View>

                {!isOwner && !isPending && isHomeOwner ? (
                  <Pressable
                    style={styles.roleButton}
                    onPress={() => setRoleTarget(member)}
                    disabled={editing}
                  >
                    <Text style={styles.roleButtonText}>
                      {roleLabel(member.role)}
                    </Text>
                    <ArrowDown
                      width={14}
                      height={14}
                      color={colors.icon}
                      stroke={colors.icon}
                    />
                  </Pressable>
                ) : !isOwner && !isPending ? (
                  <Text style={styles.roleButtonText}>
                    {roleLabel(member.role)}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.helperText}>
          Viewers can see usage. Editors can add and change appliances. Only
          the owner can invite people or change roles.
        </Text>

        {editing ? (
          <View style={styles.removeBar}>
            <Pressable
              style={[
                styles.removeButton,
                (selectedIds.length === 0 || saving) &&
                  styles.removeButtonDisabled,
              ]}
              onPress={handleRemoveSelected}
              disabled={selectedIds.length === 0 || saving}
            >
              {saving ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.removeButtonText}>
                  Remove selected ({selectedIds.length})
                </Text>
              )}
            </Pressable>
          </View>
        ) : null}

        {tipVisible ? (
          <View style={styles.tipCard}>
            <Image source={FlashTip} style={styles.tipIcon} />
            <Text style={styles.tipText}>
              Did you know? You can add household members so everyone can track
              your home's appliance usage together.
            </Text>
            <Pressable style={styles.tipClose} onPress={dismissTip}>
              <CloseIcon width={12} height={12} color={colors.icon} />
            </Pressable>
          </View>
        ) : (
          <View style={{ flex: 1 }} />
        )}
      </ScrollView>

      <RoleDropdown
        visible={Boolean(roleTarget)}
        currentRole={roleTarget?.role}
        onClose={() => setRoleTarget(null)}
        onSelect={handleRoleSelect}
      />
    </View>
  );
}
