import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Text, View, StyleSheet, Platform } from "react-native";
import { ScrollView } from "react-native-gesture-handler";

const ITEM_HEIGHT = 44;
const VISIBLE = 5;
const LOOP_COPIES = 3; // odd → true middle copy

function indexFromOffset(y, length) {
  if (length <= 0) return 0;
  const index = Math.round(y / ITEM_HEIGHT);
  return Math.max(0, Math.min(length - 1, index));
}

/**
 * Alarm-style vertical wheel picker.
 * Highlight updates only when scrolling settles — keeps drag smooth.
 */
function WheelPicker({
  values = [],
  selected,
  onChange,
  width = 72,
  textColor = "#FFFFFF",
  mutedColor = "rgba(255,255,255,0.35)",
  loop = false,
}) {
  const scrollRef = useRef(null);
  const draggingRef = useRef(false);
  const ignoreMomentumRef = useRef(false);
  const selectedRef = useRef(selected);
  const activeAbsRef = useRef(0);
  const onChangeRef = useRef(onChange);

  selectedRef.current = selected;
  onChangeRef.current = onChange;

  const baseItems = useMemo(
    () =>
      values.map((v) =>
        typeof v === "object" && v != null
          ? v
          : { value: v, label: String(v) }
      ),
    [values]
  );

  const cycle = Math.max(baseItems.length, 1);
  const copies = loop && cycle > 1 ? LOOP_COPIES : 1;
  const middleCopy = Math.floor(copies / 2);

  const items = useMemo(() => {
    if (copies === 1) return baseItems;
    const out = [];
    for (let c = 0; c < copies; c += 1) {
      for (let i = 0; i < baseItems.length; i += 1) {
        out.push({
          ...baseItems[i],
          _key: `${c}-${i}-${baseItems[i].value}`,
        });
      }
    }
    return out;
  }, [baseItems, copies]);

  const valueToBaseIndex = useCallback(
    (value) => {
      const idx = baseItems.findIndex((item) => item.value === value);
      return idx < 0 ? 0 : idx;
    },
    [baseItems]
  );

  const absoluteFromValue = useCallback(
    (value) => middleCopy * cycle + valueToBaseIndex(value),
    [middleCopy, cycle, valueToBaseIndex]
  );

  const [activeAbs, setActiveAbs] = useState(() => absoluteFromValue(selected));
  activeAbsRef.current = activeAbs;

  const pad = Math.floor(VISIBLE / 2) * ITEM_HEIGHT;

  const scrollToAbs = useCallback((absIndex, animated) => {
    ignoreMomentumRef.current = true;
    scrollRef.current?.scrollTo({
      y: absIndex * ITEM_HEIGHT,
      animated: !!animated,
    });
    setTimeout(() => {
      ignoreMomentumRef.current = false;
    }, animated ? 220 : 40);
  }, []);

  const toMiddle = useCallback(
    (absIndex) => {
      if (!loop || copies === 1) return absIndex;
      const base = ((absIndex % cycle) + cycle) % cycle;
      return middleCopy * cycle + base;
    },
    [loop, copies, cycle, middleCopy]
  );

  const commitAbs = useCallback(
    (rawAbs) => {
      if (ignoreMomentumRef.current) return;

      let abs = Math.max(0, Math.min(items.length - 1, rawAbs));
      const base = ((abs % cycle) + cycle) % cycle;
      const next = baseItems[base];

      if (loop && copies > 1) {
        const copy = Math.floor(abs / cycle);
        if (copy <= 0 || copy >= copies - 1) {
          abs = toMiddle(abs);
          setActiveAbs(abs);
          activeAbsRef.current = abs;
          scrollToAbs(abs, false);
          if (next && next.value !== selectedRef.current) {
            onChangeRef.current?.(next.value);
          }
          return;
        }
      }

      if (abs !== activeAbsRef.current) {
        setActiveAbs(abs);
        activeAbsRef.current = abs;
      }

      scrollToAbs(abs, false);

      if (next && next.value !== selectedRef.current) {
        onChangeRef.current?.(next.value);
      }
    },
    [items.length, cycle, baseItems, loop, copies, toMiddle, scrollToAbs]
  );

  useEffect(() => {
    if (draggingRef.current || ignoreMomentumRef.current) return;

    const currentBase = ((activeAbsRef.current % cycle) + cycle) % cycle;
    if (baseItems[currentBase]?.value === selected) return;

    const abs = absoluteFromValue(selected);
    setActiveAbs(abs);
    activeAbsRef.current = abs;
    const timer = setTimeout(() => scrollToAbs(abs, false), 16);
    return () => clearTimeout(timer);
  }, [selected, absoluteFromValue, scrollToAbs, cycle, baseItems]);

  useEffect(() => {
    const abs = absoluteFromValue(selected);
    setActiveAbs(abs);
    activeAbsRef.current = abs;
    const timer = setTimeout(() => scrollToAbs(abs, false), 30);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onScrollBeginDrag = () => {
    draggingRef.current = true;
    ignoreMomentumRef.current = false;
  };

  const onScrollEndDrag = (event) => {
    draggingRef.current = false;
    const velocityY = event.nativeEvent.velocity?.y ?? 0;
    if (Math.abs(velocityY) > 0.05) return;
    commitAbs(indexFromOffset(event.nativeEvent.contentOffset.y, items.length));
  };

  const onMomentumScrollEnd = (event) => {
    if (draggingRef.current || ignoreMomentumRef.current) return;
    commitAbs(indexFromOffset(event.nativeEvent.contentOffset.y, items.length));
  };

  const activeBase = ((activeAbs % cycle) + cycle) % cycle;

  return (
    <View style={[styles.wrap, { width }]}>
      <View
        pointerEvents="none"
        style={[styles.highlight, { borderColor: "rgba(154,207,243,0.35)" }]}
      />
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        disableIntervalMomentum
        bounces={false}
        nestedScrollEnabled
        // No onScroll setState — update highlight only when settle
        onScrollBeginDrag={onScrollBeginDrag}
        onScrollEndDrag={onScrollEndDrag}
        onMomentumScrollEnd={onMomentumScrollEnd}
        contentContainerStyle={{ paddingVertical: pad }}
        removeClippedSubviews={Platform.OS === "android"}
        {...(Platform.OS === "android" ? { overScrollMode: "never" } : null)}
      >
        {items.map((item, index) => {
          const base = index % cycle;
          const active = base === activeBase;
          return (
            <View
              key={item._key || `${item.value}-${index}`}
              style={styles.item}
            >
              <Text
                style={[
                  styles.label,
                  { color: active ? textColor : mutedColor },
                  active && styles.labelActive,
                ]}
                // Avoid layout thrash while scrolling siblings
                allowFontScaling={false}
              >
                {item.label}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: ITEM_HEIGHT * VISIBLE,
    overflow: "hidden",
  },
  highlight: {
    position: "absolute",
    left: 0,
    right: 0,
    top: ITEM_HEIGHT * Math.floor(VISIBLE / 2),
    height: ITEM_HEIGHT,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    zIndex: 2,
  },
  item: {
    height: ITEM_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontFamily: "Roobert TRIAL",
    fontSize: 22,
  },
  labelActive: {
    fontFamily: "Roobert TRIAL Medium",
    fontSize: 26,
  },
});

export default memo(WheelPicker, (prev, next) => {
  return (
    prev.selected === next.selected &&
    prev.values === next.values &&
    prev.width === next.width &&
    prev.loop === next.loop &&
    prev.textColor === next.textColor &&
    prev.mutedColor === next.mutedColor
  );
});
export { ITEM_HEIGHT };
