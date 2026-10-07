/**
 * PURPOSE: Preserve usage history across delete → re-pair of the same physical plug.
 * historyLinks/{uid}/{qrOrBoxId} remembers the last history deviceId so a new
 * Tuya id can inherit the old rollup tree.
 */
import { get, ref, set, update } from "firebase/database";

import { database } from "./firebaseConfig";
import { paths } from "./dbPaths";
import { normalizePlugIdentifier } from "./deviceOwnership";

/**
 * Remember which history/{uid}/{deviceId} tree belongs to a physical plug
 * (QR/box id) so re-pairing can reattach past usage after delete.
 */
export async function saveHistoryLink(uid, identifier, historyDeviceId) {
  const plugId = normalizePlugIdentifier(identifier);
  if (!uid || !plugId || !historyDeviceId) return;

  await set(ref(database, paths.historyLink(uid, plugId)), {
    historyDeviceId,
    updatedAt: Date.now(),
  });
}

/**
 * If this plug was deleted before, move retained history onto the new
 * Tuya deviceId (when Tuya issues a different id). Same id = already linked.
 */
export async function reattachHistoryForPlug(uid, identifier, newDeviceId) {
  const plugId = normalizePlugIdentifier(identifier);
  if (!uid || !plugId || !newDeviceId) return { moved: false };

  const linkRef = ref(database, paths.historyLink(uid, plugId));
  const linkSnap = await get(linkRef);
  const previousDeviceId = linkSnap.val()?.historyDeviceId;

  if (previousDeviceId && previousDeviceId !== newDeviceId) {
    const oldHistorySnap = await get(
      ref(database, paths.history(uid, previousDeviceId))
    );
    const oldHistory = oldHistorySnap.val();

    if (oldHistory) {
      const newHistorySnap = await get(
        ref(database, paths.history(uid, newDeviceId))
      );
      const existing = newHistorySnap.val();

      // Fresh re-pair should have no history yet; if it does, keep new and
      // drop the orphaned tree rather than double-counting.
      if (!existing) {
        await update(ref(database), {
          [paths.history(uid, newDeviceId)]: oldHistory,
          [paths.history(uid, previousDeviceId)]: null,
        });
      } else {
        await set(ref(database, paths.history(uid, previousDeviceId)), null);
      }
    }
  }

  await set(linkRef, {
    historyDeviceId: newDeviceId,
    updatedAt: Date.now(),
  });

  return {
    moved: Boolean(previousDeviceId && previousDeviceId !== newDeviceId),
  };
}
