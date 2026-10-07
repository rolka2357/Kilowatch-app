import AsyncStorage from "@react-native-async-storage/async-storage";

const LAST_READ_PREFIX = "@kilowatch/notifications/lastRead/";

const memory = new Map();
const listeners = new Set();

function storageKey(uid) {
  return `${LAST_READ_PREFIX}${uid}`;
}

function emit(uid, lastReadAt) {
  listeners.forEach((listener) => {
    try {
      listener(uid, lastReadAt);
    } catch (_) {
      // ignore listener errors
    }
  });
}

export function subscribeNotificationReadState(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function getNotificationsLastRead(uid) {
  if (!uid) return 0;
  if (memory.has(uid)) return memory.get(uid);

  try {
    const raw = await AsyncStorage.getItem(storageKey(uid));
    if (raw == null) {
      // First launch: seed "read" to now so only new alerts badge the bell.
      const now = Date.now();
      memory.set(uid, now);
      await AsyncStorage.setItem(storageKey(uid), String(now));
      return now;
    }
    const value = Math.max(0, Number(raw) || 0);
    memory.set(uid, value);
    return value;
  } catch {
    return 0;
  }
}

/** Mark the in-app inbox as read up to now (clears the bell badge). */
export async function markNotificationsRead(uid) {
  if (!uid) return 0;
  const now = Date.now();
  memory.set(uid, now);
  try {
    await AsyncStorage.setItem(storageKey(uid), String(now));
  } catch (_) {
    // still update in-memory so the badge clears this session
  }
  emit(uid, now);
  return now;
}
