import React from "react";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          headerShown: false,
          gestureEnabled: true,
          fullScreenGestureEnabled: true,
          animation: "slide_from_right",
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="vehicles/[vehicleId]" />
        <Stack.Screen name="vehicles/[vehicleId]/compartments/[compartmentId]" />
        <Stack.Screen name="items/index" />
        <Stack.Screen name="checklists/index" />
        <Stack.Screen name="checklists/create" />
        <Stack.Screen name="checklists/[checklistId]" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="profile-settings" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="privacy" />
        <Stack.Screen name="data-settings" />
        <Stack.Screen name="help-support" />
        <Stack.Screen name="password-management" />
        <Stack.Screen name="create-storage" />
        <Stack.Screen name="edit-storage/[storageId]" />
      </Stack>
    </GestureHandlerRootView>
  );
}