import * as Linking from "expo-linking";
import { router, Stack } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, LogBox, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { AuthProvider, useAuth } from "../components/auth/AuthProvider";
import { SyncProvider } from "../components/sync/SyncProvider";
import {
  authenticateAppUnlock,
  isAppLockEnabled,
  isBiometricUnlockAvailable,
} from "../lib/appLockService";
import { setHapticsEnabled } from "../lib/haptics";
import { getProfileSettings } from "../lib/settingsService";


function routeFromAppIntentUrl(url: string): string | Record<string, unknown> | null {
  const parsed = Linking.parse(url);
  const path = parsed.path ?? "";

  switch (path) {
    case "dashboard":
      return "/(tabs)";
    case "add-item":
      return "/(tabs)/inventory";
    case "scanner":
      return "/scan-item";
    case "gear-assistant":
      return {
        pathname: "/(tabs)",
        params: {
          quickAction: "gearAssistant",
        },
      };
    case "search": {
      const query = parsed.queryParams?.query;

      if (typeof query === "string" && query.trim()) {
        return {
          pathname: "/(tabs)/inventory",
          params: {
            query: query.trim(),
          },
        };
      }

      return "/(tabs)/inventory";
    }
    case "checklist":
      return "/(tabs)/checklists";
    case "trip-prep":
      return "/(tabs)/trips";
    default:
      return null;
  }
}

function handleAppIntentUrl(url: string) {
  const route = routeFromAppIntentUrl(url);

  if (!route) {
    return;
  }

  router.push(route as never);
}

LogBox.ignoreLogs([
  "[RevenueCat]",
  "subscriber was not found",
  "Error when syncing subscriber attributes",
  "There was an unknown backend error. The subscriber was not found.",
  "Could not reach Cloud Firestore backend",
  "The client will operate in offline mode",
]);

function RootLayoutInner() {
  const { user } = useAuth();
  const [appLocked, setAppLocked] = useState(false);
  const [checkingAppLock, setCheckingAppLock] = useState(false);
  const unlockInProgressRef = useRef(false);
  const unlockedThisForegroundRef = useRef(false);
  const appStateRef = useRef(AppState.currentState);

  async function checkAppLock(force = false) {
    if (unlockInProgressRef.current) return;

    if (!force && unlockedThisForegroundRef.current) {
      setAppLocked(false);
      setCheckingAppLock(false);
      return;
    }
    if (!user) {
      setAppLocked(false);
      setCheckingAppLock(false);
      return;
    }

    try {
      unlockInProgressRef.current = true;
      setCheckingAppLock(true);

      const enabled = await isAppLockEnabled();
      if (!enabled) {
        setAppLocked(false);
        return;
      }

      const available = await isBiometricUnlockAvailable();
      if (!available) {
        setAppLocked(false);
        return;
      }

      setAppLocked(true);
      const unlocked = await authenticateAppUnlock();

      if (unlocked) {
        unlockedThisForegroundRef.current = true;
      }

      setAppLocked(!unlocked);
    } catch (error) {
      console.error("App Lock failed:", error);
      setAppLocked(false);
    } finally {
      unlockInProgressRef.current = false;
      setCheckingAppLock(false);
    }
  }

  useEffect(() => {
    void checkAppLock();
  }, [user]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;

      if (nextState === "background" || nextState === "inactive") {
        unlockedThisForegroundRef.current = false;
        return;
      }

      if (
        nextState === "active" &&
        (previousState === "background" || previousState === "inactive")
      ) {
        void checkAppLock();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [user]);

  useEffect(() => {
    Linking.getInitialURL()
      .then((url) => {
        if (url) {
          handleAppIntentUrl(url);
        }
      })
      .catch((err) => {
        console.error("Failed to handle initial app intent URL:", err);
      });

    const subscription = Linking.addEventListener("url", ({ url }) => {
      handleAppIntentUrl(url);
    });

    return () => {
      subscription.remove();
    };
  }, []);

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

  if (checkingAppLock) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#0b1020",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <ActivityIndicator color="#ffffff" />
        <Text
          style={{
            color: "#ffffff",
            marginTop: 14,
            fontWeight: "700",
            textAlign: "center",
          }}
        >
          Checking App Lock...
        </Text>
      </View>
    );
  }

  if (appLocked) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#0b1020",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <Text
          style={{
            color: "#ffffff",
            fontSize: 22,
            fontWeight: "900",
            textAlign: "center",
            marginBottom: 8,
          }}
        >
          Where's My Gear is Locked
        </Text>
        <Text
          style={{
            color: "#cbd5e1",
            fontSize: 15,
            fontWeight: "600",
            textAlign: "center",
            marginBottom: 18,
          }}
        >
          Use Face ID or Touch ID to unlock your gear.
        </Text>

        <Text
          onPress={() => {
            void checkAppLock(true);
          }}
          style={{
            color: "#60a5fa",
            fontSize: 16,
            fontWeight: "900",
            textAlign: "center",
            paddingHorizontal: 18,
            paddingVertical: 10,
          }}
        >
          Try Again
        </Text>
      </View>
    );
  }

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
        <SyncProvider>
          <RootLayoutInner />
        </SyncProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}