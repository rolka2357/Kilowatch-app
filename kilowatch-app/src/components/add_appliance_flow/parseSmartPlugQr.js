/**
 * PURPOSE: Extract a usable smart-plug ID from a QR payload.
 * Box QR codes may be a plain ID, a URL, or a query string.
 */
export function parseSmartPlugQrPayload(raw) {
  const value = String(raw || "").trim();
  if (!value) return "";

  // Common printed format: digits_digits
  const underscoreId = value.match(/(\d{6,}_\d{6,})/);
  if (underscoreId) return underscoreId[1];

  try {
    if (/^https?:\/\//i.test(value) || value.includes("://")) {
      const url = new URL(value);
      const candidates = [
        url.searchParams.get("id"),
        url.searchParams.get("deviceId"),
        url.searchParams.get("uuid"),
        url.searchParams.get("token"),
        ...url.pathname.split("/").filter(Boolean),
      ].filter(Boolean);

      for (const candidate of candidates) {
        const nested = parseSmartPlugQrPayload(decodeURIComponent(candidate));
        if (nested) return nested;
      }
    }
  } catch (_) {
    // Not a URL — fall through.
  }

  // Tuya device IDs are usually alphanumeric, ~16–30 chars.
  if (/^[a-zA-Z0-9_-]{8,64}$/.test(value)) {
    return value;
  }

  return value;
}
