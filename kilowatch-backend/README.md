# Kilowatch Backend Monitor

Polls Tuya Cloud for every registered smart plug, calculates kWh, and writes to
Firebase Realtime Database:

- `live/{uid}/{deviceId}` — today's kWh so far, online flag, date/time (overwritten each poll)
- `history/{uid}/{deviceId}/{hourly|daily|weekly|monthly|yearly}/{bucket}` — cumulative kWh rollups
- `devices/{uid}/{deviceId}` — `online` / `switchOn` / `updatedAt` status

Because this runs on a server (or any always-on PC), monitoring continues even
when the mobile app is closed. The app only *reads* these paths now.

## KiloSave reminders

The same process also checks KiloSave budgets every five minutes after 9:00 AM
in `APP_TIMEZONE`. Due or missed weekly set-asides are delivered through FCM,
so the app does not need to be open. Delivery state is stored under
`kilosave/{ownerUid}/reminders/backend/{YYYY-MM-DD}` to prevent duplicates and
recover safely after process restarts.

- `KILOSAVE_REMINDER_HOUR` sets the first local delivery hour (default `9`).
- `KILOSAVE_CHECK_INTERVAL_MS` sets retry/check cadence (default `300000`).
- A phone must have opened KiloWatch while signed in once so its FCM token is
  registered, and Android notification permission must remain enabled.

## One-time setup

### 1. Tuya IoT Platform (cloud project)

1. Go to [iot.tuya.com](https://iot.tuya.com) and sign in with the same Tuya
   developer account used for the app's SDK keys.
2. **Cloud → Development → Create Cloud Project.**
   - Industry: Smart Home. Data Center: pick the one your devices live in
     (Philippines is usually **Western America**). If polling later returns
     `permission deny` / empty devices, switch data center here and in `.env`.
3. In the project, open **Devices → Link App Account** (or "Link Tuya App
   Account") and link the app account that paired the plugs. Your smart plug
   should then appear in the device list. Copy its **Device ID** and confirm it
   matches the one in Firebase under `devices/{uid}`.
4. Make sure the **IoT Core** service is subscribed (trial is free) under
   Cloud → Cloud Services.
5. From the project Overview page copy **Access ID** and **Access Secret**.

### 2. Firebase service account

1. Firebase Console → Project settings → **Service accounts**.
2. Click **Generate new private key** and save the file as
   `serviceAccountKey.json` in this folder. (It's gitignored — never commit it.)

### 3. Configure and run

```powershell
cd kilowatch-backend
copy .env.example .env
# edit .env: TUYA_ACCESS_ID, TUYA_ACCESS_SECRET, endpoint if needed
npm install
npm start
```

You should see `polled 1 device(s)` every 15 seconds, and `live/...` updating
in the Firebase console.

## Deployment

Any always-on Node 18+ host works: Railway, Render, Fly.io, a Raspberry Pi, or
a spare PC. Set the `.env` values as environment variables and upload the
service account key (or paste its JSON into a secret file).

## Notes

- Poll interval is `POLL_INTERVAL_MS` (default 15s). Tuya's free trial quota
  comfortably covers one device at this rate; increase the interval if you add
  many plugs.
- kWh is computed by integrating the plug's wattage between polls
  (average kW × elapsed hours), which is robust across plug models.
- If the service restarts, it resumes today's total from the daily history
  bucket, so no double counting.
