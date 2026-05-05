import { Stack } from "expo-router";
import React, { useEffect } from "react";
import { LogBox } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { AuthProvider, useAuth } from "../components/auth/AuthProvider";
import { setHapticsEnabled } from "../lib/haptics";
import { getProfileSettings } from "../lib/settingsService";

LogBox.ignoreLogs([
  "[RevenueCat]",
  "subscriber was not found",
  "Error when syncing subscriber attributes",
  "There was an unknown backend error. The subscriber was not found.",
]);

function RootLayoutInner() {
  const { user } = useAuth();

  useEffect(() => {
    async function loadHaptics() {
      if (!user) return;

      try {
        const profile = await getProfileSettings(user.uid);
        setHapticsEnabled(profile.hapticsEnabled ?? true);
      } catch (err) {
        console.error("Failed to load haptics setting:", err);
      }
    }

    loadHaptics();
  }, [user]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    />
  );
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