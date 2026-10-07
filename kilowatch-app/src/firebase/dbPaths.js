/**
 * PURPOSE: Central Realtime Database path builders.
 *
 * New top-level layout (readable + scalable), each scoped per user except
 * `deviceOwners` which is a global claim map:
 *
 *   users/{uid}                         -> profile + private integrations
 *   rooms/{uid}/{roomId}                -> room metadata
 *   appliances/{uid}/{applianceId}      -> appliance metadata (links room + device)
 *   devices/{uid}/{deviceId}            -> smart plug config + online/switch status
 *   live/{uid}/{deviceId}              -> latest realtime snapshot (OVERWRITTEN)
 *   history/{uid}/{deviceId}/{granularity}/{bucketKey} -> cumulative kWh rollups
 *   historyLinks/{uid}/{qrOrBoxId}      -> { historyDeviceId } (reattach after re-pair)
 *   deviceOwners/{deviceId}             -> uid that owns the plug (one user per plug)
 *   deviceIdentifiers/{qrOrBoxId}       -> { ownerUid, deviceId } (early claim by QR)
 *   homes/{ownerUid}/members/{uid}      -> household members + roles
 *   homes/{ownerUid}/invites/{inviteId} -> pending invites from this home
 *   emailIndex/{emailKey}               -> uid lookup by normalized email
 *   emailInvites/{emailKey}/{inviteId}  -> inbox for invitee (by email)
 */

export const SCHEMA_VERSION = 3;

export const paths = {
  userProfile: (uid) => `users/${uid}`,
  schemaVersion: (uid) => `users/${uid}/schemaVersion`,
  activeHomeOwnerUid: (uid) => `users/${uid}/activeHomeOwnerUid`,
  memberships: (uid) => `users/${uid}/memberships`,
  membership: (uid, ownerUid) => `users/${uid}/memberships/${ownerUid}`,

  rooms: (uid) => `rooms/${uid}`,
  room: (uid, roomId) => `rooms/${uid}/${roomId}`,

  appliances: (uid) => `appliances/${uid}`,
  appliance: (uid, applianceId) => `appliances/${uid}/${applianceId}`,

  devices: (uid) => `devices/${uid}`,
  device: (uid, deviceId) => `devices/${uid}/${deviceId}`,
  deviceSchedules: (uid, deviceId) => `devices/${uid}/${deviceId}/schedules`,
  deviceSchedule: (uid, deviceId, scheduleId) =>
    `devices/${uid}/${deviceId}/schedules/${scheduleId}`,
  deviceUsageLimits: (uid, deviceId) =>
    `devices/${uid}/${deviceId}/usageLimits`,
  deviceUsageLimit: (uid, deviceId, limitId) =>
    `devices/${uid}/${deviceId}/usageLimits/${limitId}`,

  live: (uid) => `live/${uid}`,
  liveDevice: (uid, deviceId) => `live/${uid}/${deviceId}`,

  history: (uid, deviceId) => `history/${uid}/${deviceId}`,
  historyBucket: (uid, deviceId, granularity, bucketKey) =>
    `history/${uid}/${deviceId}/${granularity}/${bucketKey}`,
  // Maps QR/box id -> last history deviceId so re-pair can reattach usage
  historyLinks: (uid) => `historyLinks/${uid}`,
  historyLink: (uid, identifier) => `historyLinks/${uid}/${identifier}`,

  deviceOwner: (deviceId) => `deviceOwners/${deviceId}`,
  deviceIdentifier: (identifier) => `deviceIdentifiers/${identifier}`,

  home: (ownerUid) => `homes/${ownerUid}`,
  homeMeta: (ownerUid) => `homes/${ownerUid}/meta`,
  homeMembers: (ownerUid) => `homes/${ownerUid}/members`,
  homeMember: (ownerUid, memberUid) => `homes/${ownerUid}/members/${memberUid}`,
  homeInvites: (ownerUid) => `homes/${ownerUid}/invites`,
  homeInvite: (ownerUid, inviteId) => `homes/${ownerUid}/invites/${inviteId}`,
  // Fan-out local notification payloads to every household member
  homeAlerts: (ownerUid) => `homes/${ownerUid}/alerts`,
  homeAlert: (ownerUid, alertId) => `homes/${ownerUid}/alerts/${alertId}`,

  emailIndex: (emailKey) => `emailIndex/${emailKey}`,
  emailInvites: (emailKey) => `emailInvites/${emailKey}`,
  emailInvite: (emailKey, inviteId) => `emailInvites/${emailKey}/${inviteId}`,

  // KiloSave (budget goals + weekly set-aside), scoped per home owner
  kilosave: (ownerUid) => `kilosave/${ownerUid}`,
  kilosaveSettings: (ownerUid) => `kilosave/${ownerUid}/settings`,
  kilosaveWeeks: (ownerUid) => `kilosave/${ownerUid}/weeks`,
  kilosaveWeek: (ownerUid, weekKey) => `kilosave/${ownerUid}/weeks/${weekKey}`,
  kilosavePeriods: (ownerUid) => `kilosave/${ownerUid}/periods`,
  kilosavePeriod: (ownerUid, periodKey) =>
    `kilosave/${ownerUid}/periods/${periodKey}`,

  // AI / rule-based tips — monthly cache per home owner
  tips: (ownerUid) => `tips/${ownerUid}`,
  tipsMonth: (ownerUid, monthKey) => `tips/${ownerUid}/months/${monthKey}`,

  // Admin-managed content (shared catalog)
  admins: () => "admins",
  admin: (uid) => `admins/${uid}`,
  contentNews: () => "content/news",
  contentNewsItem: (newsId) => `content/news/${newsId}`,
  contentProviders: () => "content/providers",
  contentProvider: (providerId) => `content/providers/${providerId}`,
  contentProvidersMeta: () => "content/providersMeta",
  contentOnboarding: () => "content/onboarding",
  contentTutorialVideoUrl: () => "content/onboarding/tutorialVideoUrl",
};

export const GRANULARITIES = ["hourly", "daily", "weekly", "monthly", "yearly"];

export function normalizeEmailKey(email) {
  return String(email || "")
    .trim()
    .toLowerCase()
    .replace(/[.#$\[\]]/g, "_");
}

/** Demo/test plugs seeded as dummy_* — never send Tuya commands for these. */
export function isDummyDevice(deviceId, device = null) {
  if (device?.isDummy === true || device?.isTipsDummy === true) return true;
  const id = String(deviceId || "");
  return id.startsWith("dummy_");
}

export function homeDisplayName(fullName) {
  const first = String(fullName || "My")
    .trim()
    .split(/\s+/)[0];
  if (!first) return "My Home";
  const possessive = /s$/i.test(first) ? `${first}'` : `${first}'s`;
  return `${possessive} Home`;
}
