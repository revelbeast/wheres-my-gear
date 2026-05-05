import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { colors } from "../../theme/tokens";
import HapticPressable from "../ui/HapticPressable";

type Item = {
  id: string;
  title: string;
  missingCount: number;
};

type Props = {
  data: Item[];
  onPressItem?: (id: string) => void;
};

export default function ChecklistPreviewCard({ data, onPressItem }: Props) {
  if (!data || data.length === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.emptyText}>No checklists</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      {data.map((item, index) => (
        <HapticPressable
          key={item.id}
          style={[
            styles.row,
            index < data.length - 1 ? styles.rowBorder : undefined,
          ]}
          onPress={() => onPressItem?.(item.id)}
        >
          <View style={styles.left}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.meta}>
              {item.missingCount}{" "}
              {item.missingCount === 1 ? "Item" : "Items"} to Pack
            </Text>
          </View>

          <ChevronRight size={18} color={colors.textSecondary} />
        </HapticPressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: "rgba(12,24,50,0.9)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  row: {
    minHeight: 66,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
    marginBottom: 6,
    paddingBottom: 6,
  },
  left: {
    flex: 1,
    paddingRight: 10,
  },
  title: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 4,
  },
  meta: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  emptyText: {
    color: colors.textMuted,
    textAlign: "center",
    paddingVertical: 12,
  },
});