import { router, useSegments } from "expo-router";
import React from "react";
import { StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";

const TAB_PATHS = [
  "/(tabs)",
  "/(tabs)/inventory",
  "/(tabs)/checklists",
  "/(tabs)/profile",
];

type Props = {
  children: React.ReactNode;
};

function getCurrentTabIndex(segments: string[]) {
  const joined = segments.join("/");

  if (joined.includes("profile")) return 3;
  if (joined.includes("checklists")) return 2;
  if (joined.includes("inventory")) return 1;

  return 0;
}

export default function SwipeTabsWrapper({ children }: Props) {
  const segments = useSegments();

  function navigateBySwipe(direction: "forward" | "back") {
    const currentIndex = getCurrentTabIndex(segments);

    if (direction === "forward" && currentIndex < TAB_PATHS.length - 1) {
      router.replace(TAB_PATHS[currentIndex + 1] as any);
      return;
    }

    if (direction === "back" && currentIndex > 0) {
      router.replace(TAB_PATHS[currentIndex - 1] as any);
    }
  }

  const panGesture = Gesture.Pan()
    .activeOffsetX([-18, 18])
    .failOffsetY([-70, 70])
    .onEnd((event) => {
      const horizontalDistance = event.translationX;
      const horizontalVelocity = event.velocityX;

      if (horizontalDistance < -55 || horizontalVelocity < -700) {
        runOnJS(navigateBySwipe)("forward");
        return;
      }

      if (horizontalDistance > 55 || horizontalVelocity > 700) {
        runOnJS(navigateBySwipe)("back");
      }
    });

  return (
    <GestureDetector gesture={panGesture}>
      <View style={styles.container}>{children}</View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});