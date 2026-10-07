/**
 * PURPOSE: Top-level auth gate for the app.
 * Routes signed-out users to auth screens, unfinished profiles to onboarding,
 * and active users into MainTabs — while force-signing-out disabled accounts.
 */
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, AppState, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { onValue, ref } from "firebase/database";

import { auth, database } from "../firebase/firebaseConfig";
import { paths } from "../firebase/dbPaths";
import {
  ACCOUNT_DISABLED_MESSAGE,
  isAccountDisabled,
} from "../firebase/accountAccess";
import { signOutGoogle } from "../firebase/googleSignIn";
import Login from "../screens/auth/login/Login";
import Register from "../screens/auth/register/Register";
import ForgotPassword from "../screens/auth/forgot_password/ForgotPassword";
import OnboardingStack from "../screens/onboarding/OnboardingStack";
import MainTabs from "./MainTabs";
import { navigationRef } from "./navigationRef";
import { useTheme } from "../theme/ThemeContext";
import { getNavigationTheme } from "../theme/navigationTheme";

const Stack = createNativeStackNavigator();
const EMAIL_VERIFIED_FLAG = "@kilowatch/emailVerifiedFlag";

// Lazy so a Notifications-screen bug cannot block cold start / login.
function NotificationsScreen(props) {
  const Notifications =
    require("../screens/notifications/Notifications").default;
  return <Notifications {...props} />;
}

export default function AppNavigator() {
  const { colors } = useTheme();
  const navTheme = useMemo(() => getNavigationTheme(colors), [colors]);

  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState(null);
  const [profileReady, setProfileReady] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [sessionBlocked, setSessionBlocked] = useState(false);
  // Prevents overlapping sign-out loops when the disabled profile listener re-fires.
  const signingOutDisabledRef = useRef(false);

  // Firebase Auth session — drives which stack tree is mounted.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setInitializing(false);
      if (!currentUser) {
        setProfileReady(false);
        setNeedsOnboarding(false);
        setSessionBlocked(false);
      }
    });
    return unsubscribe;
  }, []);

  // Profile listener: onboarding gate + admin-disabled account kick-out.
  useEffect(() => {
    if (!user?.uid) return undefined;

    setProfileReady(false);
    const unsubscribe = onValue(
      ref(database, paths.userProfile(user.uid)),
      (snap) => {
        const profile = snap.val() || {};

        if (isAccountDisabled(profile)) {
          setSessionBlocked(true);
          setProfileReady(true);
          setNeedsOnboarding(false);
          if (!signingOutDisabledRef.current) {
            signingOutDisabledRef.current = true;
            Alert.alert("Account disabled", ACCOUNT_DISABLED_MESSAGE);
            signOutGoogle()
              .catch(() => undefined)
              .finally(() =>
                signOut(auth)
                  .catch(() => undefined)
                  .finally(() => {
                    signingOutDisabledRef.current = false;
                  })
              );
          }
          return;
        }

        setSessionBlocked(false);

        // New users (and anyone who never finished) see onboarding.
        // Existing users who already set a rate are treated as done.
        const done =
          profile.onboardingCompleted === true ||
          Boolean(profile.electricityRateUpdatedAt);
        setNeedsOnboarding(!done);
        setProfileReady(true);
      },
      () => {
        setNeedsOnboarding(false);
        setProfileReady(true);
      }
    );

    return unsubscribe;
  }, [user?.uid]);

  // Keep a local verified flag in sync after email-link verification.
  // Stay signed in — Account reloads Auth so "· Verified" can appear without
  // forcing a re-login (logout here previously hid the badge until sign-in).
  useEffect(() => {
    if (!user?.uid) return undefined;
    let cancelled = false;

    const check = async () => {
      if (cancelled) return;
      try {
        await auth.currentUser?.reload();
      } catch {
        return;
      }
      const fresh = auth.currentUser;
      if (!fresh || fresh.uid !== user.uid || cancelled) return;

      try {
        if (fresh.emailVerified) {
          await AsyncStorage.setItem(EMAIL_VERIFIED_FLAG, "1");
        } else {
          await AsyncStorage.setItem(EMAIL_VERIFIED_FLAG, "0");
        }
      } catch {
        // Flag is best-effort; Auth reload is what matters for the UI.
      }
    };

    check();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") check();
    });
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [user?.uid]);

  // Hold splash until auth + (when signed in) profile gate are known.
  if (initializing || (user && !sessionBlocked && !profileReady)) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  // Auth → onboarding → main tabs, or auth screens when signed out / blocked.
  return (
    <NavigationContainer ref={navigationRef} theme={navTheme}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        {user && !sessionBlocked ? (
          needsOnboarding ? (
            <Stack.Screen name="Onboarding" component={OnboardingStack} />
          ) : (
            <>
              <Stack.Screen name="MainTabs" component={MainTabs} />
              <Stack.Screen
                name="Notifications"
                component={NotificationsScreen}
                options={{ animation: "slide_from_right" }}
              />
            </>
          )
        ) : (
          <>
            <Stack.Screen name="Login" component={Login} />
            <Stack.Screen name="Register" component={Register} />
            <Stack.Screen name="ForgotPassword" component={ForgotPassword} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
