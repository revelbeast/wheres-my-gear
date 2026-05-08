import { BlurView } from "expo-blur";
import { router } from "expo-router";
import { ChevronDown } from "lucide-react-native";
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

import { useAuth } from "../../../components/auth/AuthProvider";
import AppHeader from "../../../components/ui/AppHeader";
import HapticPressable from "../../../components/ui/HapticPressable";
import ScreenBackground from "../../../components/ui/ScreenBackground";
import { useThemedValues } from "../../../components/ui/Themed";
import { createChecklist } from "../../../lib/checklistsService";
import type { ChecklistCategory } from "../../../types/checklists";

const CATEGORY_OPTIONS: { label: string; value: ChecklistCategory }[] = [
  { label: "Trip", value: "trip" },
  { label: "Camping", value: "camping" },
  { label: "Hunting", value: "hunting" },
  { label: "Fishing", value: "fishing" },
  { label: "Boating", value: "boating" },
  { label: "Clothing", value: "clothing" },
  { label: "Electronics", value: "electronics" },
  { label: "Medical", value: "medical" },
  { label: "Tools", value: "tools" },
  { label: "Food", value: "food" },
  { label: "Custom", value: "custom" },
];

export default function CreateBlankChecklistScreen() {
  const { user, initializing } = useAuth();
  const theme = useThemedValues();

  const [name, setName] = useState("");
  const [category, setCategory] = useState<ChecklistCategory>("trip");
  const [customCategoryLabel, setCustomCategoryLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  const selectedCategoryLabel = useMemo(() => {
    const match = CATEGORY_OPTIONS.find((option) => option.value === category);
    return match?.label ?? "Trip";
  }, [category]);

  function handleSelectCategory(value: ChecklistCategory) {
    setCategory(value);
    setShowCategoryDropdown(false);

    if (value !== "custom") {
      setCustomCategoryLabel("");
    }
  }

  async function handleCreateChecklist() {
    if (!user) {
      Alert.alert("Sign in required", "Please sign in to create a checklist.");
      return;
    }

    const trimmedName = name.trim();
    const trimmedCustomLabel = customCategoryLabel.trim();

    if (!trimmedName) {
      Alert.alert("Checklist name required", "Please enter a checklist name.");
      return;
    }

    if (category === "custom" && !trimmedCustomLabel) {
      Alert.alert(
        "Custom category required",
        "Please enter a custom category label."
      );
      return;
    }

    try {
      setSaving(true);

      const checklistId = await createChecklist(user.uid, {
        name: trimmedName,
        category,
        customCategoryLabel: category === "custom" ? trimmedCustomLabel : "",
        templateId: null,
        vehicleId: null,
        tripId: null,
      });

      router.replace({
        pathname: "/checklists/[checklistId]",
        params: { checklistId },
      });
    } catch (err) {
      console.error("Failed to create blank checklist:", err);
      Alert.alert("Error", "Failed to create checklist.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.container}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <AppHeader title="New Blank Checklist" showBackButton />

            <View style={styles.heroSection}>
              <Text
                style={[
                  styles.sectionEyebrow,
                  { color: theme.colors.textSecondary },
                ]}
              >
                Create
              </Text>
              <Text style={[styles.heroTitle, { color: theme.colors.text }]}>
                Start from scratch
              </Text>
              <Text
                style={[
                  styles.heroSubtitle,
                  { color: theme.colors.textSecondary },
                ]}
              >
                Create an empty checklist, then add your own items and assign
                storage as needed.
              </Text>
            </View>

            {initializing ? (
              <View
                style={[
                  styles.formCard,
                  {
                    backgroundColor: theme.colors.card,
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.heroSubtitle,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  Loading account...
                </Text>
              </View>
            ) : !user ? (
              <View
                style={[
                  styles.formCard,
                  {
                    backgroundColor: theme.colors.card,
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.heroSubtitle,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  Sign in first to create a checklist.
                </Text>
              </View>
            ) : (
              <View
                style={[
                  styles.formCard,
                  {
                    backgroundColor: theme.colors.card,
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <Text
                  style={[styles.label, { color: theme.colors.textSecondary }]}
                >
                  Checklist Name
                </Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="For example, Weekend Camping Trip"
                  placeholderTextColor={theme.colors.textMuted}
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.colors.inputSurface,
                      borderColor: theme.colors.border,
                      color: theme.colors.text,
                    },
                  ]}
                  returnKeyType="done"
                />

                <Text
                  style={[styles.label, { color: theme.colors.textSecondary }]}
                >
                  Category
                </Text>

                <View style={styles.dropdownWrap}>
                  <HapticPressable
                    style={styles.dropdownPressable}
                    onPress={() => setShowCategoryDropdown((prev) => !prev)}
                  >
                    <BlurView
                      intensity={theme.isLight ? 18 : 20}
                      tint={theme.isLight ? "light" : "dark"}
                      style={[
                        styles.dropdownButton,
                        {
                          backgroundColor: theme.colors.inputSurface,
                          borderColor: theme.colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.dropdownButtonText,
                          { color: theme.colors.text },
                        ]}
                      >
                        {selectedCategoryLabel}
                      </Text>
                      <ChevronDown
                        size={18}
                        color={theme.colors.textSecondary}
                      />
                    </BlurView>
                  </HapticPressable>

                  {showCategoryDropdown && (
                    <BlurView
                      intensity={theme.isLight ? 22 : 20}
                      tint={theme.isLight ? "light" : "dark"}
                      style={[
                        styles.dropdownCard,
                        {
                          backgroundColor: theme.colors.cardStrong,
                          borderColor: theme.colors.border,
                        },
                      ]}
                    >
                      <ScrollView
                        showsVerticalScrollIndicator={false}
                        nestedScrollEnabled
                      >
                        {CATEGORY_OPTIONS.map((option, index) => (
                          <HapticPressable
                            key={option.value}
                            style={[
                              styles.dropdownRow,
                              {
                                borderBottomColor: theme.colors.border,
                              },
                              index === CATEGORY_OPTIONS.length - 1 &&
                                styles.dropdownRowLast,
                            ]}
                            onPress={() => handleSelectCategory(option.value)}
                          >
                            <Text
                              style={[
                                styles.dropdownRowTitle,
                                { color: theme.colors.text },
                              ]}
                            >
                              {option.label}
                            </Text>
                          </HapticPressable>
                        ))}
                      </ScrollView>
                    </BlurView>
                  )}
                </View>

                {category === "custom" && (
                  <>
                    <Text
                      style={[
                        styles.label,
                        { color: theme.colors.textSecondary },
                      ]}
                    >
                      Custom Category Label
                    </Text>
                    <TextInput
                      value={customCategoryLabel}
                      onChangeText={setCustomCategoryLabel}
                      placeholder="For example, Road Trip Gear"
                      placeholderTextColor={theme.colors.textMuted}
                      style={[
                        styles.input,
                        {
                          backgroundColor: theme.colors.inputSurface,
                          borderColor: theme.colors.border,
                          color: theme.colors.text,
                        },
                      ]}
                      returnKeyType="done"
                    />
                  </>
                )}

                <HapticPressable
                  style={[
                    styles.createButton,
                    saving && styles.createButtonDisabled,
                  ]}
                  onPress={handleCreateChecklist}
                  disabled={saving}
                >
                  <Text style={styles.createButtonText}>
                    {saving ? "Creating..." : "Create Checklist"}
                  </Text>
                </HapticPressable>
              </View>
            )}
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

  container: {
    flex: 1,
  },

  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 140,
  },

  heroSection: {
    marginTop: 6,
    marginBottom: 16,
  },

  sectionEyebrow: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 4,
  },

  heroTitle: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 6,
    lineHeight: 28,
  },

  heroSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },

  formCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },

  label: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
    marginTop: 12,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },

  input: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    fontSize: 15,
  },

  dropdownWrap: {
    position: "relative",
    zIndex: 50,
  },

  dropdownPressable: {
    borderRadius: 12,
  },

  dropdownButton: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    overflow: "hidden",
  },

  dropdownButtonText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 18,
  },

  dropdownCard: {
    marginTop: 8,
    maxHeight: 240,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
  },

  dropdownRow: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },

  dropdownRowLast: {
    borderBottomWidth: 0,
  },

  dropdownRowTitle: {
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 18,
  },

  createButton: {
    marginTop: 20,
    backgroundColor: "rgba(55,130,245,0.95)",
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
  },

  createButtonDisabled: {
    opacity: 0.6,
  },

  createButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
});