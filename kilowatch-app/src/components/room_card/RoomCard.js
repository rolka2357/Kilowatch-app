import { View, Text, Pressable } from "react-native";

import KwhTip from "../shared/KwhTip";
import { useThemedStyles } from "../../theme/ThemeContext";
import { createRoomCardStyles } from "./RoomCardStyles";
import { formatKwhCard } from "../../utils/formatMoney";
import { useResponsiveFontSize } from "../../utils/responsiveFont";

export default function RoomCard({
  name = "Room",
  onlineCount = 0,
  kwh = 0,
  costPhp = 0,
  onPress,
}) {
  const styles = useThemedStyles(createRoomCardStyles);
  const kwhFontSize = useResponsiveFontSize(24);
  const hasOnline = onlineCount > 0;
  const kwhLabel = formatKwhCard(kwh);

  return (
    <Pressable onPress={onPress} style={styles.pressable}>
      <View style={styles.container}>
        <View style={styles.upperTexts}>
          <Text style={styles.textRoomName} numberOfLines={2} ellipsizeMode="tail">
            {name}
          </Text>
          <Text
            style={[
              styles.textIndicator,
              !hasOnline && styles.textIndicatorOffline,
            ]}
          >
            {onlineCount} Online
          </Text>
        </View>
        <View style={styles.lowerTexts}>
          <KwhTip kwh={kwh}>
            <Text
              style={[
                styles.textRate,
                { fontSize: kwhFontSize, lineHeight: kwhFontSize + 4 },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.72}
            >
              {kwhLabel} kWh
            </Text>
          </KwhTip>
          <Text style={styles.textEstimated}>
            ₱{Number(costPhp || 0).toFixed(2)} TODAY
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
