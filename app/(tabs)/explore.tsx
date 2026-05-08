import React, { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import ScreenBackground from "../../components/ui/ScreenBackground";
import { colors } from "../../theme/tokens";

export default function LegacyExploreRedirectScreen() {
  useEffect(() => {
    router.replace("/profile");
  }, []);

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <ActivityIndicator size="large" color={colors.text} />
        </View>
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "transparent",
  },
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});