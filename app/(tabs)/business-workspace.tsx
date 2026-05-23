import React, { useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AppHeader from "../../components/ui/AppHeader";
import ScreenBackground from "../../components/ui/ScreenBackground";
import {
  ThemedButton,
  ThemedCard,
  ThemedInput,
  ThemedText,
  useThemedValues,
} from "../../components/ui/Themed";
import {
  createOwnerBusinessWorkspace,
  getWorkspaceFeatureFlags,
} from "../../lib/workspaceService";

export default function BusinessWorkspaceScreen() {
  const theme = useThemedValues();
  const featureFlags = getWorkspaceFeatureFlags();
  const [businessName, setBusinessName] = useState("");
  const [creating, setCreating] = useState(false);

  const canCreateBusinessWorkspace =
    featureFlags.workspaceEnabled &&
    featureFlags.businessWorkspaceCreationEnabled;

  async function handleCreateBusinessWorkspace() {
    if (!canCreateBusinessWorkspace) {
      Alert.alert(
        "Business Workspace Disabled",
        "Business workspace creation is not enabled yet."
      );
      return;
    }

    const normalizedName = businessName.trim();

    if (!normalizedName) {
      Alert.alert("Business Name Required", "Enter a business workspace name.");
      return;
    }

    try {
      setCreating(true);
      const activeWorkspace = await createOwnerBusinessWorkspace(normalizedName);

      if (!activeWorkspace) {
        Alert.alert(
          "Business Workspace Disabled",
          "Business workspace creation is not enabled yet."
        );
        return;
      }

      Alert.alert("Business Workspace Created", "Your business workspace is ready.");
    } catch (error) {
      console.log("Failed to create business workspace.", error);
      Alert.alert(
        "Business Workspace Error",
        "We could not create the business workspace. Please try again."
      );
    } finally {
      setCreating(false);
    }
  }

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

            <View style={styles.inputGroup}>
              <ThemedText variant="small" style={styles.inputLabel}>
                Business Name
              </ThemedText>

              <ThemedInput
                value={businessName}
                onChangeText={setBusinessName}
                placeholder="Enter business name"
                editable={!creating && canCreateBusinessWorkspace}
              />
            </View>

            <ThemedButton
              onPress={handleCreateBusinessWorkspace}
              disabled={creating || !canCreateBusinessWorkspace}
              style={styles.createButton}
            >
              <ThemedText style={styles.buttonText}>
                {creating ? "Creating..." : "Create Business Workspace"}
              </ThemedText>
            </ThemedButton>
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
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontWeight: "800",
  },
  createButton: {
    marginTop: 4,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
});
