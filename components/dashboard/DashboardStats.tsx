import React from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import { Archive, CheckCircle2, AlertCircle } from "lucide-react-native";
import GlassCard from "../ui/GlassCard";
import { colors } from "../../theme/tokens";

type Props = {
  compartments: number;
  packedItems: number;
  missingItems: number;
  onPressCompartments?: () => void;
  onPressPackedItems?: () => void;
  onPressMissingItems?: () => void;
};

function StatCard({
  label,
  value,
  icon,
  backgroundColor,
  onPress,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  backgroundColor: string;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.pressable}>
      <GlassCard style={[styles.card, { backgroundColor }]}>
        <View style={styles.iconWrap}>{icon}</View>
        <Text style={styles.value}>{value}</Text>
        <Text style={styles.label}>{label}</Text>
      </GlassCard>
    </Pressable>
  );
}

export default function DashboardStats({
  compartments,
  packedItems,
  missingItems,
  onPressCompartments,
  onPressPackedItems,
  onPressMissingItems,
}: Props) {
  return (
    <View style={styles.row}>
      <StatCard
        label="Compartments"
        value={compartments}
        icon={<Archive size={22} color={colors.text} />}
        backgroundColor="rgba(30, 41, 59, 0.70)"
        onPress={onPressCompartments}
      />
      <StatCard
        label="Items Packed"
        value={packedItems}
        icon={<CheckCircle2 size={22} color={colors.text} />}
        backgroundColor="rgba(20, 83, 45, 0.72)"
        onPress={onPressPackedItems}
      />
      <StatCard
        label="Items Missing"
        value={missingItems}
        icon={<AlertCircle size={22} color={colors.text} />}
        backgroundColor="rgba(127, 29, 29, 0.75)"
        onPress={onPressMissingItems}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  pressable: {
    flex: 1,
  },
  card: {
    flex: 1,
  },
  iconWrap: {
    marginBottom: 12,
  },
  value: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 4,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
  },
});