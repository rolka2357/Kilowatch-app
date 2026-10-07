import { ScrollView, Text, View } from "react-native";

import SettingsHeader from "../../components/header/settings_header/SettingsHeader";
import SettingsRow from "./components/SettingsRow";
import { useHome } from "../../context/HomeContext";
import { ROLES } from "../../firebase/household";
import { useThemedStyles } from "../../theme/ThemeContext";
import { createSettingsStyles } from "./SettingsStyles";
import HomeIcon from "../../../assets/svg/shared/home_icon.svg";

export default function Security({ navigation }) {
  const styles = useThemedStyles(createSettingsStyles);
  const { homes, activeHomeOwnerUid } = useHome();

  // Only homes where this user is currently the owner (not former owners).
  const ownedHomes = (homes || []).filter(
    (home) => home.role === ROLES.OWNER && home.status === "active"
  );

  return (
    <View style={styles.screenWhite}>
      <SettingsHeader title="Security" showBack />

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 32, paddingTop: 8 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionLabel}>Home name</Text>
        <Text style={[styles.helperText, { marginTop: 0, marginBottom: 14 }]}>
          Choose a home you own to rename it. Other household members will see
          the new name in the home switcher.
        </Text>

        {ownedHomes.length === 0 ? (
          <Text style={styles.helperText}>
            You don&apos;t own a home you can rename right now. Only the current
            owner can rename a household.
          </Text>
        ) : (
          <View style={styles.rowList}>
            {ownedHomes.map((home) => {
              const isActive = home.ownerUid === activeHomeOwnerUid;
              return (
                <SettingsRow
                  key={home.ownerUid}
                  icon={HomeIcon}
                  title={home.homeName || "Home"}
                  subtitle={
                    isActive
                      ? "Currently selected · Tap to rename"
                      : "Tap to rename"
                  }
                  onPress={() =>
                    navigation.navigate("EditHomeName", {
                      homeId: home.ownerUid,
                      homeName: home.homeName || "Home",
                    })
                  }
                />
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
