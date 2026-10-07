import { Alert, Pressable, Text, View } from "react-native";

import BulbIcon from "../../../assets/svg/shared/bulb-dynamic-color.svg";
import FlameStreak from "../../../assets/svg/kilosave/flame_streak.svg";
import {
  getKilosaveReminderTarget,
  isSetAsideReminderWindow,
} from "../../firebase/kilosave";
import { formatPhp, formatPhpWhole } from "../../utils/formatMoney";
import {
  CircularProgress,
  HowItWorks,
  WeekList,
} from "./KilosaveBits";
import { useTheme, useThemedStyles } from "../../theme/ThemeContext";
import { createKilosaveStyles } from "./KilosaveStyles";

function withSavedLabels(weeks) {
  return weeks.map((week) => ({
    ...week,
    savedAmountLabel: formatPhp(week.savedAmount),
  }));
}

export default function OverviewTab({ data, navigation }) {
  const styles = useThemedStyles(createKilosaveStyles);
  const { colors } = useTheme();
  const trackColor = colors.mode === "dark" ? "#3A3A3A" : "#E8E4E1";
  const {
    hasGoal,
    canEdit,
    totalSetAside,
    monthlyGoal,
    weeklyGoal,
    goalProgress,
    thisWeekSetAsideAmount,
    weeksWithStatus,
    currentWeek,
    currentWeekSaved,
    streak,
    periodEnded,
    period,
  } = data;

  const weeks = withSavedLabels(weeksWithStatus || []);
  const remaining = Math.max(0, monthlyGoal - totalSetAside);
  const progressPct = Math.min(100, Math.round(goalProgress * 100));

  const savedMap = Object.fromEntries(
    (weeksWithStatus || []).map((w) => [w.weekKey, { status: w.status }])
  );
  const reminderTarget = getKilosaveReminderTarget(
    period?.weeks || [],
    savedMap
  );
  const isMissedCatchUp = reminderTarget?.kind === "missed";
  const reminderUp =
    hasGoal &&
    Boolean(reminderTarget) &&
    (isMissedCatchUp ||
      (!periodEnded &&
        !currentWeekSaved &&
        currentWeek &&
        isSetAsideReminderWindow(currentWeek)));
  const showPlaceholderReminder =
    hasGoal &&
    !periodEnded &&
    !currentWeekSaved &&
    !reminderUp &&
    !isMissedCatchUp;
  const showSetAsideReminder = reminderUp;
  const showPeriodEnded = hasGoal && periodEnded && !isMissedCatchUp;
  const reminderAmount = weeklyGoal || thisWeekSetAsideAmount;
  const reminderWeekLabel = reminderTarget?.week?.label || currentWeek?.label;

  if (!hasGoal) {
    return (
      <View style={styles.emptyStateWrap}>
        <BulbIcon width={148} height={148} />
        <Text style={styles.emptyHero}>
          Set your weekly energy goal to track your appliance consumption and
          save up to ₱500.00 this week!
        </Text>
        {canEdit ? (
          <Pressable
            style={styles.emptyCta}
            onPress={() => navigation.navigate("SetBudgetGoal")}
          >
            <Text style={styles.primaryBtnText}>Add a target goal</Text>
          </Pressable>
        ) : (
          <Text style={styles.muted}>Ask the home owner to set a goal.</Text>
        )}
        <View style={{ width: "100%", marginTop: 4 }}>
          <HowItWorks />
        </View>
      </View>
    );
  }

  return (
    <View style={{ gap: 18 }}>
      <View style={styles.circleWrap}>
        <CircularProgress pct={progressPct} trackColor={trackColor} color={colors.primary}>
          <Text style={styles.circleAmount}>
            {totalSetAside > 0
              ? formatPhp(totalSetAside)
              : formatPhpWhole(0)}
          </Text>
          <Text style={styles.circleCaption}>Saved so far</Text>
        </CircularProgress>
      </View>

      <View style={styles.goalMetaRow}>
        <View style={styles.goalMetaCol}>
          <Text style={styles.goalMetaValue}>{formatPhp(remaining)}</Text>
          <Text style={styles.goalMetaLabel}>Remaining</Text>
        </View>
        <View style={styles.goalMetaCol}>
          <Text style={styles.goalMetaValue}>{formatPhp(monthlyGoal)}</Text>
          <Text style={styles.goalMetaLabel}>Target Goal</Text>
        </View>
      </View>

      {!periodEnded ? (
        <Text style={[styles.mutedCenter, { marginTop: -4 }]}>
          Target goal is locked for this billing period
        </Text>
      ) : null}

      {showPeriodEnded ? (
        <View style={[styles.card, styles.cardGap]}>
          <Text style={styles.cardTitle}>This billing period has ended</Text>
          <Text style={styles.muted}>
            Your 4-week set-aside period is complete. Start a new period when
            you're ready — you can set a fresh target then.
          </Text>
          {canEdit ? (
            <Pressable
              style={styles.primaryBtn}
              onPress={() => navigation.navigate("SetBudgetGoal")}
            >
              <Text style={styles.primaryBtnText}>Start a new period</Text>
            </Pressable>
          ) : null}
        </View>
      ) : showSetAsideReminder ? (
        <View style={[styles.card, styles.cardGap]}>
          <Text style={styles.cardTitle}>
            {isMissedCatchUp
              ? `You missed ${reminderWeekLabel}'s set-aside`
              : "This week's set aside reminder!"}
          </Text>
          <Text style={styles.reminderAmount}>
            {formatPhp(reminderAmount)}
          </Text>
          <Text style={styles.muted}>
            {isMissedCatchUp
              ? `Catch up by setting aside this amount for ${reminderWeekLabel}. We'll keep reminding you once a day until you do.`
              : "Transfer this to your chosen bank savings app now. By the time your bill arrives, you'll have savings ready."}
          </Text>
          {canEdit ? (
            <Pressable
              style={styles.primaryBtn}
              onPress={() => navigation.navigate("SetAsideMoney")}
            >
              <Text style={styles.primaryBtnText}>
                {isMissedCatchUp ? "Catch up now" : "Set Aside Money"}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : currentWeekSaved ? (
        <>
          <View style={styles.successBanner}>
            <FlameStreak width={38} height={44} style={{ width: 38, height: 44 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.successTitle}>
                Well Done! You've set aside your first money for our goal.
              </Text>
              <Text style={styles.successBody}>
                You've set aside your budget for this week. Keep it up!
              </Text>
            </View>
          </View>

          <View style={[styles.card, styles.cardGap, styles.placeholderCard]}>
            <Text style={styles.placeholderText}>
              Next week's set aside reminder will show here
            </Text>
            <Pressable
              style={styles.primaryBtn}
              onPress={() =>
                Alert.alert(
                  "How this helps",
                  `Your monthly target is split into 4 weekly set-asides (${formatPhp(
                    weeklyGoal || monthlyGoal / 4
                  )} each). Logging each week builds your savings before the bill arrives.`
                )
              }
            >
              <Text style={styles.primaryBtnText}>How does this help me ?</Text>
            </Pressable>
          </View>
        </>
      ) : showPlaceholderReminder ? (
        <View style={[styles.card, styles.cardGap, styles.placeholderCard]}>
          <Text style={styles.placeholderText}>
            This week's set aside reminder will show here
          </Text>
          <Pressable
            style={styles.primaryBtn}
            onPress={() =>
              Alert.alert(
                "How this helps",
                `We'll remind you to set aside ${formatPhp(
                  weeklyGoal || monthlyGoal / 4
                )} each week toward your ${formatPhp(monthlyGoal)} monthly goal.`
              )
            }
          >
              <Text style={styles.primaryBtnText}>How does this help me ?</Text>
            </Pressable>
          {canEdit ? (
            <Pressable
              onPress={() => navigation.navigate("SetAsideMoney")}
              style={{ alignSelf: "center", paddingTop: 2 }}
            >
              <Text style={styles.link}>Set aside this week early</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {streak > 1 ? (
        <View style={styles.streakBox}>
          <FlameStreak width={38} height={44} style={{ width: 38, height: 44 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.streakTitle}>{streak}-week streak!</Text>
            <Text style={styles.streakBody}>
              You've set aside your budget {streak} weeks in a row — keep it up!
            </Text>
          </View>
        </View>
      ) : null}

      <WeekList weeks={weeks} />
    </View>
  );
}
