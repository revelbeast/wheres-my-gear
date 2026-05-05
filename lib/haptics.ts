import * as Haptics from "expo-haptics";

let enabled = true;

export function setHapticsEnabled(value: boolean) {
  enabled = value;
}

export function isHapticsEnabled() {
  return enabled;
}

export function triggerLightHaptic() {
  if (!enabled) return;

  try {
    Haptics.selectionAsync();
  } catch (err) {
    console.warn("Haptics failed:", err);
  }
}

export function triggerSuccessHaptic() {
  if (!enabled) return;

  try {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch (err) {
    console.warn("Haptics failed:", err);
  }
}