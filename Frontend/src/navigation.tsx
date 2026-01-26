import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import StartScreen from "./screens/StartScreen";
import LoginScreen from "./screens/LoginScreen";
import SignupScreen from "./screens/SignupScreen";
import IntroVideoScreen from "./screens/IntroVideoScreen";
import RocketSelectScreen from "./screens/RocketSelectScreen";
import CockpitScreen from "./screens/CockpitScreen";

export type RootStackParamList = {
  Start: undefined;
  Login: undefined;
  Signup: undefined;
  Intro: undefined;
  RocketSelect: undefined;
  Cockpit:
    | {
        rocketId?: number;
        round?: number;
        startInRound?: boolean;
      }
    | undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigation() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Start" component={StartScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Signup" component={SignupScreen} />
        <Stack.Screen name="Intro" component={IntroVideoScreen} />
        <Stack.Screen name="RocketSelect" component={RocketSelectScreen} />
        <Stack.Screen name="Cockpit" component={CockpitScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
