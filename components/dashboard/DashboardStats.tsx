import React from "react";
import { StyleSheet, Text, View } from "react-native";
import GlassCard from "../ui/GlassCard";

type Props = {
  compartments: number;
  packed: number;
  missing: number;
};

export default function DashboardStats({
  compartments,
  packed,
  missing,
}: Props) {
  return (
    <View style={styles.container}>
      <GlassCard style={styles.card}>
        <Text style={styles.value}>{compartments}</Text>
        <Text style={styles.label}>Compartments</Text>
      </GlassCard>

      <GlassCard style={styles.card}>
        <Text style={styles.value}>{packed}</Text>
        <Text style={styles.label}>Items Packed</Text>
      </GlassCard>

      <GlassCard style={styles.card}>
        <Text style={styles.value}>{missing}</Text>
        <Text style={styles.label}>To Pack</Text>
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    gap: 12,
  },

  card: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 90,
  },

  value: {
    fontSize: 26,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  label: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
    marginTop: 4,
    textAlign: "center",
  },
});