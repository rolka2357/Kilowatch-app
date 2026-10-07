import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { onValue, ref } from "firebase/database";
import { signOut } from "firebase/auth";

import { auth, database } from "../../firebase/firebaseConfig";
import { paths } from "../../firebase/dbPaths";
import { signOutGoogle } from "../../firebase/googleSignIn";
import {
  removeProfilePhoto,
  uploadProfilePhoto,
} from "../../firebase/profilePhoto";
import { tuyaUser } from "../../tuya/tuyaBridge";
import { TUYA_NATIVE_ENABLED } from "../../tuya/tuyaNative";
import SettingsHeader from "../../components/header/settings_header/SettingsHeader";
import SettingsRow from "./components/SettingsRow";
import { useThemedStyles } from "../../theme/ThemeContext";
import { createSettingsStyles } from "./SettingsStyles";
import { userFacingError } from "../../utils/userFacingError";

import AccountIcon from "../../../assets/svg/settings/tabler_user.svg";
import MailIcon from "../../../assets/svg/shared/mail_icon.svg";
import TransferIcon from "../../../assets/svg/settings/transfer_ownership.svg";
import Arrow from "../../../assets/svg/shared/button_arrow_icon.svg";

const SESSION_UID_KEY = "@kilowatch/tuya/firebaseUid";

function initials(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export default function Account({ navigation }) {
  const styles = useThemedStyles(createSettingsStyles);
  const user = auth.currentUser;
  const [fullName, setFullName] = useState(user?.displayName || "");
  const [email, setEmail] = useState(user?.email || "");
  const [photoURL, setPhotoURL] = useState(user?.photoURL || "");
  const [emailVerified, setEmailVerified] = useState(
    Boolean(user?.emailVerified)
  );
  const [loggingOut, setLoggingOut] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);

  const refreshEmailVerified = useCallback(async () => {
    const current = auth.currentUser;
    if (!current) {
      setEmailVerified(false);
      return;
    }
    try {
      await current.reload();
    } catch {
      // Keep last known badge if reload fails (offline).
    }
    const fresh = auth.currentUser;
    setEmailVerified(Boolean(fresh?.emailVerified));
    if (fresh?.email) setEmail((prev) => prev || fresh.email);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshEmailVerified();
    }, [refreshEmailVerified])
  );

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void refreshEmailVerified();
    });
    return () => sub.remove();
  }, [refreshEmailVerified]);

  useEffect(() => {
    if (!user?.uid) return undefined;

    const unsubscribe = onValue(
      ref(database, paths.userProfile(user.uid)),
      (snapshot) => {
        const profile = snapshot.val() || {};
        setFullName(
          profile.fullName || user.displayName || user.email || "User"
        );
        setEmail(profile.email || user.email || "");
        setPhotoURL(profile.photoURL || user.photoURL || "");
      }
    );

    return unsubscribe;
  }, [user?.uid]);

  const pickAndUpload = async () => {
    try {
      let ImagePicker;
      try {
        ImagePicker = require("expo-image-picker");
      } catch (nativeError) {
        Alert.alert(
          "Update required",
          "This build is missing the photo picker. Rebuild the app with npx expo run:android."
        );
        return;
      }

      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Permission needed",
          "Allow photo library access to upload a profile picture."
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      if (result.canceled || !result.assets?.[0]?.uri) return;

      const asset = result.assets[0];
      setPhotoBusy(true);
      const nextUrl = await uploadProfilePhoto({
        uri: asset.uri,
        mimeType: asset.mimeType,
      });
      setPhotoURL(nextUrl);
    } catch (error) {
      const message = String(error?.message || error || "");
      if (message.includes("ExponentImagePicker")) {
        Alert.alert(
          "Update required",
          "This build is missing the photo picker. Rebuild the app with npx expo run:android."
        );
        return;
      }
      Alert.alert(
        "Upload failed",
        userFacingError(error, "Could not upload profile photo.")
      );
    } finally {
      setPhotoBusy(false);
    }
  };

  const handleRemovePhoto = () => {
    Alert.alert("Remove photo?", "Your profile will show initials instead.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            setPhotoBusy(true);
            await removeProfilePhoto();
            setPhotoURL("");
          } catch (error) {
            Alert.alert(
              "Remove failed",
              userFacingError(error, "Could not remove profile photo.")
            );
          } finally {
            setPhotoBusy(false);
          }
        },
      },
    ]);
  };

  const handleLogout = async () => {
    setLoggingOut(true);

    try {
      try {
        if (TUYA_NATIVE_ENABLED) {
          await tuyaUser.logout();
        }
      } catch (tuyaError) {
        console.warn("Tuya logout skipped", tuyaError);
      }

      await AsyncStorage.removeItem(SESSION_UID_KEY);
      await signOutGoogle();
      await signOut(auth);
    } catch (error) {
      Alert.alert("Logout failed", userFacingError(error));
      setLoggingOut(false);
    }
  };

  return (
    <View style={styles.screenWhite}>
      <SettingsHeader title="Account" showBack />

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileCard}>
          <Pressable
            style={styles.profileAvatarPress}
            onPress={pickAndUpload}
            disabled={photoBusy}
          >
            <View style={styles.profileAvatar}>
              {photoURL ? (
                <Image
                  source={{ uri: photoURL }}
                  style={styles.profileAvatarImage}
                />
              ) : (
                <Text style={styles.profileAvatarInitials}>
                  {initials(fullName || email)}
                </Text>
              )}
              {photoBusy ? (
                <View
                  style={[
                    styles.profileAvatarImage,
                    {
                      position: "absolute",
                      backgroundColor: "rgba(0,0,0,0.35)",
                      alignItems: "center",
                      justifyContent: "center",
                    },
                  ]}
                >
                  <ActivityIndicator color="#FFF" />
                </View>
              ) : null}
            </View>
            <View style={styles.profileAvatarBadge}>
              <Text style={{ color: "#FFF", fontSize: 16, fontWeight: "700" }}>
                +
              </Text>
            </View>
          </Pressable>

          <Text style={styles.profileHint}>
            Tap to upload a profile photo
          </Text>

          <View style={styles.profileActions}>
            <Pressable
              style={styles.profileActionBtn}
              onPress={pickAndUpload}
              disabled={photoBusy}
            >
              <Text style={styles.profileActionText}>
                {photoURL ? "Change photo" : "Upload photo"}
              </Text>
            </Pressable>
            {photoURL ? (
              <Pressable
                style={[styles.profileActionBtn, styles.profileActionDanger]}
                onPress={handleRemovePhoto}
                disabled={photoBusy}
              >
                <Text
                  style={[
                    styles.profileActionText,
                    styles.profileActionDangerText,
                  ]}
                >
                  Remove
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={styles.rowList}>
          <SettingsRow
            icon={AccountIcon}
            title="Name"
            subtitle={fullName || "Add your name"}
            onPress={() => navigation.navigate("EditName")}
          />

          <SettingsRow
            icon={MailIcon}
            title="Email Address"
            subtitle={email || "Add your email"}
            titleAccessory={
              emailVerified ? (
                <Text style={styles.verifiedText}>· Verified</Text>
              ) : null
            }
            onPress={() => navigation.navigate("EditEmail")}
          />

          <SettingsRow
            icon={TransferIcon}
            title="Transfer Ownership"
            subtitle="Hand this home to another household member"
            onPress={() => navigation.navigate("TransferOwnership")}
          />
        </View>

        <View style={styles.bottomAction}>
          <Pressable
            style={[
              styles.primaryButton,
              loggingOut && styles.primaryButtonDisabled,
            ]}
            onPress={handleLogout}
            disabled={loggingOut}
          >
            {loggingOut ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Text style={styles.primaryButtonText}>Log Out</Text>
                <Arrow color="#FFFFFF" width={14} height={12} />
              </>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
