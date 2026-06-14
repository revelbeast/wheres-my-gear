import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from "expo-local-authentication";

const APP_LOCK_ENABLED_KEY = "wmg.appLock.enabled.v1";

export async function isAppLockEnabled(): Promise<boolean> {
  const value = await AsyncStorage.getItem(APP_LOCK_ENABLED_KEY);
  return value === "true";
}

export async function setAppLockEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(APP_LOCK_ENABLED_KEY, enabled ? "true" : "false");
}

export async function isBiometricUnlockAvailable(): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  if (!hasHardware) return false;

  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  return isEnrolled;
}

export async function getBiometricLabel(): Promise<string> {
  const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();

  if (
    supportedTypes.includes(
      LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION
    )
  ) {
    return "Face ID";
  }

  if (
    supportedTypes.includes(
      LocalAuthentication.AuthenticationType.FINGERPRINT
    )
  ) {
    return "Touch ID";
  }

  return "Biometric Unlock";
}

export async function authenticateAppUnlock(): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: "Unlock Where's My Gear",
    cancelLabel: "Cancel",
    disableDeviceFallback: false,
  });

  return result.success;
}
