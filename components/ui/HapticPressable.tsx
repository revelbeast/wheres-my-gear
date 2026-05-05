import React from "react";
import {
    GestureResponderEvent,
    Pressable,
    PressableProps,
} from "react-native";

import {
    triggerLightHaptic,
    triggerSuccessHaptic,
} from "../../lib/haptics";

type HapticFeedbackType = "light" | "success" | "none";

type HapticPressableProps = PressableProps & {
  hapticType?: HapticFeedbackType;
};

export default function HapticPressable({
  hapticType = "light",
  disabled,
  onPress,
  children,
  ...props
}: HapticPressableProps) {
  function handlePress(event: GestureResponderEvent) {
    if (disabled) return;

    if (hapticType === "light") {
      triggerLightHaptic();
    }

    if (hapticType === "success") {
      triggerSuccessHaptic();
    }

    onPress?.(event);
  }

  return (
    <Pressable {...props} disabled={disabled} onPress={handlePress}>
      {children}
    </Pressable>
  );
}