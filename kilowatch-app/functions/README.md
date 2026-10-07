# Kilowatch Cloud Functions — AI Tips

## Prerequisites

1. Firebase project on **Blaze** (required for outbound OpenAI calls).
2. OpenAI account with billing + an API key.
3. Firebase CLI: `npm i -g firebase-tools` then `firebase login`.

## Secrets

```bash
cd kilowatch-app/functions
cp .env.example .env
# Put your real key in .env for local emulator only — do not commit it.

# Production secret (Blaze):
firebase functions:secrets:set OPENAI_API_KEY
```

## Deploy

From `kilowatch-app`:

```bash
npm --prefix functions install
firebase deploy --only functions:generateTips,database
```

Region: `asia-southeast1` (same as RTDB).

## Local emulator (optional)

```bash
firebase emulators:start --only functions
```

Point the app at the emulator with `connectFunctionsEmulator` only while developing.
