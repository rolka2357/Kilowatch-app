import { useMemo } from "react";
import { PixelRatio, useWindowDimensions } from "react-native";

/** Design reference width — current px sizes are tuned for this and above. */
export const RESPONSIVE_BASE_WIDTH = 390;

export function scaleFontSize(baseSize, width, { minScale = 0.72 } = {}) {
  if (!baseSize || width >= RESPONSIVE_BASE_WIDTH) return baseSize;
  const scale = Math.max(minScale, width / RESPONSIVE_BASE_WIDTH);
  return PixelRatio.roundToNearestPixel(baseSize * scale);
}

export function useResponsiveFontSize(baseSize, minScale = 0.72) {
  const { width } = useWindowDimensions();
  return useMemo(
    () => scaleFontSize(baseSize, width, { minScale }),
    [baseSize, minScale, width]
  );
}
