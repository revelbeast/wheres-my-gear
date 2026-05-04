import { BlurView } from "expo-blur";
import { router } from "expo-router";
import { ChevronDown } from "lucide-react-native";
import React, { useMemo, useState } from "react";
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../../../components/auth/AuthProvider";
import AppHeader from "../../../components/ui/AppHeader";
import ScreenBackground from "../../../components/ui/ScreenBackground";
import { useThemedValues } from "../../../components/ui/Themed";
import { createChecklist } from "../../../lib/checklistsService";
import type { ChecklistCategory } from "../../../types/checklists";

const LABEL_WHITE = "#FFFFFF";

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

function FrostedCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
}) {
  const theme = useThemedValues();

  return (
    <View
      style={[
        styles.cardShell,
        {
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.card,
        },
        style,
      ]}
    >
      <BlurView
        intensity={theme.isLight ? 22 : 35}
        tint={theme.isLight ? "light" : "dark"}
        style={styles.cardBlur}
      >
        {children}
      </BlurView>
    </View>
  );
}

export default function NewBlankChecklistScreen() {
  const { user, initializing } = useAuth();
  const theme = useThemedValues();

  const [name, setName] = useState("");
  const [category, setCategory] = useState<ChecklistCategory>("trip");
  const [customCategoryLabel, setCustomCategoryLabel] = useState("");
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [saving, setSaving] = useState(false);

  const selectedCategoryLabel = useMemo(() => {
    const matched = CATEGORY_OPTIONS.find((option) => option.value === category);
    return matched?.label ?? "Trip";
  }, [category]);

  async function handleCreateChecklist() {
    Keyboard.dismiss();

    if (!user) {
      Alert.alert("Sign in required", "Please sign in to create a checklist.");
      return;
    }

    const trimmedName = name.trim();
    const trimmedCustomCategory = customCategoryLabel.trim();

    if (!trimmedName) {
      Alert.alert("Checklist name required", "Please enter a checklist name.");
      return;
    }

    if (category === "custom" && !trimmedCustomCategory) {
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
        customCategoryLabel:
          category === "custom" ? trimmedCustomCategory : "",
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

  function handleOpenCategoryDropdown() {
    Keyboard.dismiss();
    setShowCategoryDropdown((prev) => !prev);
  }

  function handleSelectCategory(value: ChecklistCategory) {
    Keyboard.dismiss();
    setCategory(value);
    setShowCategoryDropdown(false);

    if (value !== "custom") {
      setCustomCategoryLabel("");
    }
  }

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.flex}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            <AppHeader title="New Blank Checklist" showBackButton />

            <View style={styles.heroSection}>
              <Text style={styles.eyebrow}>Blank Checklist</Text>
              <Text style={styles.heroTitle}>
                Create a checklist from scratch
              </Text>
              <Text style={styles.heroSubtitle}>
                Give it a name, choose a category, then start adding your own
                items.
              </Text>
            </View>

            <FrostedCard>
              {initializing ? (
                <Text
                  style={[
                    styles.cardText,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  Loading account...
                </Text>
              ) : !user ? (
                <Text
                  style={[
                    styles.cardText,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  Sign in first to create a checklist.
                </Text>
              ) : (
                <>
                  <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
                    Checklist Name
                  </Text>
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="For example, Weekend Camping"
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
                    returnKeyType="done"
                    blurOnSubmit
                    onSubmitEditing={Keyboard.dismiss}
                  />

                  <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
                    Category
                  </Text>

                  <View style={styles.dropdownWrap}>
                    <Pressable
                      style={styles.dropdownPressable}
                      onPress={handleOpenCategoryDropdown}
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
                    </Pressable>

                    {showCategoryDropdown && (
                      <BlurView
                        intensity={theme.isLight ? 22 : 20}
                        tint={theme.isLight ? "light" : "dark"}
                        style={[
                          styles.dropdownCard,
                          {
                            borderColor: theme.colors.border,
                            backgroundColor: theme.colors.cardStrong,
                          },
                        ]}
                      >
                        <ScrollView
                          showsVerticalScrollIndicator={false}
                          nestedScrollEnabled
                          keyboardShouldPersistTaps="handled"
                        >
                          {CATEGORY_OPTIONS.map((option, index) => (
                            <Pressable
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
                            </Pressable>
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
                        placeholder="For example, Overlanding"
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
                        returnKeyType="done"
                        blurOnSubmit
                        onSubmitEditing={Keyboard.dismiss}
                      />
                    </>
                  )}

                  <Pressable
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
                  </Pressable>
                </>
              )}
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
  },

  flex: {
    flex: 1,
  },

  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 120,
  },

  cardShell: {
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
  },

  cardBlur: {
    padding: 16,
  },

  heroSection: {
    marginBottom: 16,
  },

  eyebrow: {
    color: LABEL_WHITE,
    opacity: 0.82,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 6,
  },

  heroTitle: {
    color: LABEL_WHITE,
    fontSize: 22,
    fontWeight: "700",
    lineHeight: 30,
    marginBottom: 8,
  },

  heroSubtitle: {
    color: LABEL_WHITE,
    opacity: 0.82,
    fontSize: 14,
    lineHeight: 20,
  },

  cardText: {
    fontSize: 14,
    lineHeight: 20,
  },

  label: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 6,
    marginTop: 12,
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
    fontSize: 15,
    fontWeight: "600",
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
    fontWeight: "500",
  },

  createButton: {
    marginTop: 20,
    backgroundColor: "rgba(55,130,245,0.95)",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  createButtonDisabled: {
    opacity: 0.6,
  },

  createButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
});