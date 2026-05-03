import React, { useEffect, useRef } from "react";
import { LogBox } from "react-native";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { AuthProvider, useAuth } from "../components/auth/AuthProvider";
import { initRevenueCat } from "../lib/revenuecat";

LogBox.ignoreLogs([
  "[RevenueCat]",
  "subscriber was not found",
  "Error when syncing subscriber attributes",
  "There was an unknown backend error. The subscriber was not found.",
]);

function RootLayoutInner() {
  const { user, initializing } = useAuth();

  const revenueCatInitialized = useRef(false);

  useEffect(() => {
    if (initializing) return;
    if (!user?.uid) return;

    if (revenueCatInitialized.current) return;

    revenueCatInitialized.current = true;

    initRevenueCat(user.uid);
  }, [user?.uid, initializing]);

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