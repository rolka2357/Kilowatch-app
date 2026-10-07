import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";

import CloseIcon from "../../../assets/svg/shared/close_icon.svg";
import ChartValueBubble from "../../components/charts/ChartValueBubble";
import SparseXAxis from "../../components/charts/SparseXAxis";
import NewsCard from "../../components/news_card/NewsCard";
import { calculateEnergyCostPhp } from "../../firebase/energyPricing";
import useHomeAnalytics, {
  shiftAnchor,
  canShiftAnchorForward,
  canShiftAnchorBackward,
} from "../../hooks/useHomeAnalytics";
import useHighlightNews, {
  openNewsItem,
} from "../../hooks/useHighlightNews";
import { buildAnalyticsSnapshot } from "../../utils/analyticsPeriod";
import { useTheme, useThemedStyles } from "../../theme/ThemeContext";
import { createAnalyticsStyles } from "./AnalyticsStyles";

const FLASH = require("../../../assets/images/flash-dynamic-color.png");

const PERIODS = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "year", label: "Year" },
];

const COMPARE_PERIODS = [
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "year", label: "Year" },
];

function niceTicks(maxValue) {
  const max = Math.max(Number(maxValue) || 0, 0.01);
  const rough = max * 1.15;
  const step = rough / 3;
  const magnitude = 10 ** Math.floor(Math.log10(step));
  const niceStep = Math.ceil(step / magnitude) * magnitude;
  const top = niceStep * 3;
  return [top, (top * 2) / 3, top / 3];
}

function barPopupTitle(period, bar) {
  if (!bar) return "—";
  if (period === "day") {
    return `Hour ${bar.tipLabel || bar.label || "—"}`;
  }
  if (period === "month") {
    return `Day ${bar.tipLabel || bar.label || "—"}`;
  }
  if (period === "year") {
    return bar.tipLabel || bar.label || "Month";
  }
  return bar.label || bar.tipLabel || "—";
}

const THIS_PERIOD_COLOR = "#FE6023";
const LAST_PERIOD_COLOR = "#FFC9AE";

function compareVsLabel(period) {
  if (period === "week") return "This week vs Last week";
  if (period === "month") return "This month vs Last month";
  return "This year vs Last year";
}

function compareLegendLabels(period) {
  if (period === "week") return { last: "Last week", current: "This week" };
  if (period === "month") return { last: "Last month", current: "This month" };
  return { last: "Last year", current: "This year" };
}

function formatBarValue(bar, unitWord) {
  if (!bar || bar.isGap || bar.value == null) return "No data";
  return `${Number(bar.value || 0).toFixed(2)} ${unitWord}`;
}

/** Pixel height — % heights collapse inside RN flex rows. */
const BAR_AREA_PX = 200;

function barHeightPx(value, topTick, isGap) {
  if (isGap) return 0;
  const v = Number(value) || 0;
  if (v <= 0) return 0;
  const top = Math.max(Number(topTick) || 0.01, 0.01);
  return Math.max(4, Math.round((v / top) * BAR_AREA_PX));
}

function AnalyticsBarChart({
  styles,
  bars,
  unitLabel,
  unitWord,
  period,
  selectedIndex,
  onSelectBar,
}) {
  const values = bars.map((b) =>
    b.isGap || b.value == null ? 0 : Number(b.value) || 0
  );
  const ticks = niceTicks(Math.max(...values, 0.01));
  const dense = bars.length > 12;

  const selected = selectedIndex != null ? bars[selectedIndex] : null;
  const popupValue = selected
    ? selected.isGap || selected.value == null
      ? "No data"
      : `${Number(selected.value || 0).toFixed(2)} ${unitWord || unitLabel}`
    : "";

  return (
    <View style={[styles.chartCard, { position: "relative", overflow: "visible" }]}>
      <View style={styles.chartWrap}>
        <View style={styles.yAxis}>
          {ticks.map((tick) => (
            <Text key={`y-${tick}`} style={styles.yLabel}>
              {tick >= 10 ? tick.toFixed(0) : tick.toFixed(1)}
            </Text>
          ))}
        </View>
        <View style={styles.chartBody}>
          <View style={[styles.barsRow, dense && styles.barsRowDense]}>
            {bars.map((bar, index) => {
              const isGap = Boolean(bar.isGap || bar.value == null);
              const value = isGap ? 0 : Number(bar.value) || 0;
              const height = barHeightPx(value, ticks[0], isGap);
              const isSelected = selectedIndex === index;
              return (
                <Pressable
                  key={`${bar.key || bar.label}-${index}`}
                  style={styles.barCol}
                  onPress={() => onSelectBar?.(index, bar)}
                >
                  {height > 0 ? (
                    <View
                      style={[
                        styles.barFill,
                        {
                          height,
                          opacity: value > 0 ? 1 : 0.35,
                          backgroundColor: isSelected
                            ? "#E14E14"
                            : THIS_PERIOD_COLOR,
                        },
                      ]}
                    />
                  ) : null}
                </Pressable>
              );
            })}
          </View>

          <SparseXAxis
            bars={bars}
            color={styles.xLabel?.color || "rgba(128,128,128,0.85)"}
          />
          <Text style={styles.unitHint}>{unitLabel}</Text>
        </View>
      </View>

      <ChartValueBubble
        visible={Boolean(selected)}
        title={barPopupTitle(period, selected)}
        value={popupValue}
        onDismiss={() => onSelectBar?.(null)}
        theme="light"
      />
    </View>
  );
}

/** Side-by-side this-period vs last-period bars on one chart (mock style). */
function ComparisonGroupedChart({
  styles,
  currentBars,
  previousBars,
  unitLabel,
  unitWord,
  period,
  selectedIndex,
  onSelectBar,
}) {
  const pairs = (currentBars || []).map((current, index) => ({
    current,
    previous: previousBars?.[index] || null,
    label: current?.label,
    key: current?.key || `pair-${index}`,
  }));

  const values = pairs.flatMap(({ current, previous }) => [
    current?.isGap || current?.value == null ? 0 : Number(current.value) || 0,
    previous?.isGap || previous?.value == null
      ? 0
      : Number(previous.value) || 0,
  ]);
  const ticks = niceTicks(Math.max(...values, 0.01));
  const dense = pairs.length > 12;
  const legend = compareLegendLabels(period);
  const selected =
    selectedIndex != null ? pairs[selectedIndex]?.current || null : null;
  const selectedPrev =
    selectedIndex != null ? pairs[selectedIndex]?.previous || null : null;
  const popupLines =
    selectedIndex == null
      ? []
      : [
          `${legend.current}: ${formatBarValue(selected, unitWord)}`,
          `${legend.last}: ${formatBarValue(selectedPrev, unitWord)}`,
        ];

  return (
    <View
      style={[styles.chartCard, { position: "relative", overflow: "visible" }]}
    >
      <View style={styles.compareChartHeader}>
        <Text style={styles.compareChartTitle}>
          {unitWord} of Electricity used
        </Text>
        <Text style={styles.compareChartSubtitle}>
          {compareVsLabel(period)}
        </Text>
      </View>

      <View style={styles.chartWrap}>
        <View style={styles.yAxis}>
          {ticks.map((tick) => (
            <Text key={`cy-${tick}`} style={styles.yLabel}>
              {tick >= 10 ? tick.toFixed(0) : tick.toFixed(1)}
            </Text>
          ))}
        </View>
        <View style={styles.chartBody}>
          <View style={[styles.barsRow, dense && styles.barsRowDense]}>
            {pairs.map((pair, index) => {
              const prevGap = Boolean(
                !pair.previous ||
                  pair.previous.isGap ||
                  pair.previous.value == null
              );
              const curGap = Boolean(
                pair.current?.isGap || pair.current?.value == null
              );
              const prevVal = prevGap ? 0 : Number(pair.previous.value) || 0;
              const curVal = curGap ? 0 : Number(pair.current.value) || 0;
              const prevH = barHeightPx(prevVal, ticks[0], prevGap);
              const curH = barHeightPx(curVal, ticks[0], curGap);
              const isSelected = selectedIndex === index;

              return (
                <Pressable
                  key={pair.key}
                  style={styles.barCol}
                  onPress={() => onSelectBar?.(index)}
                >
                  <View style={styles.barPair}>
                    {prevH > 0 ? (
                      <View
                        style={[
                          styles.barFill,
                          styles.barFillMuted,
                          {
                            flex: 1,
                            height: prevH,
                            opacity: prevVal > 0 ? 1 : 0.35,
                            backgroundColor: isSelected
                              ? "#F5B89A"
                              : LAST_PERIOD_COLOR,
                          },
                        ]}
                      />
                    ) : (
                      <View style={{ flex: 1 }} />
                    )}
                    {curH > 0 ? (
                      <View
                        style={[
                          styles.barFill,
                          {
                            flex: 1,
                            height: curH,
                            opacity: curVal > 0 ? 1 : 0.35,
                            backgroundColor: isSelected
                              ? "#E14E14"
                              : THIS_PERIOD_COLOR,
                          },
                        ]}
                      />
                    ) : (
                      <View style={{ flex: 1 }} />
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>

          <SparseXAxis
            bars={currentBars}
            color={styles.xLabel?.color || "rgba(128,128,128,0.85)"}
          />
          <Text style={styles.unitHint}>{unitLabel}</Text>
        </View>
      </View>

      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View
            style={[
              styles.legendSwatch,
              { backgroundColor: LAST_PERIOD_COLOR },
            ]}
          />
          <Text style={styles.legendText}>{legend.last}</Text>
        </View>
        <View style={styles.legendItem}>
          <View
            style={[
              styles.legendSwatch,
              { backgroundColor: THIS_PERIOD_COLOR },
            ]}
          />
          <Text style={styles.legendText}>{legend.current}</Text>
        </View>
      </View>

      <ChartValueBubble
        visible={selectedIndex != null}
        title={barPopupTitle(period, selected)}
        lines={popupLines}
        onDismiss={() => onSelectBar?.(null)}
        theme="light"
      />
    </View>
  );
}

function lastPeriodPhrase(period) {
  if (period === "week") return "last week";
  if (period === "month") return "last month";
  if (period === "year") return "last year";
  return "last period";
}

function formatCompareLine(comparison, unit, toDisplay, period) {
  const last = lastPeriodPhrase(period);
  if (!comparison) return null;
  if (!comparison.canCompare) {
    return `vs ${last} · Not enough data yet`;
  }
  const delta = toDisplay(comparison.delta);
  const sign = delta > 0 ? "+" : delta < 0 ? "−" : "";
  const unitWord = unit === "php" ? "₱" : "kWh";
  const pct =
    comparison.pct == null
      ? ""
      : ` · ${Math.abs(comparison.pct).toFixed(0)}% ${
          comparison.pct >= 0 ? "more" : "less"
        }`;
  return `vs ${last} · ${sign}${Math.abs(delta).toFixed(2)} ${unitWord}${pct}`;
}

export default function Analytics() {
  const navigation = useNavigation();
  const styles = useThemedStyles(createAnalyticsStyles);
  const { colors } = useTheme();
  const [unit, setUnit] = useState("kwh");
  const [period, setPeriod] = useState("day");
  const [anchor, setAnchor] = useState(() => new Date());
  const [comparePeriod, setComparePeriod] = useState("week");
  const [compareAnchor, setCompareAnchor] = useState(() => new Date());
  const [showRateBanner, setShowRateBanner] = useState(true);
  const [selectedBar, setSelectedBar] = useState(null);
  const [selectedCompareBar, setSelectedCompareBar] = useState(null);

  const data = useHomeAnalytics({ period, anchorDate: anchor });
  const { news: highlightNews } = useHighlightNews();

  const toDisplay = (kwh) => {
    if (unit === "php") {
      return calculateEnergyCostPhp(kwh, data.rate);
    }
    return Number(kwh) || 0;
  };

  const unitWord = unit === "php" ? "Php" : "kWh";
  const axisLabel = unit === "php" ? "Php (est.)" : "kWh";

  const consumptionBars = useMemo(
    () =>
      (data.consumptionBars || []).map((bar) => ({
        ...bar,
        label: bar.label,
        key: bar.key,
        isGap: bar.isGap || !bar.hasData,
        value: bar.hasData ? toDisplay(bar.kwh) : null,
      })),
    [data.consumptionBars, unit, data.rate]
  );

  const compareSnapshot = useMemo(
    () =>
      buildAnalyticsSnapshot({
        period: comparePeriod,
        anchorDate: compareAnchor,
        histories: data.histories,
        liveByDevice: data.live,
        deviceIds: data.deviceIds,
      }),
    [
      comparePeriod,
      compareAnchor,
      data.histories,
      data.live,
      data.deviceIds,
    ]
  );

  const compareCurrentBars = useMemo(
    () =>
      (compareSnapshot.consumptionBars || []).map((bar) => ({
        ...bar,
        label: bar.label,
        key: bar.key,
        isGap: bar.isGap || !bar.hasData,
        value: bar.hasData ? toDisplay(bar.kwh) : null,
      })),
    [compareSnapshot.consumptionBars, unit, data.rate]
  );

  const comparePreviousBars = useMemo(
    () =>
      (compareSnapshot.previousBars || []).map((bar) => ({
        ...bar,
        label: bar.label,
        key: bar.key,
        isGap: bar.isGap || !bar.hasData,
        value: bar.hasData ? toDisplay(bar.kwh) : null,
      })),
    [compareSnapshot.previousBars, unit, data.rate]
  );

  const handleShift = (dir) => {
    setSelectedBar(null);
    setAnchor((prev) =>
      shiftAnchor(prev, period, dir, new Date(), data.trackingStart)
    );
  };

  const handleCompareShift = (dir) => {
    setSelectedCompareBar(null);
    setCompareAnchor((prev) =>
      shiftAnchor(
        prev,
        comparePeriod,
        dir,
        new Date(),
        compareSnapshot.trackingStart
      )
    );
  };

  const compareCanGoBack = canShiftAnchorBackward(
    compareAnchor,
    comparePeriod,
    compareSnapshot.trackingStart
  );
  const compareCanGoForward = canShiftAnchorForward(
    compareAnchor,
    comparePeriod
  );

  const totalDisplay = toDisplay(data.consumptionTotal);
  const totalLabel = totalDisplay.toFixed(2);
  const compareLine = formatCompareLine(
    compareSnapshot.comparison,
    unit,
    toDisplay,
    comparePeriod
  );

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Energy Usage Analytics</Text>

        {showRateBanner ? (
          <View style={styles.rateBanner}>
            <Image source={FLASH} style={styles.rateFlash} resizeMode="contain" />
            <Text style={styles.rateText}>
              Need to change your rate? You can update your electricity rate
              anytime in{" "}
              <Text
                style={styles.rateLink}
                onPress={() => navigation.navigate("Settings")}
              >
                Settings
              </Text>
              .
            </Text>
            <Pressable
              style={styles.rateClose}
              onPress={() => setShowRateBanner(false)}
              hitSlop={8}
            >
              <CloseIcon width={12} height={12} color={colors.icon} />
            </Pressable>
          </View>
        ) : null}

        <View style={styles.unitBar}>
          {["kwh", "php"].map((id) => {
            const on = unit === id;
            return (
              <Pressable
                key={id}
                style={[styles.unitItem, on && styles.unitItemOn]}
                onPress={() => setUnit(id)}
              >
                <Text style={[styles.unitText, on && styles.unitTextOn]}>
                  {id === "kwh" ? "kWh" : "Php"}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>Your Consumption Trend</Text>

        <View style={styles.periodRow}>
          {PERIODS.map((item) => {
            const on = period === item.id;
            return (
              <Pressable
                key={item.id}
                style={[styles.periodChip, on && styles.periodChipOn]}
                onPress={() => {
                  setPeriod(item.id);
                  setAnchor(new Date());
                  setSelectedBar(null);
                }}
              >
                <Text
                  style={[
                    styles.periodChipText,
                    on && styles.periodChipTextOn,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.dateNav}>
          <Pressable
            style={[styles.dateNavBtn, !data.canGoBack && { opacity: 0.35 }]}
            onPress={() => data.canGoBack && handleShift(-1)}
            disabled={!data.canGoBack}
          >
            <Text style={styles.dateNavText}>‹</Text>
          </Pressable>
          <Text style={styles.dateNavText}>{data.periodLabel}</Text>
          <Pressable
            style={[styles.dateNavBtn, !data.canGoForward && { opacity: 0.35 }]}
            onPress={() => data.canGoForward && handleShift(1)}
            disabled={!data.canGoForward}
          >
            <Text style={styles.dateNavText}>›</Text>
          </Pressable>
        </View>

        {data.loading ? (
          <ActivityIndicator color="#FE6023" style={styles.loading} />
        ) : (
          <>
            <Text style={styles.metricValue}>{totalLabel}</Text>
            <View style={styles.metricCaptionRow}>
              <Text
                style={[
                  styles.metricCaption,
                  styles.metricCaptionFlex,
                  { marginBottom: 0, marginTop: 0 },
                ]}
                numberOfLines={2}
              >
                {unit === "php"
                  ? "Estimated Php (not your bill)"
                  : "kWh used"}
              </Text>
              <Pressable
                style={[styles.refreshBtn, data.refreshing && { opacity: 0.6 }]}
                onPress={() => data.refresh?.()}
                disabled={data.refreshing}
              >
                {data.refreshing ? (
                  <ActivityIndicator color="#FE6023" size="small" />
                ) : (
                  <Text style={styles.refreshBtnText}>Refresh</Text>
                )}
              </Pressable>
            </View>

            <AnalyticsBarChart
              styles={styles}
              bars={consumptionBars}
              unitLabel={axisLabel}
              unitWord={unitWord}
              period={period}
              selectedIndex={selectedBar}
              onSelectBar={(index) =>
                setSelectedBar((prev) =>
                  index == null || prev === index ? null : index
                )
              }
            />

            <Text style={styles.compareMeta}>
              Home total = all plugs. Room totals may differ if some plugs are
              unassigned.
            </Text>

            <Text style={[styles.sectionTitle, { marginTop: 24 }]}>
              Your Comparison Trend
            </Text>

            <View style={styles.periodRow}>
              {COMPARE_PERIODS.map((item) => {
                const on = comparePeriod === item.id;
                return (
                  <Pressable
                    key={item.id}
                    style={[styles.periodChip, on && styles.periodChipOn]}
                    onPress={() => {
                      setComparePeriod(item.id);
                      setCompareAnchor(new Date());
                      setSelectedCompareBar(null);
                    }}
                  >
                    <Text
                      style={[
                        styles.periodChipText,
                        on && styles.periodChipTextOn,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.dateNav}>
              <Pressable
                style={[
                  styles.dateNavBtn,
                  !compareCanGoBack && { opacity: 0.35 },
                ]}
                onPress={() => compareCanGoBack && handleCompareShift(-1)}
                disabled={!compareCanGoBack}
              >
                <Text style={styles.dateNavText}>‹</Text>
              </Pressable>
              <Text style={styles.dateNavText}>
                {compareSnapshot.periodLabel}
              </Text>
              <Pressable
                style={[
                  styles.dateNavBtn,
                  !compareCanGoForward && { opacity: 0.35 },
                ]}
                onPress={() => compareCanGoForward && handleCompareShift(1)}
                disabled={!compareCanGoForward}
              >
                <Text style={styles.dateNavText}>›</Text>
              </Pressable>
            </View>

            {compareLine ? (
              <Text style={styles.compareMeta} numberOfLines={1}>
                {compareLine}
              </Text>
            ) : null}

            <ComparisonGroupedChart
              styles={styles}
              currentBars={compareCurrentBars}
              previousBars={comparePreviousBars}
              unitLabel={axisLabel}
              unitWord={unitWord}
              period={comparePeriod}
              selectedIndex={selectedCompareBar}
              onSelectBar={(index) =>
                setSelectedCompareBar((prev) =>
                  index == null || prev === index ? null : index
                )
              }
            />
          </>
        )}

        {highlightNews.length > 0 ? (
          <>
            <Text style={styles.newsHeading}>Energy saving News & Tips</Text>
            <View style={styles.newsList}>
              {highlightNews.map((item) => (
                <NewsCard
                  key={item.id}
                  title={item.title}
                  description={item.description}
                  imageUrl={item.imageUrl}
                  link={item.link}
                  onPress={() => openNewsItem(item, navigation)}
                />
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}
