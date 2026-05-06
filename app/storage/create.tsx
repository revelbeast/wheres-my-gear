import { BlurView } from "expo-blur";
import { router } from "expo-router";
import { ChevronDown, ChevronLeft } from "lucide-react-native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import HapticPressable from "../../components/ui/HapticPressable";
import ScreenBackground from "../../components/ui/ScreenBackground";
import { useThemedValues } from "../../components/ui/Themed";
import { createStorageSpace } from "../../lib/gearService";
import { useInteractionLock } from "../../lib/useInteractionLock";

const LABEL_WHITE = "#FFFFFF";

const VEHICLE_SUBTYPES = [
  "Car",
  "Motorcycle",
  "Other",
  "RV Class B",
  "RV Class C",
  "SUV",
  "Trailer",
  "Truck",
  "Van",
] as const;

const STORAGE_SUBTYPES = [
  "Attic",
  "Basement",
  "Cabinet",
  "Closet",
  "Drawer",
  "Garage",
  "Home",
  "Other",
  "Shed",
  "Storage Unit",
] as const;

function getSubtypePlaceholder(category: "vehicle" | "storage") {
  return category === "vehicle"
    ? "Select subtype, for example Car, SUV, Van"
    : "Select subtype, for example Attic, Garage, Shed";
}

export default function CreateStorageScreen() {
  const theme = useThemedValues();
  const {
    isLocked: interactionLocked,
    lock: lockInteraction,
    unlock: unlockInteraction,
  } = useInteractionLock(450);

  const [name, setName] = useState("");
  const [category, setCategory] = useState<"vehicle" | "storage">("vehicle");
  const [subtype, setSubtype] = useState("");
  const [customSubtype, setCustomSubtype] = useState("");
  const [showSubtypeDropdown, setShowSubtypeDropdown] = useState(false);
  const [saving, setSaving] = useState(false);

  const isMountedRef = useRef(true);
  const scrollRef = useRef<ScrollView | null>(null);
  const nameInputRef = useRef<TextInput | null>(null);
  const customSubtypeInputRef = useRef<TextInput | null>(null);
  const dropdownOpenTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const customSubtypeFocusTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;

      if (dropdownOpenTimeoutRef.current) {
        clearTimeout(dropdownOpenTimeoutRef.current);
        dropdownOpenTimeoutRef.current = null;
      }

      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = null;
      }

      if (customSubtypeFocusTimeoutRef.current) {
        clearTimeout(customSubtypeFocusTimeoutRef.current);
        customSubtypeFocusTimeoutRef.current = null;
      }
    };
  }, []);

  const subtypeOptions = useMemo(() => {
    return category === "vehicle" ? VEHICLE_SUBTYPES : STORAGE_SUBTYPES;
  }, [category]);

  const selectedSubtypeLabel = useMemo(() => {
    if (!subtype) return getSubtypePlaceholder(category);
    if (subtype === "Other") {
      return customSubtype.trim() ? customSubtype.trim() : "Other";
    }
    return subtype;
  }, [category, subtype, customSubtype]);

  async function runWithLock(action: () => Promise<void> | void) {
    if (interactionLocked) return;

    lockInteraction();

    try {
      await action();
    } finally {
      unlockInteraction();
    }
  }

  function clearPendingScroll() {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = null;
    }
  }

  function clearPendingCustomSubtypeFocus() {
    if (customSubtypeFocusTimeoutRef.current) {
      clearTimeout(customSubtypeFocusTimeoutRef.current);
      customSubtypeFocusTimeoutRef.current = null;
    }
  }

  function scrollToFormBottom(delay = 120) {
    clearPendingScroll();

    scrollTimeoutRef.current = setTimeout(() => {
      if (!isMountedRef.current) return;

      scrollRef.current?.scrollToEnd({ animated: true });
      scrollTimeoutRef.current = null;
    }, delay);
  }

  function clearPendingDropdownOpen() {
    if (dropdownOpenTimeoutRef.current) {
      clearTimeout(dropdownOpenTimeoutRef.current);
      dropdownOpenTimeoutRef.current = null;
    }
  }

  function blurInputs() {
    nameInputRef.current?.blur();
    customSubtypeInputRef.current?.blur();
  }

  function closeSubtypeDropdown() {
    clearPendingDropdownOpen();
    clearPendingCustomSubtypeFocus();

    if (isMountedRef.current) {
      setShowSubtypeDropdown(false);
    }
  }

  function handleBackPress() {
    if (saving || interactionLocked) return;

    runWithLock(() => {
      router.back();
    });
  }

  function handleToggleSubtypeDropdown() {
    if (saving || interactionLocked) return;

    if (showSubtypeDropdown) {
      closeSubtypeDropdown();
      return;
    }

    Keyboard.dismiss();
    blurInputs();
    clearPendingDropdownOpen();

    dropdownOpenTimeoutRef.current = setTimeout(() => {
      if (!isMountedRef.current) return;

      setShowSubtypeDropdown(true);
      scrollToFormBottom(80);
      dropdownOpenTimeoutRef.current = null;
    }, Platform.OS === "ios" ? 180 : 80);
  }

  function handleSelectSubtype(value: string) {
    if (saving || interactionLocked) return;

    blurInputs();
    clearPendingDropdownOpen();
    clearPendingCustomSubtypeFocus();

    setSubtype(value);
    setShowSubtypeDropdown(false);

    if (value !== "Other") {
      setCustomSubtype("");
    }

    if (value === "Other") {
      customSubtypeFocusTimeoutRef.current = setTimeout(() => {
        if (!isMountedRef.current) return;

        customSubtypeInputRef.current?.focus();
        scrollToFormBottom(80);
        customSubtypeFocusTimeoutRef.current = null;
      }, 150);
    }
  }

  function handleSelectCategory(nextCategory: "vehicle" | "storage") {
    if (saving || interactionLocked) return;

    Keyboard.dismiss();
    blurInputs();
    clearPendingCustomSubtypeFocus();
    setCategory(nextCategory);
    setSubtype("");
    setCustomSubtype("");
    closeSubtypeDropdown();
  }

  async function handleSave() {
    if (saving || interactionLocked) return;

    blurInputs();
    Keyboard.dismiss();
    closeSubtypeDropdown();

    const trimmedName = name.trim();
    const finalSubtype =
      subtype === "Other" ? customSubtype.trim() : subtype.trim();

    if (!trimmedName) {
      Alert.alert("Required name", "Please enter a storage space name.");
      return;
    }

    if (!subtype) {
      Alert.alert("Required subtype", "Please select a subtype.");
      return;
    }

    if (subtype === "Other" && !finalSubtype) {
      Alert.alert("Required custom subtype", "Please enter a custom subtype.");
      return;
    }

    if (!finalSubtype) {
      Alert.alert("Required subtype", "Please select or enter a subtype.");
      return;
    }

    setSaving(true);

    await runWithLock(async () => {
      try {
        const createdId = await createStorageSpace({
          name: trimmedName,
          category,
          subtype: finalSubtype,
        });

        if (!createdId) {
          throw new Error("Storage space was not saved. Please try again.");
        }

        if (isMountedRef.current) {
          router.replace("/storage");
        }
      } catch (err: any) {
        console.error("Failed to create storage space:", err);

        if (isMountedRef.current) {
          Alert.alert(
            "Save failed",
            err?.message ||
              "Unable to save this storage space. Please try again."
          );
        }
      } finally {
        if (isMountedRef.current) {
          setSaving(false);
        }
      }
    });
  }

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
          style={styles.container}
        >
          <ScrollView
            ref={scrollRef}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            contentContainerStyle={styles.scrollContent}
            automaticallyAdjustKeyboardInsets
          >
            <View style={styles.headerRow}>
              <HapticPressable
                onPress={handleBackPress}
                style={[
                  styles.backButton,
                  {
                    backgroundColor: theme.isLight
                      ? "rgba(255,255,255,0.24)"
                      : "rgba(255,255,255,0.08)",
                    borderColor: theme.isLight
                      ? "rgba(255,255,255,0.22)"
                      : "rgba(255,255,255,0.10)",
                  },
                  (saving || interactionLocked) && styles.disabledInteraction,
                ]}
                disabled={saving || interactionLocked}
              >
                <ChevronLeft size={24} color={LABEL_WHITE} />
              </HapticPressable>

              <View style={styles.headerTextWrap}>
                <Text style={styles.headerTitle}>Add Storage Space</Text>
              </View>

              <View style={styles.headerSpacer} />
            </View>

            <Text style={styles.headerSubtitle}>
              Create a vehicle or storage location for organizing your gear.
            </Text>

            <BlurView
              intensity={theme.isLight ? 22 : 25}
              tint={theme.isLight ? "light" : "dark"}
              style={[
                styles.card,
                {
                  borderColor: theme.colors.border,
                  backgroundColor: theme.isLight
                    ? "rgba(255,255,255,0.68)"
                    : "rgba(255,255,255,0.02)",
                },
              ]}
            >
              <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
                Name
              </Text>
              <TextInput
                ref={nameInputRef}
                value={name}
                onChangeText={setName}
                onFocus={closeSubtypeDropdown}
                placeholder="e.g. My Sprinter Van"
                placeholderTextColor={theme.colors.textMuted}
                style={[
                  styles.input,
                  {
                    color: theme.colors.text,
                    backgroundColor: theme.colors.inputSurface,
                    borderColor: theme.colors.border,
                  },
                ]}
                returnKeyType="done"
                editable={!saving && !interactionLocked}
              />

              <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
                Category
              </Text>
              <View style={styles.row}>
                <HapticPressable
                  style={[
                    styles.toggle,
                    {
                      backgroundColor: theme.colors.iconSurface,
                      borderColor: theme.colors.border,
                    },
                    category === "vehicle" && styles.toggleActive,
                    (saving || interactionLocked) && styles.disabledInteraction,
                  ]}
                  onPress={() => handleSelectCategory("vehicle")}
                  disabled={saving || interactionLocked}
                >
                  <Text
                    style={[
                      styles.toggleText,
                      { color: theme.colors.text },
                      category === "vehicle" && styles.toggleTextActive,
                    ]}
                  >
                    Vehicle
                  </Text>
                </HapticPressable>

                <HapticPressable
                  style={[
                    styles.toggle,
                    {
                      backgroundColor: theme.colors.iconSurface,
                      borderColor: theme.colors.border,
                    },
                    category === "storage" && styles.toggleActive,
                    (saving || interactionLocked) && styles.disabledInteraction,
                  ]}
                  onPress={() => handleSelectCategory("storage")}
                  disabled={saving || interactionLocked}
                >
                  <Text
                    style={[
                      styles.toggleText,
                      { color: theme.colors.text },
                      category === "storage" && styles.toggleTextActive,
                    ]}
                  >
                    Storage
                  </Text>
                </HapticPressable>
              </View>

              <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
                Subtype
              </Text>

              <View style={styles.dropdownWrap}>
                <HapticPressable
                  style={[
                    styles.dropdownPressable,
                    (saving || interactionLocked) && styles.disabledInteraction,
                  ]}
                  onPressIn={() => {
                    Keyboard.dismiss();
                    blurInputs();
                  }}
                  onPress={handleToggleSubtypeDropdown}
                  disabled={saving || interactionLocked}
                >
                  <BlurView
                    intensity={theme.isLight ? 18 : 20}
                    tint={theme.isLight ? "light" : "dark"}
                    style={[
                      styles.dropdownButton,
                      {
                        borderColor: theme.colors.border,
                        backgroundColor: theme.colors.inputSurface,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.dropdownButtonText,
                        {
                          color:
                            !subtype && !customSubtype
                              ? theme.colors.textMuted
                              : theme.colors.text,
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {selectedSubtypeLabel}
                    </Text>
                    <ChevronDown size={18} color={theme.colors.textSecondary} />
                  </BlurView>
                </HapticPressable>

                {showSubtypeDropdown && (
                  <BlurView
                    intensity={theme.isLight ? 22 : 20}
                    tint={theme.isLight ? "light" : "dark"}
                    style={[
                      styles.dropdownCard,
                      {
                        borderColor: theme.colors.border,
                        backgroundColor: theme.isLight
                          ? "rgba(255,255,255,0.94)"
                          : "rgba(10,16,28,0.96)",
                      },
                    ]}
                  >
                    <ScrollView
                      showsVerticalScrollIndicator={false}
                      nestedScrollEnabled
                      keyboardShouldPersistTaps="handled"
                    >
                      {subtypeOptions.map((option, index) => (
                        <HapticPressable
                          key={option}
                          style={[
                            styles.dropdownRow,
                            { borderBottomColor: theme.colors.border },
                            index === subtypeOptions.length - 1 &&
                              styles.dropdownRowLast,
                            (saving || interactionLocked) &&
                              styles.disabledInteraction,
                          ]}
                          onPress={() => handleSelectSubtype(option)}
                          disabled={saving || interactionLocked}
                        >
                          <Text
                            style={[
                              styles.dropdownRowTitle,
                              { color: theme.colors.text },
                            ]}
                          >
                            {option}
                          </Text>
                        </HapticPressable>
                      ))}
                    </ScrollView>
                  </BlurView>
                )}
              </View>

              {subtype === "Other" && (
                <>
                  <Text
                    style={[styles.label, { color: theme.colors.textSecondary }]}
                  >
                    Custom subtype
                  </Text>
                  <TextInput
                    ref={customSubtypeInputRef}
                    value={customSubtype}
                    onChangeText={setCustomSubtype}
                    onFocus={() => {
                      closeSubtypeDropdown();
                      scrollToFormBottom(180);
                    }}
                    placeholder="Enter your subtype, for example Pods"
                    placeholderTextColor={theme.colors.textMuted}
                    style={[
                      styles.input,
                      {
                        color: theme.colors.text,
                        backgroundColor: theme.colors.inputSurface,
                        borderColor: theme.colors.border,
                      },
                    ]}
                    returnKeyType="done"
                    editable={!saving && !interactionLocked}
                  />
                </>
              )}

              <HapticPressable
                style={[
                  styles.saveButton,
                  (saving || interactionLocked) && styles.saveButtonDisabled,
                ]}
                onPress={handleSave}
                disabled={saving || interactionLocked}
              >
                <Text style={styles.saveText}>
                  {saving ? "Saving..." : "Save"}
                </Text>
              </HapticPressable>
            </BlurView>
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
    paddingHorizontal: 16,
    paddingTop: 10,
  },

  scrollContent: {
    flexGrow: 1,
    paddingBottom: 160,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    gap: 10,
  },

  backButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },

  headerTextWrap: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 8,
  },

  headerTitle: {
    color: LABEL_WHITE,
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 26,
  },

  headerSpacer: {
    width: 36,
  },

  headerSubtitle: {
    color: LABEL_WHITE,
    opacity: 0.82,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 18,
  },

  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    overflow: "hidden",
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

  row: {
    flexDirection: "row",
    gap: 10,
  },

  toggle: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
  },

  toggleActive: {
    backgroundColor: "rgba(55,130,245,0.95)",
    borderColor: "rgba(55,130,245,0.95)",
  },

  toggleText: {
    fontWeight: "600",
    fontSize: 14,
  },

  toggleTextActive: {
    color: "#fff",
    fontWeight: "700",
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
  },

  dropdownButtonText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 18,
  },

  dropdownCard: {
    marginTop: 8,
    maxHeight: 220,
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

  saveButton: {
    marginTop: 20,
    backgroundColor: "rgba(55,130,245,0.95)",
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
  },

  saveButtonDisabled: {
    opacity: 0.6,
  },

  saveText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },

  disabledInteraction: {
    opacity: 0.6,
  },
});