import { Image, Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle } from "react-native-svg";

import { useTheme, useThemedStyles } from "../../theme/ThemeContext";
import { createKilosaveStyles } from "./KilosaveStyles";

const FLASH = require("../../../assets/images/flash-dynamic-color.png");

export function ProgressBar({ pct = 0, color = "#FE6023" }) {
  const styles = useThemedStyles(createKilosaveStyles);
  const clamped = Math.max(0, Math.min(100, pct));
  const fill = clamped <= 0 ? 0 : Math.max(4, clamped);
  const dotLeft = clamped <= 0 ? 0 : Math.max(0, Math.min(100, fill));
  return (
    <View style={styles.progressTrack}>
      <View
        style={[
          styles.progressFill,
          { width: `${fill}%`, backgroundColor: color },
        ]}
      />
      <View
        style={[
          styles.progressDot,
          {
            backgroundColor: color,
            left: `${dotLeft}%`,
            marginLeft: -5,
          },
        ]}
      />
    </View>
  );
}

/**
 * Horseshoe gauge for Overview mockups — ~270° arc open at the bottom,
 * with an orange knob at the leading edge (visible even at 0%).
 */
export function CircularProgress({
  pct = 0,
  size = 248,
  stroke = 10,
  color = "#FE6023",
  trackColor = "#E8E4E1",
  children,
}) {
  const clamped = Math.max(0, Math.min(100, Number(pct) || 0));
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const sweepDeg = 270;
  const startDeg = 135; // bottom-left → clockwise → bottom-right
  const arcLen = circumference * (sweepDeg / 360);
  const gapLen = circumference - arcLen;
  const progressLen = arcLen * (clamped / 100);

  const startRad = (startDeg * Math.PI) / 180;
  const angle = startRad + ((sweepDeg * Math.PI) / 180) * (clamped / 100);
  const knobX = cx + r * Math.cos(angle);
  const knobY = cy + r * Math.sin(angle);

  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        <Circle
          cx={cx}
          cy={cy}
          r={r}
          stroke={trackColor}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${arcLen} ${gapLen}`}
          strokeLinecap="round"
          transform={`rotate(${startDeg} ${cx} ${cy})`}
        />
        {clamped > 0 ? (
          <Circle
            cx={cx}
            cy={cy}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={`${progressLen} ${circumference}`}
            strokeLinecap="round"
            transform={`rotate(${startDeg} ${cx} ${cy})`}
          />
        ) : null}
        <Circle cx={knobX} cy={knobY} r={7} fill={color} />
      </Svg>
      <View style={{ alignItems: "center", marginTop: -6 }}>{children}</View>
    </View>
  );
}

export function HowItWorks({
  steps = [
    {
      title: "Set your target goal",
      body: "Decide how much money you want to set aside or save for the whole month.",
    },
    {
      title: "Get weekly reminders",
      body: "We'll break down your goal into 4 weekly targets and send reminders to keep you on track.",
    },
    {
      title: "Track your progress",
      body: "Log your weekly progress to build your streak and stay within your planned target!",
    },
  ],
}) {
  const styles = useThemedStyles(createKilosaveStyles);
  return (
    <View style={styles.howCard}>
      <Text style={styles.howTitle}>Here's how it works</Text>
      {steps.map((step, index) => (
        <View key={step.title} style={styles.howRow}>
          <View style={styles.howBadge}>
            <Text style={styles.howBadgeText}>{index + 1}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.howStepTitle}>{step.title}</Text>
            <Text style={styles.howStepBody}>{step.body}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

export function WeekList({ weeks, title = "Weekly Breakdown" }) {
  const styles = useThemedStyles(createKilosaveStyles);
  return (
    <View style={{ gap: 10 }}>
      {title ? <Text style={styles.sectionTitle}>{title}</Text> : null}
      {weeks.map((week) => (
        <View key={week.weekKey} style={styles.weekCard}>
          <View>
            <Text style={styles.weekTitle}>{week.label}</Text>
            <Text style={styles.weekMeta}>{week.dateLabel}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            {week.status === "saved" ? (
              <>
                <Text style={styles.savedAmount}>
                  {week.savedAmountLabel ||
                    `₱${Number(week.savedAmount || 0).toFixed(2)}`}
                </Text>
                <Text style={styles.savedTag}>Saved</Text>
              </>
            ) : (
              <Text style={styles.pending}>Pending</Text>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

export function PromoCard({ onPress }) {
  const styles = useThemedStyles(createKilosaveStyles);
  const { colors } = useTheme();
  const isDark = colors.mode === "dark";
  return (
    <View style={styles.promoCard}>
      <Image
        source={require("../../../assets/images/news_placeholder.jpg")}
        style={styles.promoImage}
        resizeMode="cover"
      />
      <LinearGradient
        colors={
          isDark
            ? ["rgba(254,96,35,0.12)", "rgba(10,10,12,0.94)"]
            : ["rgba(20,14,10,0.25)", "rgba(20,14,10,0.82)"]
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.promoOverlay}
      >
        <Text style={styles.promoText}>
          Did you know that you can log your bill so that we can see how
          KiloWatch contributed
        </Text>
        <Pressable style={styles.promoBtn} onPress={onPress}>
          <Text style={styles.promoBtnText}>Log Bill</Text>
        </Pressable>
      </LinearGradient>
    </View>
  );
}

export function FlashIcon({ size = 36, style }) {
  return (
    <Image
      source={FLASH}
      style={[{ width: size, height: size }, style]}
      resizeMode="contain"
    />
  );
}
