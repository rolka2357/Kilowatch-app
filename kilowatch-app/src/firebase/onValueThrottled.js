import { onValue } from "firebase/database";

/**
 * Throttles Firebase onValue callbacks so high-churn paths (like live/)
 * don't re-render the UI on every backend poll tick.
 */
export function onValueThrottled(query, callback, intervalMs = 1500) {
  let latestSnapshot = null;
  let timer = null;
  let pending = false;

  const flush = () => {
    timer = null;
    if (!pending || !latestSnapshot) return;
    pending = false;
    callback(latestSnapshot);
  };

  const unsubscribe = onValue(query, (snapshot) => {
    latestSnapshot = snapshot;
    if (timer == null) {
      // First event is immediate so the screen isn't blank.
      callback(snapshot);
      timer = setTimeout(flush, intervalMs);
      return;
    }
    pending = true;
  });

  return () => {
    if (timer != null) clearTimeout(timer);
    unsubscribe();
  };
}
