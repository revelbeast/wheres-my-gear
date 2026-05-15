import React from "react";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import HapticPressable from "../components/ui/HapticPressable";
import ScreenBackground from "../components/ui/ScreenBackground";
import { useThemedValues } from "../components/ui/Themed";

export default function ScanItemScreen() {
  const theme = useThemedValues();

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <Text style={[styles.title, { color: theme.colors.text }]}>
            QR / Barcode Scanner
          </Text>

          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            Camera scanner support is installed, but the iOS dev client needs to be rebuilt before this screen can use the camera.
          </Text>

          <HapticPressable
            style={[styles.button, { backgroundColor: theme.colors.primary }]}
            onPress={() => router.back()}
          >
            <Text style={styles.buttonText}>Back</Text>
          </HapticPressable>
        </View>
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    padding: 20,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
  },
  subtitle: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  button: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
