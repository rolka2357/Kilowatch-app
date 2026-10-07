/**
 * PURPOSE: Signed-in bottom-tab shell.
 * Mounts background Tuya/notification runners under HomeProvider, and hides
 * the KiloSave tab for non-owners (including after ownership transfer).
 */
import { useEffect } from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { getFocusedRouteNameFromRoute } from "@react-navigation/native";

import { auth } from "../firebase/firebaseConfig";
import { migrateUserData } from "../firebase/migrateDatabase";
import { syncOwnershipIndexes } from "../firebase/deviceOwnership";
import ApplianceStack from "../screens/appliances/ApplianceStack";
import Analytics from "../screens/analytics/Analytics";
import Kilosave from "../screens/kilosave/Kilosave";
import TipsNewsStack from "../screens/tips_news/TipsNewsStack";
import Settings from "../screens/settings/Settings";
import BaseHeader from "../components/header/base_header/BaseHeader";
import { HomeProvider, useHome } from "../context/HomeContext";
import { useTheme } from "../theme/ThemeContext";
import KilosaveReminderRunner from "../notifications/KilosaveReminderRunner";

import ApplianceIcon from "../../assets/svg/shared/appliances_icon.svg";
import KilosaveIcon from "../../assets/svg/shared/kilosave_icon.svg";
import AnalyticsIcon from "../../assets/svg/shared/analytics_icon.svg";
import TipsNewsIcon from "../../assets/svg/shared/tips_news_icon.svg";
import SettingsIcon from "../../assets/svg/shared/settings_icon.svg";
import TuyaStatusSync from "../tuya/TuyaStatusSync";
import DeviceCommandRunner from "../tuya/DeviceCommandRunner";
import ScheduleRunner from "../tuya/ScheduleRunner";
import UsageLimitRunner from "../tuya/UsageLimitRunner";
import UsageLimitNotificationHandler from "../notifications/UsageLimitNotificationHandler";
import HouseholdAlertListener from "../notifications/HouseholdAlertListener";
import PushTokenRegistrar from "../notifications/PushTokenRegistrar";

const Tab = createBottomTabNavigator();

// Nested appliance/room detail routes — hide the tab bar for a full-screen feel.
const ROOM_ROUTES_HIDE_TAB = new Set([
  "RoomDetails",
  "RoomAppliances",
  "RoomAnalytics",
  "ApplianceDetail",
  "ApplianceAnalytics",
  "ApplianceUsageLimit",
  "ApplianceSchedule",
]);

/** Re-tapping an already-focused tab pops its nested stack to the root screen. */
function resetStackOnRetap({ navigation, route }) {
  return {
    tabPress: () => {
      const state = navigation.getState();
      if (state.routes[state.index]?.key !== route.key) return;
      const nested = state.routes[state.index]?.state;
      if (!nested || typeof nested.index !== "number" || nested.index === 0) {
        return;
      }
      const rootName = nested.routeNames?.[0] || nested.routes?.[0]?.name;
      if (rootName) {
        navigation.navigate(route.name, { screen: rootName });
      }
    },
  };
}

function appliancesTabOptions(colors, route) {
  const routeName = getFocusedRouteNameFromRoute(route) ?? "AppliancesHome";
  const hideTab = ROOM_ROUTES_HIDE_TAB.has(routeName);

  return {
    tabBarIcon: ({ color }) => (
      <ApplianceIcon width={18} height={18} fill={color} color={color} />
    ),
    headerShown: false,
    tabBarStyle: hideTab
      ? { display: "none" }
      : {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
        },
  };
}

function MainTabsInner() {
  const { colors } = useTheme();
  const { isHomeOwner } = useHome();
  // Budget goals belong to the household owner (not editors/viewers).
  const showKilosave = isHomeOwner;

  // Schema migration + QR ownership backfill once per signed-in session.
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    migrateUserData(user.uid)
      .then(() => syncOwnershipIndexes(user.uid))
      .catch((error) => console.warn("Database migration skipped", error));
  }, []);

  return (
    <>
      {/* Headless runners — live as long as the main tab tree is mounted. */}
      <TuyaStatusSync />
      <DeviceCommandRunner />
      <ScheduleRunner />
      <UsageLimitRunner />
      <UsageLimitNotificationHandler />
      <HouseholdAlertListener />
      <PushTokenRegistrar />
      <KilosaveReminderRunner />
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.tabInactive,
          tabBarStyle: {
            backgroundColor: colors.card,
            borderTopColor: colors.border,
          },
          tabBarLabelStyle: {
            fontFamily: "Roobert TRIAL Medium",
            fontSize: 11,
          },
          sceneStyle: {
            backgroundColor: colors.background,
          },
        }}
      >
        <Tab.Screen
          name="Appliances"
          component={ApplianceStack}
          options={({ route }) => appliancesTabOptions(colors, route)}
          listeners={resetStackOnRetap}
        />

        <Tab.Screen
          name="Analytics"
          component={Analytics}
          options={{
            tabBarIcon: ({ color }) => (
              <AnalyticsIcon
                width={18}
                height={18}
                fill={color}
                color={color}
              />
            ),
            headerShown: true,
            header: () => <BaseHeader />,
          }}
        />
        <Tab.Screen
          name="Kilosave"
          component={Kilosave}
          options={{
            tabBarIcon: ({ color }) => (
              <KilosaveIcon width={18} height={18} fill={color} color={color} />
            ),
            headerShown: false,
            // KiloSave follows the household owner (including after transfer).
            tabBarButton: showKilosave ? undefined : () => null,
            tabBarItemStyle: showKilosave ? undefined : { display: "none" },
          }}
          listeners={({ navigation }) => ({
            tabPress: (event) => {
              if (showKilosave) return;
              event.preventDefault();
              navigation.navigate("Appliances");
            },
          })}
        />
        <Tab.Screen
          name="Tips & News"
          component={TipsNewsStack}
          options={{
            tabBarIcon: ({ color }) => (
              <TipsNewsIcon width={18} height={18} fill={color} color={color} />
            ),
            headerShown: false,
          }}
          listeners={resetStackOnRetap}
        />
        <Tab.Screen
          name="Settings"
          component={Settings}
          options={{
            tabBarIcon: ({ color }) => (
              <SettingsIcon width={18} height={18} fill={color} color={color} />
            ),
          }}
          listeners={resetStackOnRetap}
        />
      </Tab.Navigator>
    </>
  );
}

export default function MainTabs() {
  return (
    <HomeProvider>
      <MainTabsInner />
    </HomeProvider>
  );
}
