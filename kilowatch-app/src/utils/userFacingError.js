const GENERIC = "Something went wrong. Please try again.";

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
  "functions/permission-denied": "You don’t have permission to do that.",
  "functions/unauthenticated": "Please sign in again.",
  "functions/unavailable": "Service is temporarily unavailable. Please try again.",
  "functions/deadline-exceeded": "That took too long. Please try again.",
};

function cleanRawMessage(raw) {
  return String(raw || "")
    .replace(/^Firebase:\s*/i, "")
    .replace(/\s*\((?:auth|functions)\/[^)]+\)\.?\s*$/i, "")
    .replace(/\s*\[.*?\]\s*$/g, "")
    .trim();
}

function looksTechnical(message) {
  if (!message) return true;
  if (message.length > 180) return true;
  return /firebase|permission[_ -]?denied|PERMISSION_DENIED|network request failed|internal error|https?:\/\/|at \w+\(|ECONNREFUSED|undefined is not|null is not|Exception|stack|Firestore|Callable|HttpsError|rpc|grpc|java\.|NSLocalized|Status\{/i.test(
    message
  );
}

/**
 * Turn unknown / technical errors into a short user-facing message.
 * Known auth/function codes keep specific copy; everything else falls back.
 */
export function userFacingError(error, fallback = GENERIC) {
  const code = String(error?.code || "");
  if (CODE_MESSAGES[code]) return CODE_MESSAGES[code];

  // Nested Firebase Functions error codes sometimes appear in message only.
  for (const [key, value] of Object.entries(CODE_MESSAGES)) {
    if (code.includes(key) || String(error?.message || "").includes(key)) {
      return value;
    }
  }

  const cleaned = cleanRawMessage(
    error?.details || error?.message || (typeof error === "string" ? error : "")
  );

  if (!cleaned || looksTechnical(cleaned)) {
    return fallback || GENERIC;
  }

  return cleaned;
}

export const GENERIC_ERROR_MESSAGE = GENERIC;
