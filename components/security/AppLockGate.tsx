import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from "expo-local-authentication";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  AppState,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import HapticPressable from "../ui/HapticPressable";

const APP_LOCK_ENABLED_KEY = "wmg.appLock.enabled.v1";
const APP_LOCK_PASSCODE_KEY = "wmg.appLock.passcode.v1";

type Props = {
  children: React.ReactNode;
};

type LockStatus = "checking" | "unlocked" | "locked";

export default function AppLockGate({ children }: Props) {
  const [status, setStatus] = useState<LockStatus>("checking");
  const [passcode, setPasscode] = useState("");
  const [storedPasscode, setStoredPasscode] = useState<string | null>(null);
  const authenticatingRef = useRef(false);
  const appWasBackgroundedRef = useRef(false);

  const unlockWithBiometrics = useCallback(async () => {
    if (authenticatingRef.current) return false;

    authenticatingRef.current = true;

    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !enrolled) {
        return false;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Unlock Where's My Gear",
        fallbackLabel: "Use Passcode",
        cancelLabel: "Use Passcode",
        disableDeviceFallback: true,
      });

      if (result.success) {
        setPasscode("");
        setStatus("unlocked");
        return true;
      }

      return false;
    } catch (err) {
      console.error("Face ID unlock failed:", err);
      return false;
    } finally {
      authenticatingRef.current = false;
    }
  }, []);

  const checkLock = useCallback(async () => {
    try {
      const enabled = await AsyncStorage.getItem(APP_LOCK_ENABLED_KEY);
      const savedPasscode = await AsyncStorage.getItem(APP_LOCK_PASSCODE_KEY);

      setStoredPasscode(savedPasscode);

      if (enabled !== "true" || !savedPasscode) {
        setStatus("unlocked");
        return;
      }

      setStatus("locked");

      const biometricUnlocked = await unlockWithBiometrics();

      if (!biometricUnlocked) {
        setStatus("locked");
      }
    } catch (err) {
      console.error("Failed to check app lock:", err);
      setStatus("unlocked");
    }
  }, [unlockWithBiometrics]);

  useEffect(() => {
    void checkLock();
  }, [checkLock]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "background" || nextState === "inactive") {
        appWasBackgroundedRef.current = true;
        return;
      }

      if (nextState === "active" && appWasBackgroundedRef.current) {
        appWasBackgroundedRef.current = false;
        void checkLock();
      }
    });

    return () => sub.remove();
  }, [checkLock]);

  function handlePasscodeUnlock() {
    if (!storedPasscode) {
      setStatus("unlocked");
      return;
    }

    if (passcode === storedPasscode) {
      setPasscode("");
      setStatus("unlocked");
      return;
    }

    Alert.alert("Incorrect Passcode", "Try again.");
    setPasscode("");
  }

  if (status === "checking") {
    return (
      <View style={styles.loadingScreen}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <>
      {children}

      <Modal visible={status === "locked"} animationType="fade" transparent={false}>
        <View style={styles.lockScreen}>
          <Text style={styles.title}>Where's My Gear</Text>
          <Text style={styles.subtitle}>Unlock to continue</Text>

          <TextInput
            value={passcode}
            onChangeText={setPasscode}
            placeholder="Enter passcode"
            placeholderTextColor="rgba(255,255,255,0.45)"
            secureTextEntry
            keyboardType="number-pad"
            style={styles.input}
            maxLength={12}
          />

          <HapticPressable style={styles.primaryButton} onPress={handlePasscodeUnlock}>
            <Text style={styles.primaryButtonText}>Unlock</Text>
          </HapticPressable>

          <HapticPressable
            style={styles.secondaryButton}
            onPress={() => {
              void unlockWithBiometrics();
            }}
          >
            <Text style={styles.secondaryButtonText}>Use Face ID</Text>
          </HapticPressable>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    backgroundColor: "#020617",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: "#FFFFFF",
    fontSize: 16,
  },
  lockScreen: {
    flex: 1,
    backgroundColor: "#020617",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 8,
  },
  subtitle: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 16,
    marginBottom: 28,
  },
  input: {
    width: "100%",
    maxWidth: 320,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: "#FFFFFF",
    fontSize: 18,
    marginBottom: 14,
    textAlign: "center",
  },
  primaryButton: {
    width: "100%",
    maxWidth: 320,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "#2563EB",
    marginBottom: 12,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: "#93C5FD",
    fontSize: 15,
    fontWeight: "700",
  },
});
