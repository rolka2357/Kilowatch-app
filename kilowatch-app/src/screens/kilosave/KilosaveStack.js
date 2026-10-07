import { createNativeStackNavigator } from "@react-navigation/native-stack";

import BaseHeader from "../../components/header/base_header/BaseHeader";
import KilosaveHome from "./KilosaveHome";
import SetBudgetGoal from "./SetBudgetGoal";
import SetAsideMoney from "./SetAsideMoney";
import LogBill from "./LogBill";

const Stack = createNativeStackNavigator();

export default function KilosaveStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="KilosaveHome"
        component={KilosaveHome}
        options={{
          headerShown: true,
          header: () => <BaseHeader />,
        }}
      />
      <Stack.Screen
        name="SetBudgetGoal"
        component={SetBudgetGoal}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="SetAsideMoney"
        component={SetAsideMoney}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="LogBill"
        component={LogBill}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}
