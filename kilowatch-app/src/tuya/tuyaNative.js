/**
 * PURPOSE: Feature flag for on-device Tuya SDK (pairing + local switch).
 *
 * Metro/debug (__DEV__): keep OFF. ThingHomeSdk.init SIGSEGVs on Realme RMX3710
 * in current native builds, so Metro tests use kilowatch-backend for on/off,
 * schedules, and usage limits. Pairing cannot be safely tested on Metro on this phone.
 *
 * Release / grafted APK (__DEV__ false): ON. Grafted 1.0.0 native has working Tuya init.
 */
export const TUYA_NATIVE_ENABLED = !__DEV__;
