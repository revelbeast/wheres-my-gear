import { BlurView } from "expo-blur";
import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AppHeader from "../../../../../components/ui/AppHeader";
import HapticPressable from "../../../../../components/ui/HapticPressable";
import ScreenBackground from "../../../../../components/ui/ScreenBackground";
import {
  ThemedCard,
  useThemedValues,
} from "../../../../../components/ui/Themed";
import { createCompartment } from "../../../../../lib/gearService";

function FrostedCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: any;
}) {
  return (
    <ThemedCard
      style={[styles.frostedCard, style]}
      contentStyle={styles.frostedCardContent}
    >
      {children}
    </ThemedCard>
  );
}

export default function CreateCompartmentScreen() {
  const { vehicleId } = useLocalSearchParams<{ vehicleId: string }>();
  const theme = useThemedValues();

  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const canSave = useMemo(() => {
    return (
      typeof vehicleId === "string" &&
      vehicleId.trim().length > 0 &&
      name.trim().length > 0 &&
      !saving
    );
  }, [name, saving, vehicleId]);

  async function handleSave() {
    if (!vehicleId || !name.trim() || saving) return;

    try {
      setSaving(true);
      await createCompartment(name.trim(), vehicleId);
      router.back();
    } catch (error: any) {
      console.error("Failed to create compartment:", error);
      Alert.alert(
        "Unable to create compartment",
        error?.message ?? "Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.headerWrap}>
              <AppHeader title="New Compartment" showBackButton />
            </View>

            <Text style={styles.pageSubtitle}>
              Create a compartment inside this storage space so your gear is easier to find.
            </Text>

            <FrostedCard>
              <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
                Compartment name
              </Text>

              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Enter compartment name"
                placeholderTextColor={theme.colors.textMuted}
                style={[
                  styles.input,
                  {
                    color: theme.colors.text,
                    backgroundColor: theme.colors.inputSurface,
                    borderColor: theme.colors.border,
                  },
                ]}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleSave}
              />

              <HapticPressable
                style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={!canSave}
              >
                <Text style={styles.saveButtonText}>
                  {saving ? "Saving..." : "Create Compartment"}
                </Text>
              </HapticPressable>
            </FrostedCard>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "transparent",
  },

  flex: {
    flex: 1,
  },

  content: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 160,
  },

  headerWrap: {
    marginBottom: 10,
  },

  pageSubtitle: {
    color: "#FFFFFF",
    opacity: 0.82,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },

  frostedCard: {
    borderRadius: 16,
  },

  frostedCardContent: {
    paddingHorizontal: 14,
    paddingVertical: 14,
  },

  frostedBlur: {
    paddingHorizontal: 14,
    paddingVertical: 14,
  },

  label: {
    fontSize: 14,
    marginBottom: 8,
    fontWeight: "700",
  },

  input: {
    minHeight: 48,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    marginBottom: 14,
    fontSize: 15,
  },

  saveButton: {
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: "rgba(55,130,245,0.95)",
    alignItems: "center",
    justifyContent: "center",
  },

  saveButtonDisabled: {
    opacity: 0.55,
  },

  saveButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
});