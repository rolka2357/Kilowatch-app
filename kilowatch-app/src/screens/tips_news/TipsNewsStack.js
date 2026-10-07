import { createNativeStackNavigator } from "@react-navigation/native-stack";

import BaseHeader from "../../components/header/base_header/BaseHeader";
import { TipsProvider } from "../../context/TipsContext";
import TipsNewsHome from "./TipsNewsHome";
import RoomTipsDetail from "./RoomTipsDetail";

const Stack = createNativeStackNavigator();

export default function TipsNewsStack() {
  return (
    <TipsProvider>
      <Stack.Navigator>
        <Stack.Screen
          name="TipsNewsHome"
          component={TipsNewsHome}
          options={{
            headerShown: true,
            header: () => <BaseHeader />,
          }}
        />
        <Stack.Screen
          name="RoomTipsDetail"
          component={RoomTipsDetail}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    </TipsProvider>
  );
}
