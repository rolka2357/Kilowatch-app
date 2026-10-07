import { createNativeStackNavigator } from "@react-navigation/native-stack";

import Appliances from "./appliance/Appliances";
import RoomDetails from "./appliance_details/RoomDetails";
import RoomAppliances from "./appliance_details/RoomAppliances";
import RoomAnalytics from "./appliance_details/RoomAnalytics";
import ApplianceDetail from "./appliance_details/ApplianceDetail";
import ApplianceAnalytics from "./appliance_details/ApplianceAnalytics";
import ApplianceSchedule from "./appliance_details/ApplianceSchedule";
import ApplianceUsageLimit from "./appliance_details/ApplianceUsageLimit";
import BaseHeader from "../../components/header/base_header/BaseHeader";

const Stack = createNativeStackNavigator();

export default function AppliancesStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="AppliancesHome"
        component={Appliances}
        options={{
          headerShown: true,
          header: () => <BaseHeader />,
        }}
      />

      <Stack.Screen
        name="RoomDetails"
        component={RoomDetails}
        options={{
          headerShown: false,
          animation: "slide_from_right",
        }}
      />

      <Stack.Screen
        name="RoomAppliances"
        component={RoomAppliances}
        options={{
          headerShown: false,
          animation: "slide_from_right",
        }}
      />

      <Stack.Screen
        name="RoomAnalytics"
        component={RoomAnalytics}
        options={{
          headerShown: false,
          animation: "slide_from_right",
        }}
      />

      <Stack.Screen
        name="ApplianceDetail"
        component={ApplianceDetail}
        options={{
          headerShown: false,
          animation: "slide_from_right",
        }}
      />

      <Stack.Screen
        name="ApplianceAnalytics"
        component={ApplianceAnalytics}
        options={{
          headerShown: false,
          animation: "slide_from_right",
        }}
      />

      <Stack.Screen
        name="ApplianceUsageLimit"
        component={ApplianceUsageLimit}
        options={{
          headerShown: false,
          animation: "slide_from_right",
        }}
      />

      <Stack.Screen
        name="ApplianceSchedule"
        component={ApplianceSchedule}
        options={{
          headerShown: false,
          animation: "slide_from_right",
        }}
      />
    </Stack.Navigator>
  );
}
