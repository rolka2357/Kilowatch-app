import { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  Text,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";

import Logo from "../../../../assets/kilowatch_logo_no_icon.svg";
import Home from "../../../../assets/svg/shared/home_icon.svg";
import Bell from "../../../../assets/svg/shared/bell_icon.svg";
import CheckIcon from "../../../../assets/svg/settings/material-symbols_check.svg";
import { useHome } from "../../../context/HomeContext";
import { setActiveHome } from "../../../firebase/household";
import useUnreadNotificationCount from "../../../hooks/useUnreadNotificationCount";
import { useTheme, useThemedStyles } from "../../../theme/ThemeContext";
import { createBaseHeaderStyles } from "./BaseHeaderStyles";

export default function BaseHeader() {
  const navigation = useNavigation();
  const { homes, activeHomeOwnerUid, activeHomeName, authUid } = useHome();
  const [menuOpen, setMenuOpen] = useState(false);
  const styles = useThemedStyles(createBaseHeaderStyles);
  const { colors } = useTheme();
  const { count, label } = useUnreadNotificationCount();

  const hasSharedHomes = useMemo(
    () => homes.some((home) => !home.isOwn),
    [homes]
  );

  const handleHomePress = () => {
    if (hasSharedHomes) {
      setMenuOpen(true);
      return;
    }
    navigation.navigate("Appliances");
  };

  const handleSelectHome = async (ownerUid) => {
    setMenuOpen(false);
    try {
      await setActiveHome(ownerUid);
      navigation.navigate("Appliances");
    } catch (error) {
      console.warn("Switch home failed", error);
    }
  };

  const openNotifications = () => {
    navigation.navigate("Notifications");
  };

  return (
    <View style={styles.container}>
      <Pressable onPress={handleHomePress}>
        <View style={styles.iconContainer}>
          <Home />
        </View>
      </Pressable>

      <View style={styles.centerWrap}>
        <Logo />
        {hasSharedHomes || activeHomeOwnerUid !== authUid ? (
          <Pressable
            style={styles.homeChip}
            onPress={() => setMenuOpen(true)}
          >
            <CheckIcon width={12} height={12} />
            <Text style={styles.homeChipText} numberOfLines={1}>
              {activeHomeName || "My Home"}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <Pressable onPress={openNotifications} hitSlop={8}>
        <View style={styles.iconContainer}>
          <Bell width={18} height={18} color={colors.primary} />
          {count > 0 ? (
            <View style={styles.badge} accessibilityLabel={`${count} unread`}>
              <Text style={styles.badgeText}>{label}</Text>
            </View>
          ) : null}
        </View>
      </Pressable>

      <Modal
        visible={menuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuOpen(false)}
      >
        <Pressable
          style={styles.menuOverlay}
          onPress={() => setMenuOpen(false)}
        >
          <View style={styles.menuCard}>
            {homes.map((home) => {
              const selected = home.ownerUid === activeHomeOwnerUid;
              return (
                <Pressable
                  key={home.ownerUid}
                  style={styles.menuItem}
                  onPress={() => handleSelectHome(home.ownerUid)}
                >
                  {selected ? (
                    <CheckIcon width={16} height={16} />
                  ) : (
                    <View style={{ width: 16 }} />
                  )}
                  <Text style={styles.menuItemText}>{home.homeName}</Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
