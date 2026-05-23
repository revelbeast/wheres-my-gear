import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AppHeader from "../../components/ui/AppHeader";
import ScreenBackground from "../../components/ui/ScreenBackground";
import {
  ThemedCard,
  ThemedText,
  useThemedValues,
} from "../../components/ui/Themed";
import { getWorkspaceFeatureFlags } from "../../lib/workspaceService";

export default function BusinessWorkspaceScreen() {
  const theme = useThemedValues();
  const featureFlags = getWorkspaceFeatureFlags();

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe}>
        <AppHeader title="Business Workspace" />

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <ThemedCard
            style={styles.card}
            contentStyle={styles.cardContent}
          >
            <View style={styles.eyebrowWrap}>
              <ThemedText
                color="secondary"
                style={[
                  styles.eyebrow,
                  { color: theme.colors.textSecondary },
                ]}
              >
                Phase 3
              </ThemedText>
            </View>

            <ThemedText variant="header" style={styles.title}>
              Business workspace setup is not enabled yet.
            </ThemedText>

            <ThemedText color="secondary" style={styles.description}>
              This screen is a hidden Phase 3 foundation route for owner-only
              business workspace creation. It remains inactive until workspace
              feature flags are enabled.
            </ThemedText>

            <ThemedText color="secondary" style={styles.flagText}>
              workspaceEnabled: {featureFlags.workspaceEnabled ? "on" : "off"}
            </ThemedText>

            <ThemedText color="secondary" style={styles.flagText}>
              businessWorkspaceCreationEnabled:{" "}
              {featureFlags.businessWorkspaceCreationEnabled ? "on" : "off"}
            </ThemedText>
          </ThemedCard>
        </ScrollView>
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    padding: 16,
    paddingBottom: 120,
  },
  card: {
    marginTop: 12,
  },
  cardContent: {
    gap: 14,
    padding: 18,
  },
  eyebrowWrap: {
    alignSelf: "flex-start",
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  title: {
    lineHeight: 34,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
  },
  flagText: {
    fontSize: 13,
    lineHeight: 20,
  },
});
