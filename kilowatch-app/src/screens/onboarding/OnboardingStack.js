import { createNativeStackNavigator } from "@react-navigation/native-stack";

import WelcomeOnboarding from "./WelcomeOnboarding";
import VideoOnboarding from "./VideoOnboarding";
import ProviderOnboarding from "./ProviderOnboarding";
import PermissionsOnboarding from "./PermissionsOnboarding";
import BillArrivalOnboarding from "./BillArrivalOnboarding";

const Stack = createNativeStackNavigator();

export default function OnboardingStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        contentStyle: { backgroundColor: "#FFFFFF" },
      }}
    >
      <Stack.Screen name="WelcomeOnboarding" component={WelcomeOnboarding} />
      <Stack.Screen name="VideoOnboarding" component={VideoOnboarding} />
      <Stack.Screen name="ProviderOnboarding" component={ProviderOnboarding} />
      <Stack.Screen
        name="PermissionsOnboarding"
        component={PermissionsOnboarding}
      />
      <Stack.Screen
        name="BillArrivalOnboarding"
        component={BillArrivalOnboarding}
      />
    </Stack.Navigator>
  );
}
