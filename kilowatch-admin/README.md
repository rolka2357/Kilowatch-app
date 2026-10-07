# Kilowatch Admin (React + Vite)

Web admin for content that backs the mobile app: **users**, **electricity providers**, **news**, plus a **dashboard**.

## Run

```powershell
cd "d:\Kilowatch App\kilowatch-admin"
npm run dev
```

Open the local URL Vite prints (usually http://localhost:5173).

## First-time admin access

1. Sign in with a **Firebase Auth** email/password user (same project as the app).
2. In Firebase Console → Realtime Database, create:

```
admins/{YOUR_UID}: true
```

3. Refresh the admin site.

## Data paths (shared with mobile)

| Feature | Path |
|---------|------|
| Admins | `admins/{uid}` |
| Users | `users/{uid}` |
| Providers | `content/providers/{id}` |
| News | `content/news/{newsId}` |

News shape matches the app card: `title`, `description`, `imageUrl`, `link`, `order`, `active`.

Providers match mobile presets: `id`, `name`, `shortName`, `rate`, optional `logoUrl`.

## Deploy (separate from the mobile app)

Keep this folder next to `kilowatch-app`. Do **not** move it into the mobile project.

| App | How you ship it |
|-----|-----------------|
| Phone (`kilowatch-app`) | Expo / Play Store / `eas build` |
| Admin (`kilowatch-admin`) | Separate web host (e.g. Firebase Hosting, Vercel) |

Example Firebase Hosting later:

```powershell
cd "d:\Kilowatch App\kilowatch-admin"
npm run build
# then host the `dist/` folder
```

The admin only needs the same Firebase project; it is not bundled into the Android APK.
