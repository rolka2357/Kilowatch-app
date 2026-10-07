/**
 * Google Sign-In + Firebase Auth config.
 *
 * Get the Web client ID from Firebase Console:
 *   Authentication → Sign-in method → Google → Web SDK configuration
 *   (ends with .apps.googleusercontent.com)
 *
 * Also required for fast Google Sign-In on Android:
 * 1. Enable Google provider in Firebase Authentication
 * 2. Add Android app (package: com.kilowatch.app) in Firebase Project settings
 * 3. Download google-services.json into kilowatch-app/google-services.json
 * 4. Add debug + release SHA-1 (./gradlew signingReport) in Firebase
 * 5. npx expo prebuild --clean && rebuild the Android app
 */
export const GOOGLE_WEB_CLIENT_ID =
  "10172743143-lc89ns6m9bbnpadmce2qps5pbm4v0chm.apps.googleusercontent.com";
