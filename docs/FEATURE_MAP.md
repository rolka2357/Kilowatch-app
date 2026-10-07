# Kilowatch — Feature → File Map

Guide for teammates: which files own each feature. Paths are relative to the repo root (`Kilowatch App/`).

**Rule of thumb**
- **Mobile UI / pairing** → `kilowatch-app/`
- **Admin CMS / support** → `kilowatch-admin/`
- **Live kWh, schedules, limits when app is closed** → `kilowatch-backend/`
- **AI tips** → `kilowatch-app/functions/`

---

## Top-level folders

| Folder | Purpose |
|--------|---------|
| `kilowatch-app/` | React Native / Expo customer app (UI, Firebase client, Tuya pairing) |
| `kilowatch-admin/` | Vite + React admin web (users, devices, content, demos) |
| `kilowatch-backend/` | Node 24/7 Tuya Cloud poller (live energy, history, schedules, limits, FCM) |
| `docs/` | Team documentation (this file) |

Firebase project config lives with the mobile app: `kilowatch-app/firebase.json`, `database.rules.json`, `functions/`.

---

## Shared Firebase Realtime Database paths

Canonical builders: `kilowatch-app/src/firebase/dbPaths.js` (admin mirror: `kilowatch-admin/src/paths.js`).

| Path | Role |
|------|------|
| `users/{uid}` | Profile, rate, onboarding, soft-disable, FCM tokens, memberships |
| `rooms/{uid}/{roomId}` | Rooms for a home owner |
| `appliances/{uid}/{applianceId}` | Appliance ↔ room ↔ device |
| `devices/{uid}/{deviceId}` | Plug config, switch, pending commands, schedules, usage limits |
| `live/{uid}/{deviceId}` | Latest power / today’s kWh (overwritten) |
| `history/{uid}/{deviceId}/{granularity}/{bucket}` | Hourly → yearly kWh rollups |
| `historyLinks/{uid}/{qrOrBoxId}` | Reattach history after re-pair |
| `deviceOwners/{deviceId}` | Global one-owner claim |
| `deviceIdentifiers/{qrOrBoxId}` | Early claim by QR / box id |
| `homes/{ownerUid}/meta\|members\|invites\|alerts` | Household + alerts |
| `emailIndex/{emailKey}` / `emailInvites/...` | Invite lookup inbox |
| `kilosave/{ownerUid}/...` | Budget goals, weeks, periods |
| `tips/{ownerUid}/months/{monthKey}` | Cached tips |
| `admins/{uid}` | Admin gate (`true`) |
| `content/news\|providers\|onboarding` | Admin-managed catalog |

---

## Feature ownership cheat sheet

| Feature | Primary package |
|---------|-----------------|
| Pairing / native Tuya | `kilowatch-app` (release / grafted APK) |
| Live kWh & history (real plugs) | `kilowatch-backend` |
| On/off when app closed | `pendingCommand` → backend |
| Schedules & usage limits (real) | backend; dummy plugs → in-app runners |
| Tips (AI) | Cloud Function `generateTips` |
| News / providers / tutorial video | `kilowatch-admin` → `content/*` |
| Soft-disable accounts | admin Users → app auth gate |

---

## 1. Auth (email, Google, soft disable)

| File | Responsibility |
|------|----------------|
| `kilowatch-app/src/screens/auth/login/Login.js` | Email/password + Google login UI; soft-disable check after sign-in |
| `kilowatch-app/src/screens/auth/register/Register.js` | Email registration + profile seed |
| `kilowatch-app/src/screens/auth/forgot_password/ForgotPassword.js` | Password reset email |
| `kilowatch-app/src/firebase/googleSignIn.js` | Google → Firebase credential; profile create; soft disable |
| `kilowatch-app/src/firebase/googleAuthConfig.js` | Google Sign-In web client ID |
| `kilowatch-app/src/firebase/accountAccess.js` | `disabled` helpers + `assertAccountActive` |
| `kilowatch-app/src/navigation/AppNavigator.js` | Auth gate; sign-out when disabled |
| `kilowatch-app/src/firebase/firebaseConfig.js` | Firebase Auth / RTDB / Storage / Functions init |
| `kilowatch-admin/src/pages/Login.jsx` | Admin login |
| `kilowatch-admin/src/auth/AdminGate.jsx` | Requires `admins/{uid} === true` |
| `kilowatch-admin/src/pages/Users.jsx` | Soft-disable toggle + user management |
| `kilowatch-admin/src/createCustomerUser.js` | Create Auth user without kicking admin session |

---

## 2. Onboarding

| File | Responsibility |
|------|----------------|
| `kilowatch-app/src/screens/onboarding/OnboardingStack.js` | Welcome → Video → Provider → Permissions |
| `kilowatch-app/src/screens/onboarding/WelcomeOnboarding.js` | First welcome screen |
| `kilowatch-app/src/screens/onboarding/VideoOnboarding.js` | Opens admin tutorial URL (or “Coming soon”) |
| `kilowatch-app/src/screens/onboarding/ProviderOnboarding.js` | Electricity provider / custom rate |
| `kilowatch-app/src/screens/onboarding/PermissionsOnboarding.js` | Notifications, alarms, camera, location, etc. |
| `kilowatch-app/src/firebase/onboarding.js` | Mark onboarding done + save rate; read tutorial URL |
| `kilowatch-app/src/utils/appPermissions.js` | Permission helpers |
| `kilowatch-app/src/firebase/electricityProviders.js` | Bundled provider catalog |
| `kilowatch-app/src/firebase/electricityRateHistory.js` | Rate writes with history |
| `kilowatch-admin/src/pages/Onboarding.jsx` | Edit `content/onboarding/tutorialVideoUrl` |

---

## 3. Homes / rooms / appliances

| File | Responsibility |
|------|----------------|
| `kilowatch-app/src/context/HomeContext.js` | Active home, role, membership list |
| `kilowatch-app/src/firebase/household.js` | Ensure home, invites, roles, transfer, rename |
| `kilowatch-app/src/screens/appliances/appliance/Appliances.js` | Home dashboard; starts pairing |
| `kilowatch-app/src/screens/appliances/ApplianceStack.js` | Rooms → appliances → detail / analytics / schedule / limits |
| `kilowatch-app/src/screens/appliances/appliance_details/RoomDetails.js` | Room hub |
| `kilowatch-app/src/screens/appliances/appliance_details/RoomAppliances.js` | Appliances in a room |
| `kilowatch-app/src/components/room_card/RoomCard.js` | Room summary card |
| `kilowatch-app/src/components/room/EditRoom.js` | Rename room |
| `kilowatch-app/src/components/appliance_card/ApplianceCard.js` | Appliance tile (power, kWh, cost) |
| `kilowatch-app/src/components/appliance_option_modal/*` | Edit / delete appliance menus |
| `kilowatch-app/src/firebase/migrateDatabase.js` | One-time schema migration |
| `kilowatch-app/src/navigation/MainTabs.js` | Tabs + background runners |

---

## 4. Device pairing (Tuya QR, Wi‑Fi, naming, recovery)

| File | Responsibility |
|------|----------------|
| `kilowatch-app/src/components/add_appliance_flow/AddApplianceFlow.js` | Orchestrates scan → Wi‑Fi → activate → name/room |
| `…/ScanQrModal.js` | Camera QR scan |
| `…/parseSmartPlugQr.js` | Parse QR → identifier |
| `…/ConnectWifiModal.js` | SSID + password |
| `…/ConnectingModal.js` | Activator progress |
| `…/ConnectionSuccessModal.js` | Pair success |
| `…/EnterApplianceDetailsModal.js` | Name + room |
| `…/pairingUtils.js` | Wi‑Fi scan / open system settings |
| `…/deviceAvailability.js` | Check if plug already claimed |
| `…/LocationRequiredModal.js` | Prompt to enable Location |
| `kilowatch-app/src/utils/pairingLocation.js` | Android location permission + services check |
| `kilowatch-app/src/tuya/tuyaBridge.js` | JS → native Tuya activator / device APIs |
| `kilowatch-app/src/tuya/tuyaSession.js` | Tuya login + home sync |
| `kilowatch-app/src/tuya/tuyaNative.js` | Native Tuya on/off flag (Metro vs release) |
| `kilowatch-app/src/firebase/deviceOwnership.js` | Claim / release ownership |
| `kilowatch-app/src/firebase/pairingRecovery.js` | Roll back incomplete pair |
| `kilowatch-app/src/firebase/historyLink.js` | Keep usage history across re-pair |

---

## 5. Device control (on/off)

| File | Responsibility |
|------|----------------|
| `kilowatch-app/src/tuya/deviceControl.js` | Native Tuya or queue `pendingCommand` |
| `kilowatch-app/src/tuya/DeviceCommandRunner.js` | Owner fallback when backend is down (native builds) |
| `kilowatch-app/src/tuya/TuyaStatusSync.js` | Sync switch/online while app open |
| `kilowatch-app/src/screens/appliances/appliance_details/ApplianceDetail.js` | Per-appliance control UI |
| `kilowatch-backend/src/pendingCommands.js` | Execute queued commands via Tuya Cloud |
| `kilowatch-backend/src/tuyaClient.js` | Tuya Cloud get / set switch |

---

## 6. Live energy / history / analytics

| File | Responsibility |
|------|----------------|
| `kilowatch-backend/src/monitor.js` | Poll plugs; write live + rollups; schedules/limits hooks |
| `kilowatch-backend/src/energy.js` | History rollup writer |
| `kilowatch-app/src/firebase/energy.js` | Client bucket helpers (mirrors backend) |
| `kilowatch-app/src/firebase/energyPricing.js` | PHP cost from kWh × rate |
| `kilowatch-app/src/screens/analytics/Analytics.js` | Home-level charts |
| `kilowatch-app/src/hooks/useHomeAnalytics.js` | Aggregate live + history |
| `kilowatch-app/src/screens/appliances/appliance_details/RoomAnalytics.js` | Room charts |
| `kilowatch-app/src/screens/appliances/appliance_details/ApplianceAnalytics.js` | Appliance charts |

---

## 7. KiloSave

| File | Responsibility |
|------|----------------|
| `kilowatch-app/src/screens/kilosave/*` | UI: home, budget, set-aside, log bill, history |
| `kilowatch-app/src/firebase/kilosave.js` | RTDB writes for settings / weeks / periods |
| `kilowatch-app/src/hooks/useKilosave.js` | Live KiloSave subscription |
| `kilowatch-app/src/notifications/KilosaveReminderRunner.js` | Local set-aside reminders |
| `kilowatch-app/src/navigation/MainTabs.js` | KiloSave tab = **owner only** |

---

## 8. Usage limits & schedules

| File | Responsibility |
|------|----------------|
| `kilowatch-app/src/screens/appliances/appliance_details/ApplianceUsageLimit.js` | Daily PHP limit UI |
| `kilowatch-app/src/firebase/usageLimits.js` | CRUD + “applies today” helpers |
| `kilowatch-app/src/tuya/UsageLimitRunner.js` | Enforce **dummy** plugs in-app |
| `kilowatch-backend/src/usageLimits.js` | Enforce **real** plugs 24/7 + notify |
| `kilowatch-app/src/screens/appliances/appliance_details/ApplianceSchedule.js` | Schedule UI |
| `kilowatch-app/src/firebase/schedules.js` | Schedule CRUD helpers |
| `kilowatch-app/src/tuya/ScheduleRunner.js` | Dummy schedule runner |
| `kilowatch-backend/src/monitor.js` | Cloud schedule firing for real plugs |
| `kilowatch-backend/src/time.js` | Timezone / fire-key helpers |

---

## 9. Household (invites, transfer, rename)

| File | Responsibility |
|------|----------------|
| `kilowatch-app/src/screens/settings/People.js` | Members, roles, remove |
| `kilowatch-app/src/screens/settings/InvitePerson.js` | Invite by email |
| `kilowatch-app/src/screens/settings/TransferOwnership.js` | Transfer home ownership |
| `kilowatch-app/src/screens/settings/TransferSuccess.js` | Post-transfer screen |
| `kilowatch-app/src/screens/settings/EditHomeName.js` | Rename owned home |
| `kilowatch-app/src/screens/settings/Security.js` | Owned homes → rename entry |
| `kilowatch-app/src/firebase/household.js` | All household multi-path writes |
| `kilowatch-app/src/screens/notifications/Notifications.js` | Accept/decline invites + alerts |

---

## 10. Notifications

| File | Responsibility |
|------|----------------|
| `kilowatch-app/src/screens/notifications/Notifications.js` | In-app inbox |
| `kilowatch-app/src/notifications/PushTokenRegistrar.js` | Save FCM token |
| `kilowatch-app/src/notifications/HouseholdAlertListener.js` | Local notifs for RTDB alerts |
| `kilowatch-app/src/notifications/notificationReadState.js` | Unread tracking |
| `kilowatch-app/src/hooks/useUnreadNotificationCount.js` | Header badge |
| `kilowatch-app/src/firebase/homeAlerts.js` | Client publish alerts |
| `kilowatch-backend/src/notify.js` | FCM + RTDB home alerts |

---

## 11. Settings / About / Help / account / rate

| File | Responsibility |
|------|----------------|
| `kilowatch-app/src/screens/settings/SettingsStack.js` | Settings navigation |
| `kilowatch-app/src/screens/settings/SettingsHome.js` | Settings menu |
| `kilowatch-app/src/screens/settings/Account.js` | Profile |
| `kilowatch-app/src/screens/settings/EditName.js` / `EditEmail.js` | Profile edits |
| `kilowatch-app/src/screens/settings/ElectricityRate.js` | Change provider/rate |
| `kilowatch-app/src/screens/settings/Help.js` | Help copy |
| `kilowatch-app/src/screens/settings/About.js` | About (Android-only messaging) |
| `kilowatch-app/src/firebase/profilePhoto.js` | Photo upload to Storage |

---

## 12. Delete plug

| File | Responsibility |
|------|----------------|
| `kilowatch-app/src/components/appliance_option_modal/DeleteAppliance.js` | Unbind Tuya; remove RTDB rows; release ownership; keep history link |
| `kilowatch-app/src/firebase/deviceOwnership.js` | `releaseDeviceOwnership` |
| `kilowatch-app/src/firebase/historyLink.js` | Persist QR → history before delete |

---

## 13. Tips & News

| File | Responsibility |
|------|----------------|
| `kilowatch-app/src/screens/tips_news/*` | Tips / News UI |
| `kilowatch-app/src/hooks/useTips.js` | Call `generateTips` + read cache |
| `kilowatch-app/src/firebase/tips.js` | Eligibility / fingerprints |
| `kilowatch-app/src/firebase/tipsFallback.js` | On-device tips if function down |
| `kilowatch-app/functions/index.js` | Callable `generateTips` |
| `kilowatch-app/functions/lib/tipsCore.js` | Stats + OpenAI / rule tips |
| `kilowatch-admin/src/pages/News.jsx` | News CMS |

---

## 14. Admin web

| File | Responsibility |
|------|----------------|
| `kilowatch-admin/src/App.jsx` | Routes |
| `kilowatch-admin/src/layouts/AdminLayout.jsx` | Shell + nav |
| `kilowatch-admin/src/pages/Dashboard.jsx` | Overview stats |
| `kilowatch-admin/src/pages/Users.jsx` | Users, soft disable, rates |
| `kilowatch-admin/src/pages/Devices.jsx` | Cross-user device inventory |
| `kilowatch-admin/src/pages/Providers.jsx` | Provider catalog |
| `kilowatch-admin/src/pages/Onboarding.jsx` | Tutorial video URL |
| `kilowatch-admin/src/pages/News.jsx` | News |
| `kilowatch-admin/src/pages/Support.jsx` | Reset password, pairing lookup, dummy data |
| `kilowatch-admin/src/pages/FeatureDemo.jsx` | Demo triggers for testing |
| `kilowatch-admin/src/demoActions.js` | Seed / demo RTDB mutations |
| `kilowatch-admin/src/paths.js` | RTDB path builders |

---

## 15. Backend poller

| File | Responsibility |
|------|----------------|
| `kilowatch-backend/index.js` | Boot Firebase Admin + start monitor |
| `kilowatch-backend/src/monitor.js` | Main poll loop |
| `kilowatch-backend/src/energy.js` | History rollups |
| `kilowatch-backend/src/pendingCommands.js` | Drain `pendingCommand` |
| `kilowatch-backend/src/usageLimits.js` | Trip limits + notify |
| `kilowatch-backend/src/notify.js` | FCM + alerts |
| `kilowatch-backend/src/tuyaClient.js` | Tuya Cloud API |
| `kilowatch-backend/src/config.js` | Env (keys, poll interval, TZ) |
| `kilowatch-backend/src/time.js` | Manila time helpers |

---

## 16. Firebase rules & config

| File | Responsibility |
|------|----------------|
| `kilowatch-app/firebase.json` | Rules + functions wiring |
| `kilowatch-app/database.rules.json` | RTDB security (owner / editor / viewer / admin) |
| `kilowatch-app/functions/` | Tips Cloud Function |

---

## 17. App shell / cross-cutting

| File | Responsibility |
|------|----------------|
| `kilowatch-app/App.js` | Root: fonts, theme, navigator |
| `kilowatch-app/src/theme/*` | Colors, fonts, navigation theme |
| `kilowatch-app/src/firebase/onValueThrottled.js` | Throttled RTDB listeners |
| `kilowatch-app/src/utils/userFacingError.js` | Safe error strings for UI |
| `kilowatch-app/src/utils/formatMoney.js` | PHP / kWh formatting |
| `kilowatch-app/scripts/graft-js-onto-stable-native.js` | Graft latest JS onto stable Tuya native APK |

---

## How to find something fast

1. Open this file → find the **feature** section.
2. Open the **primary** file listed first.
3. Follow imports into `firebase/`, `tuya/`, or `kilowatch-backend/src/` for data / device logic.
4. Check `dbPaths.js` / `paths.js` for the exact RTDB path.

**Dummy vs real plugs:** IDs starting with `dummy_` (or `isDummy`) are demo devices. Schedules/limits for them run **in the app**; real plugs are handled by **kilowatch-backend**.
