import React from "react";
import { LogBox } from "react-native";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { AuthProvider } from "../components/auth/AuthProvider";

LogBox.ignoreLogs([
  "[RevenueCat]",
  "subscriber was not found",
  "Error when syncing subscriber attributes",
  "There was an unknown backend error. The subscriber was not found.",
]);

function RootLayoutInner() {
  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <RootLayoutInner />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}