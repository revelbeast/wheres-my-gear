import React, { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  InteractionManager,
  StyleSheet,
  View,
} from "react-native";
import { Stack, usePathname } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { AuthProvider, useAuth } from "../components/auth/AuthProvider";
import BottomTabBar from "../components/navigation/BottomTabBar";
import { initializeAdsSafely } from "../lib/adsService";
import { initRevenueCat } from "../lib/revenuecat";
import { useTheme } from "../lib/useTheme";

function RootNavigator() {
  const { user, initializing } = useAuth();
  const pathname = usePathname();
  const theme = useTheme();

  const revenueCatLoggedInUserRef = useRef<string | null>(null);
  const adsInitializedRef = useRef(false);

  useEffect(() => {
    if (initializing) return;
    if (!user?.uid) return;

    if (revenueCatLoggedInUserRef.current === user.uid) return;

    const interactionTask = InteractionManager.runAfterInteractions(() => {
      initRevenueCat(user.uid)
        .then(() => {
          revenueCatLoggedInUserRef.current = user.uid;
        })
        .catch((error) => {
          console.error("RevenueCat initialization failed:", error);
        });
    });

    return () => {
      interactionTask.cancel();
    };
  }, [initializing, user?.uid]);

  useEffect(() => {
    if (initializing) return;
    if (!user?.uid) return;
    if (adsInitializedRef.current) return;

    const interactionTask = InteractionManager.runAfterInteractions(() => {
      initializeAdsSafely()
        .then((initialized) => {
          adsInitializedRef.current = initialized;
        })
        .catch((error) => {
          console.error("Safe ads initialization wrapper failed:", error);
          adsInitializedRef.current = false;
        });
    });

    return () => {
      interactionTask.cancel();
    };
  }, [initializing, user?.uid]);

  const isMainTabScreen =
    pathname === "/" ||
    pathname === "/inventory" ||
    pathname === "/checklists" ||
    pathname === "/profile";

  if (initializing) {
    return (
      <GestureHandlerRootView style={styles.flex}>
        <View
          style={[
            styles.loadingWrap,
            { backgroundColor: theme.colors.background },
          ]}
        >
          <ActivityIndicator size="large" color={theme.colors.text} />
        </View>
      </GestureHandlerRootView>
    );
  }

  if (!user) {
    return (
      <GestureHandlerRootView style={styles.flex}>
        <Stack
          screenOptions={{
            headerShown: false,
            gestureEnabled: true,
            fullScreenGestureEnabled: true,
            animation: "slide_from_right",
          }}
        >
          <Stack.Screen name="sign-in" />
        </Stack>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.flex}>
      <View
        style={[
          styles.appShell,
          { backgroundColor: theme.colors.background },
        ]}
      >
        <Stack
          screenOptions={{
            headerShown: false,
            gestureEnabled: true,
            fullScreenGestureEnabled: true,
            animation: "slide_from_right",
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="paywall" />

          <Stack.Screen name="vehicles/[vehicleId]" />
          <Stack.Screen name="vehicles/[vehicleId]/compartments/index" />
          <Stack.Screen name="vehicles/[vehicleId]/compartments/create" />
          <Stack.Screen name="vehicles/[vehicleId]/compartments/[compartmentId]" />
          <Stack.Screen name="items/index" />
          <Stack.Screen name="checklists/index" />
          <Stack.Screen name="checklists/create" />
          <Stack.Screen name="checklists/new" />
          <Stack.Screen name="checklists/templates" />
          <Stack.Screen name="checklists/[checklistId]" />
          <Stack.Screen name="storage/index" />
          <Stack.Screen name="storage/create" />
          <Stack.Screen name="storage/edit" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="profile-settings" />
          <Stack.Screen name="profile-address" />
          <Stack.Screen name="general-settings" />
          <Stack.Screen name="faq" />
          <Stack.Screen name="notifications" />
          <Stack.Screen name="privacy" />
          <Stack.Screen name="data-settings" />
          <Stack.Screen name="help-support" />
          <Stack.Screen name="password-management" />
          <Stack.Screen name="create-storage" />
          <Stack.Screen name="edit-storage/[storageId]" />
          <Stack.Screen name="notes" />
        </Stack>

        {!isMainTabScreen && <BottomTabBar />}
      </View>
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },

  appShell: {
    flex: 1,
  },

  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});