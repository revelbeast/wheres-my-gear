import React from "react";
import { StyleSheet, View } from "react-native";

type Props = {
  children: React.ReactNode;
};

export default function ScreenBackground({ children }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.overlay} />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#061327",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(4, 10, 22, 0.82)",
  },
  content: {
    flex: 1,
  },
});