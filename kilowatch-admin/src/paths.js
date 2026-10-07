/**
 * Shared RTDB path builders and electricity-provider catalog helpers.
 * Paths mirror the mobile app so admin writes land on the same nodes.
 * Also exposes default PH providers and logo resolution for the Providers UI.
 */

/** Paths shared with the mobile app for admin-managed content. */
export const paths = {
  // Auth / profile
  admins: () => "admins",
  admin: (uid) => `admins/${uid}`,
  users: () => "users",
  user: (uid) => `users/${uid}`,
  userMemberships: (uid) => `users/${uid}/memberships`,
  membership: (uid, homeId) => `users/${uid}/memberships/${homeId}`,
  homeMeta: (ownerUid) => `homes/${ownerUid}/meta`,
  homeMembers: (ownerUid) => `homes/${ownerUid}/members`,
  homeMember: (ownerUid, memberUid) =>
    `homes/${ownerUid}/members/${memberUid}`,
  emailIndex: (emailKey) => `emailIndex/${emailKey}`,

  // CMS content
  news: () => "content/news",
  newsItem: (id) => `content/news/${id}`,
  providers: () => "content/providers",
  provider: (id) => `content/providers/${id}`,
  providersMeta: () => "content/providersMeta",
  onboarding: () => "content/onboarding",
  onboardingTutorialVideoUrl: () => "content/onboarding/tutorialVideoUrl",

  // Devices & telemetry
  devicesRoot: () => "devices",
  appliancesRoot: () => "appliances",
  roomsRoot: () => "rooms",
  liveRoot: () => "live",
  historyRoot: () => "history",
  historyDevice: (uid, deviceId) => `history/${uid}/${deviceId}`,
  historyBucket: (uid, deviceId, granularity, bucketKey) =>
    `history/${uid}/${deviceId}/${granularity}/${bucketKey}`,

  // KiloSave
  kilosave: (uid) => `kilosave/${uid}`,
  kilosaveSettings: (uid) => `kilosave/${uid}/settings`,
  kilosaveWeeks: (uid) => `kilosave/${uid}/weeks`,
  kilosaveWeek: (uid, weekKey) => `kilosave/${uid}/weeks/${weekKey}`,
  kilosavePeriods: (uid) => `kilosave/${uid}/periods`,
  kilosavePeriod: (uid, periodKey) => `kilosave/${uid}/periods/${periodKey}`,
  /** Temporary stash when admin clears a week for notif testing. */
  kilosaveAdminBackup: (uid) => `kilosave/${uid}/adminBackup`,
  kilosaveAdminBackupWeek: (uid) => `kilosave/${uid}/adminBackup/lastClearedWeek`,

  // Per-device limits & tips
  device: (uid, deviceId) => `devices/${uid}/${deviceId}`,
  deviceUsageLimits: (uid, deviceId) => `devices/${uid}/${deviceId}/usageLimits`,
  deviceUsageLimit: (uid, deviceId, limitId) =>
    `devices/${uid}/${deviceId}/usageLimits/${limitId}`,
  tips: (uid) => `tips/${uid}`,
  tipsMonths: (uid) => `tips/${uid}/months`,
  tipsMonth: (uid, monthKey) => `tips/${uid}/months/${monthKey}`,
  tipsAdminDemo: (uid) => `tips/${uid}/adminDemo`,
  tipsAdminGenerateTrigger: (uid) =>
    `tips/${uid}/adminDemo/generateTrigger`,
};

/** Fallback catalog when RTDB providers are empty (matches mobile presets). */
export const DEFAULT_PROVIDERS = [
  { id: "meralco", name: "Meralco", shortName: "Meralco", rate: 15, order: 1 },
  {
    id: "aboitiz",
    name: "AboitizPower Corporation",
    shortName: "AboitizPower",
    rate: 16,
    order: 2,
  },
  {
    id: "acen",
    name: "ACEN Corporation",
    shortName: "ACEN",
    rate: 17,
    order: 3,
  },
  {
    id: "san_miguel",
    name: "San Miguel Corp.",
    shortName: "San Miguel Corp.",
    rate: 18,
    order: 4,
  },
  {
    id: "first_gen",
    name: "First Gen Corporation",
    shortName: "First Gen",
    rate: 19,
    order: 5,
  },
];

/** Same bundled company marks as the mobile app (`assets/svg/settings/companies`). */
export const PROVIDER_LOGO_BY_ID = {
  meralco: "/providers/meralco.svg",
  aboitiz: "/providers/aboitiz.svg",
  acen: "/providers/acen.svg",
  san_miguel: "/providers/san_miguel.svg",
  first_gen: "/providers/first_gen.svg",
  custom: "/providers/custom.svg",
};

/** Prefer remote logoUrl; otherwise bundled SVG by provider id. */
export function resolveProviderLogo(id, logoUrl) {
  const remote = String(logoUrl || "").trim();
  if (remote) return remote;
  return PROVIDER_LOGO_BY_ID[id] || PROVIDER_LOGO_BY_ID.custom;
}
