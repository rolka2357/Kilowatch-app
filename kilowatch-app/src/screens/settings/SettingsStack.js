import { createNativeStackNavigator } from "@react-navigation/native-stack";

import SettingsHome from "./SettingsHome";
import Account from "./Account";
import EditName from "./EditName";
import EditEmail from "./EditEmail";
import ElectricityRate from "./ElectricityRate";
import BillingPeriod from "./BillingPeriod";
import ConfirmElectricityRate from "./ConfirmElectricityRate";
import People from "./People";
import InvitePerson from "./InvitePerson";
import TransferOwnership from "./TransferOwnership";
import TransferSuccess from "./TransferSuccess";
import Security from "./Security";
import EditHomeName from "./EditHomeName";
import Help from "./Help";
import About from "./About";
import SettingsHeader from "../../components/header/settings_header/SettingsHeader";

const Stack = createNativeStackNavigator();

export default function SettingsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="SettingsHome"
        component={SettingsHome}
        options={{
          headerShown: true,
          header: () => <SettingsHeader title="Settings" showBack={false} />,
        }}
      />
      <Stack.Screen name="Account" component={Account} />
      <Stack.Screen name="EditName" component={EditName} />
      <Stack.Screen name="EditEmail" component={EditEmail} />
      <Stack.Screen name="ElectricityRate" component={ElectricityRate} />
      <Stack.Screen name="BillingPeriod" component={BillingPeriod} />
      <Stack.Screen
        name="ConfirmElectricityRate"
        component={ConfirmElectricityRate}
      />
      <Stack.Screen name="People" component={People} />
      <Stack.Screen name="InvitePerson" component={InvitePerson} />
      <Stack.Screen name="TransferOwnership" component={TransferOwnership} />
      <Stack.Screen name="TransferSuccess" component={TransferSuccess} />
      <Stack.Screen name="Security" component={Security} />
      <Stack.Screen name="EditHomeName" component={EditHomeName} />
      <Stack.Screen name="Help" component={Help} />
      <Stack.Screen name="About" component={About} />
    </Stack.Navigator>
  );
}
