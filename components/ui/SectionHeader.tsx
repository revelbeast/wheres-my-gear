import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { colors } from "../../theme/tokens";
import HapticPressable from "./HapticPressable";

type Props = {
  title: string;
  actionLabel?: string;
  onPressAction?: () => void;
};

export default function SectionHeader({
  title,
  actionLabel,
  onPressAction,
}: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>

      {actionLabel ? (
        <HapticPressable style={styles.action} onPress={onPressAction}>
          <Text style={styles.actionText}>{actionLabel}</Text>
          <ChevronRight size={16} color={colors.textSecondary} />
        </HapticPressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "700",
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
  },
  actionText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: "600",
    marginRight: 2,
  },
});