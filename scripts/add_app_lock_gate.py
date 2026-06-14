from pathlib import Path

path = Path("app/_layout.tsx")
text = path.read_text()

text = text.replace(
    '''import React, { useEffect } from "react";
import { LogBox } from "react-native";''',
    '''import React, { useEffect, useState } from "react";
import { ActivityIndicator, AppState, LogBox, Text, View } from "react-native";''',
    1,
)

text = text.replace(
    '''import { setHapticsEnabled } from "../lib/haptics";''',
    '''import {
  authenticateAppUnlock,
  isAppLockEnabled,
  isBiometricUnlockAvailable,
} from "../lib/appLockService";
import { setHapticsEnabled } from "../lib/haptics";''',
    1,
)

old = '''function RootLayoutInner() {
  const { user } = useAuth();


  useEffect(() => {'''

new = '''function RootLayoutInner() {
  const { user } = useAuth();
  const [appLocked, setAppLocked] = useState(false);
  const [checkingAppLock, setCheckingAppLock] = useState(false);

  async function checkAppLock() {
    if (!user) {
      setAppLocked(false);
      setCheckingAppLock(false);
      return;
    }

    try {
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
      setAppLocked(!unlocked);
    } catch (error) {
      console.error("App Lock failed:", error);
      setAppLocked(false);
    } finally {
      setCheckingAppLock(false);
    }
  }

  useEffect(() => {
    void checkAppLock();
  }, [user]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        void checkAppLock();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [user]);

  useEffect(() => {'''

if old not in text:
    raise SystemExit("Could not find RootLayoutInner anchor")

text = text.replace(old, new, 1)

old_return = '''  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    />
  );
}'''

new_return = '''  if (checkingAppLock) {
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
          }}
        >
          Close and reopen the app to try Face ID again.
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
}'''

if old_return not in text:
    raise SystemExit("Could not find Stack return block")

text = text.replace(old_return, new_return, 1)

path.write_text(text)
print("Added App Lock gate to app/_layout.tsx")
