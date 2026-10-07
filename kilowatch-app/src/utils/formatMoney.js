/** Shared PHP / kWh formatters for UI display. */

export function formatPhp(amount) {
  const value = Math.max(0, Number(amount) || 0);
  return `₱${value.toFixed(2)}`;
}

export function formatPhpWhole(amount) {
  const value = Math.max(0, Number(amount) || 0);
  return `₱${Math.round(value)}`;
}

/**
 * kWh for chips / gauges — keep real precision (no 2-decimal rounding).
 * e.g. 0.0284 stays "0.0284", not "0.03".
 */
export function formatKwhChip(kwh) {
  const value = Math.max(0, Number(kwh) || 0);
  if (!Number.isFinite(value) || value === 0) return "0";
  return value.toFixed(6).replace(/\.?0+$/, "") || "0";
}

/**
 * Card display: always two decimals, truncated (not rounded).
 * e.g. 0.02712313 → "0.02" (not "0.03").
 */
export function formatKwhCard(kwh) {
  const value = Math.max(0, Number(kwh) || 0);
  if (!Number.isFinite(value)) return "0.00";
  const truncated = Math.floor(value * 100) / 100;
  return truncated.toFixed(2);
}
