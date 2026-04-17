import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { colors } from "../../theme/tokens";

type Item = {
  id: string;
  name: string;
  itemCount: number;
};

type Props = {
  data: Item[];
  onPressItem?: (id: string) => void;
};

export default function QuickCompartmentList({ data, onPressItem }: Props) {
  if (!data || data.length === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.emptyText}>No compartments found</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      {data.map((item, index) => (
        <Pressable
          key={item.id}
          onPress={() => onPressItem?.(item.id)}
          style={[
            styles.row,
            index < data.length - 1 ? styles.rowBorder : undefined,
          ]}
        >
          <View style={styles.left}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.meta}>{item.itemCount} Items</Text>
          </View>

          <ChevronRight size={18} color={colors.textSecondary} />
        </Pressable>
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
  name: {
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