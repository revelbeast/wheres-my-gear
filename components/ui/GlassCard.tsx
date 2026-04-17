import React from "react";
import { StyleSheet, View, ViewProps } from "react-native";

type Props = ViewProps & {
  children: React.ReactNode;
};

export default function GlassCard({ children, style, ...rest }: Props) {
  return (
    <View style={[styles.card, style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.06)",   // 🔥 much lighter
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",       // subtle edge
    overflow: "hidden",
  },
});