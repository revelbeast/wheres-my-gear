import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from "expo-local-authentication";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AppState,
  Image,
  Modal,
  StyleSheet,
  Text,
  View,
} from "react-native";

import HapticPressable from "../ui/HapticPressable";

const APP_LOCK_ENABLED_KEY = "wmg.appLock.enabled.v1";

type Props = {
  children: React.ReactNode;
};

type LockStatus = "checking" | "unlocked" | "locked";

export default function AppLockGate({ children }: Props) {
  const [status, setStatus] = useState<LockStatus>("checking");
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
        promptMessage: "Unlock Where's My Gear with Face ID",
        fallbackLabel: "Use Passcode",
        cancelLabel: "Cancel",
        disableDeviceFallback: false,
        requireConfirmation: false,
      });

      if (result.success) {
        appWasBackgroundedRef.current = false;
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
      if (enabled !== "true") {
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
      if (nextState === "background") {
        appWasBackgroundedRef.current = true;
        return;
      }

      if (
        nextState === "active" &&
        appWasBackgroundedRef.current &&
        !authenticatingRef.current
      ) {
        appWasBackgroundedRef.current = false;
        void checkLock();
      }
    });

    return () => sub.remove();
  }, [checkLock]);

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
          <Image
            source={require("../../assets/images/app-icon-googleplay.png")}
            style={styles.logo}
          />

          <Text style={styles.title}>Where's My Gear</Text>
          <Text style={styles.subtitle}>Unlock to continue</Text>

          <HapticPressable
            style={styles.primaryButton}
            onPress={() => {
              void unlockWithBiometrics();
            }}
          >
            <Text style={styles.primaryButtonText}>Unlock with Face ID</Text>
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
  logo: {
    width: 104,
    height: 104,
    borderRadius: 24,
    marginBottom: 24,
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
  helperText: {
    color: "rgba(255,255,255,0.62)",
    fontSize: 14,
    lineHeight: 20,
    maxWidth: 320,
    textAlign: "center",
  },
});
