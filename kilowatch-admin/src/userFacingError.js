/**
 * Maps Firebase / raw errors to short messages safe for admin UI banners.
 * Prefers known auth codes; otherwise cleans technical strings or falls back
 * to a generic message so stack traces never reach operators.
 */

const GENERIC = "Something went wrong. Please try again.";

/** Known Firebase Auth / permission codes → operator-friendly copy. */
const CODE_MESSAGES = {
  "auth/email-already-in-use": "This email is already registered.",
  "auth/invalid-email": "Enter a valid email address.",
  "auth/weak-password": "Password is too weak. Use at least 6 characters.",
  "auth/user-not-found": "No account found with this email.",
  "auth/wrong-password": "Incorrect email or password.",
  "auth/invalid-credential": "Incorrect email or password.",
  "auth/too-many-requests": "Too many attempts. Please wait and try again.",
  "auth/network-request-failed": "Please check your internet connection.",
  "auth/popup-closed-by-user": "Sign-in was cancelled.",
  "auth/cancelled-popup-request": "Sign-in was cancelled.",
  "permission-denied": "You don’t have permission to do that.",
};

/** Strip Firebase prefixes / code suffixes from raw messages. */
function cleanRawMessage(raw) {
  return String(raw || "")
    .replace(/^Firebase:\s*/i, "")
    .replace(/\s*\((?:auth|functions)\/[^)]+\)\.?\s*$/i, "")
    .trim();
}

/** Heuristic: hide stack traces and SDK noise from the UI. */
function looksTechnical(message) {
  if (!message) return true;
  if (message.length > 180) return true;
  return /firebase|permission[_ -]?denied|PERMISSION_DENIED|network request failed|internal error|https?:\/\/|at \w+\(|ECONNREFUSED|undefined is not|null is not|Exception|stack|Callable|HttpsError/i.test(
    message
  );
}

/** User-facing error copy for admin UI banners. */
export function userFacingError(error, fallback = GENERIC) {
  // Prefer exact / partial code matches
  const code = String(error?.code || "");
  if (CODE_MESSAGES[code]) return CODE_MESSAGES[code];

  for (const [key, value] of Object.entries(CODE_MESSAGES)) {
    if (code.includes(key) || String(error?.message || "").includes(key)) {
      return value;
    }
  }

  const cleaned = cleanRawMessage(
    error?.message || (typeof error === "string" ? error : "")
  );

  if (!cleaned || looksTechnical(cleaned)) {
    return fallback || GENERIC;
  }

  return cleaned;
}

export const GENERIC_ERROR_MESSAGE = GENERIC;
