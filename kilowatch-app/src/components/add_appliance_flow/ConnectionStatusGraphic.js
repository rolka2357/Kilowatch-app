import { useEffect, useState } from "react";
import { View } from "react-native";

import PhoneIcon from "../../../assets/svg/add_appliance/phone_icon.svg";
import PlugIcon from "../../../assets/svg/add_appliance/plug_icon.svg";
import { useTheme, useThemedStyles } from "../../theme/ThemeContext";
import { createAddApplianceFlowStyles } from "./AddApplianceFlowStyles";

const BOX_COUNT = 6;

/**
 * Plug → progress boxes → phone graphic used by connecting / success modals.
 */
export default function ConnectionStatusGraphic({
  mode = "connecting", // "connecting" | "success"
}) {
  const styles = useThemedStyles(createAddApplianceFlowStyles);
  const { colors } = useTheme();
  const [filledCount, setFilledCount] = useState(
    mode === "success" ? BOX_COUNT : 2
  );

  useEffect(() => {
    if (mode !== "connecting") {
      setFilledCount(BOX_COUNT);
      return undefined;
    }

    setFilledCount(1);
    const timer = setInterval(() => {
      setFilledCount((current) => (current >= BOX_COUNT ? 1 : current + 1));
    }, 420);

    return () => clearInterval(timer);
  }, [mode]);

  return (
    <View style={styles.statusRow}>
      <PlugIcon width={32} height={32} color={colors.primary} stroke={colors.primary} />

      {Array.from({ length: BOX_COUNT }).map((_, index) => {
        const filled = index < filledCount;
        return (
          <View
            key={index}
            style={[styles.statusBox, filled && styles.statusBoxFilled]}
          />
        );
      })}

      <PhoneIcon width={32} height={32} color={colors.primary} stroke={colors.primary} />
    </View>
  );
}
