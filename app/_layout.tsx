import * as Linking from "expo-linking";
import { router, Stack } from "expo-router";
import React, { useEffect } from "react";
import { LogBox } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { AuthProvider, useAuth } from "../components/auth/AuthProvider";
import { SyncProvider } from "../components/sync/SyncProvider";
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