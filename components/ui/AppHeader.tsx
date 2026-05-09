import { router } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import React from "react";
import { StyleSheet, View } from "react-native";

import HapticPressable from "./HapticPressable";
import { ThemedText, useThemedValues } from "./Themed";

const LABEL_WHITE = "#FFFFFF";

export default function AppHeader({
  title,
  showBackButton = false,
  rightContent,
  backHref,
}: {
  title: string;
  showBackButton?: boolean;
  rightContent?: React.ReactNode;
  backHref?: string;
}) {
  const theme = useThemedValues();

  function handleBackPress() {
    if (backHref) {
      router.push(backHref as any);
      return;
    }

    router.back();
  }

  return (
    <View style={styles.container}>
      <View style={styles.inner}>
        {showBackButton ? (
          <HapticPressable
            style={[
              styles.iconButton,
              {
                backgroundColor: theme.isLight
                  ? "rgba(255,255,255,0.92)"
                  : "rgba(255,255,255,0.08)",
                borderColor: theme.colors.border,
              },
            ]}
            onPress={handleBackPress}
          >
            <ArrowLeft
            size={20}
            color={theme.isLight ? "#111827" : LABEL_WHITE}
          />
          </HapticPressable>
        ) : (
          <View style={styles.iconSpacer} />
        )}

        <View style={styles.titleWrap}>
          <ThemedText
            variant="title"
            numberOfLines={1}
            style={[styles.title, { color: LABEL_WHITE }]}
          >
            {title}
          </ThemedText>
        </View>

        {rightContent ? (
          <View style={styles.rightWrap}>{rightContent}</View>
        ) : (
          <View style={styles.iconSpacer} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },

  inner: {
    flexDirection: "row",
    alignItems: "center",
    height: 52,
  },

  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },

  iconSpacer: {
    width: 42,
    height: 42,
  },

  titleWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },

  title: {
    fontWeight: "800",
    textAlign: "center",
  },

  rightWrap: {
    alignItems: "flex-end",
    justifyContent: "center",
  },
});