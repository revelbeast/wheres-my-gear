import React from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import { ArrowLeft } from "lucide-react-native";
import { router } from "expo-router";

import { colors } from "../../theme/tokens";

type Props = {
  title?: string;
  showBackButton?: boolean;
  onBackPress?: () => void;
  rightContent?: React.ReactNode;
};

export default function AppHeader({
  title,
  showBackButton = false,
  onBackPress,
  rightContent,
}: Props) {
  function handleBackPress() {
    if (onBackPress) {
      onBackPress();
      return;
    }

    router.back();
  }

  return (
    <View style={styles.container}>
      <View style={styles.left}>
        {showBackButton ? (
          <Pressable style={styles.backButton} onPress={handleBackPress}>
            <ArrowLeft size={20} color={colors.text} />
          </Pressable>
        ) : (
          <View style={styles.sideSpacer} />
        )}
      </View>

      <View style={styles.center}>
        {!!title && (
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        )}
      </View>

      <View style={styles.right}>
        {rightContent ? rightContent : <View style={styles.sideSpacer} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  left: {
    width: 48,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  right: {
    width: 48,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  sideSpacer: {
    width: 40,
    height: 40,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(12,24,50,0.9)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
});