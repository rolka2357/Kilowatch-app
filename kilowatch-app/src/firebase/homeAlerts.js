/**
 * PURPOSE: Publish fan-out alerts under homes/{ownerUid}/alerts.
 * Every active household member can show a local notification (or list the
 * alert in-app); real-plug FCM is owned by kilowatch-backend separately.
 */
import { get, push, ref, serverTimestamp, set } from "firebase/database";

import { database } from "./firebaseConfig";
import { homeDisplayName, paths } from "./dbPaths";

/**
 * Publish a household alert so every active member (owner + editors + viewers)
 * can show a local notification on their phone.
 */
export async function publishHomeAlert(homeUid, alert) {
  if (!homeUid || !alert?.type) return null;

  let homeName = alert.homeName;
  // Prefer home meta name so multi-home members can tell alerts apart.
  if (!homeName) {
    try {
      const metaSnap = await get(ref(database, paths.homeMeta(homeUid)));
      const meta = metaSnap.val() || {};
      if (meta.name) {
        homeName = meta.name;
      } else {
        const profileSnap = await get(ref(database, paths.userProfile(homeUid)));
        const profile = profileSnap.val() || {};
        homeName = homeDisplayName(
          profile.fullName || profile.displayName || profile.name
        );
      }
    } catch (_) {
      homeName = "Home";
    }
  }

  const baseTitle = alert.title || "Kilowatch";
  const baseBody = alert.body || "";
  const title = baseTitle.includes(homeName)
    ? baseTitle
    : `${baseTitle} · ${homeName}`;
  const body = baseBody.includes(homeName)
    ? baseBody
    : `${homeName} — ${baseBody}`;

  const alertRef = push(ref(database, paths.homeAlerts(homeUid)));
  await set(alertRef, {
    ...alert,
    homeUid,
    homeName,
    title,
    body,
    alertId: alertRef.key,
    createdAt: Date.now(),
    serverCreatedAt: serverTimestamp(),
  });
  return alertRef.key;
}
