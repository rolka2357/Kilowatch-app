import { View, Text, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import AddIcon from "../../../assets/svg/shared/add_icon.svg";

import styles from "./AddApplianceStyles";

export default function AddAppliance({ onPress }) {
  return (
    <View style={styles.pressable}>
      <LinearGradient
        colors={["#FE6023", "#EEB703"]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.container}
      >
        <View style={styles.textContainer}>
          <Text style={styles.textAdd}>Add an Appliance</Text>
          <Text style={styles.textStart}>Start your energy saving journey</Text>
        </View>
        <Pressable
          style={styles.addIconContainer}
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel="Add an appliance"
        >
          <AddIcon />
        </Pressable>
      </LinearGradient>
    </View>
  );
}
