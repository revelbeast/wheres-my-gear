import { BlurView } from "expo-blur";
import { router, useLocalSearchParams } from "expo-router";
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

import HapticPressable from "../../../components/ui/HapticPressable";
import KeyboardDismissAccessory from "../../../components/ui/KeyboardDismissAccessory";
import ScreenBackground from "../../../components/ui/ScreenBackground";
import { useThemedValues } from "../../../components/ui/Themed";
import { createStorageSpace } from "../../../lib/gearService";
import { useInteractionLock } from "../../../lib/useInteractionLock";

const LABEL_WHITE = "#FFFFFF";
const KEYBOARD_ACCESSORY_ID = "storage-create-keyboard-accessory";

const VEHICLE_SUBTYPES = [
  "ATV / UTV",
  "Boat",
  "Car",
  "Class A",
  "Class B",
  "Class C",
  "Fifth Wheel",
  "Motorcycle",
  "Other",
  "SUV",
  "Toy Hauler",
  "Trailer",
  "Truck",
  "Van",
] as const;

const STORAGE_SUBTYPES = [
  "Backpack",
  "Bag",
  "Bin",
  "Cabinet",
  "Cargo Box",
  "Cooler",
  "Drawer",
  "Garage",
  "Luggage",
  "Overhead",
  "Other",
  "Roof Box",
  "Shed",
  "Shelf",
  "Storage Unit",
  "Toolbox",
  "Tote",
  "Trailer Storage",
  "Trunk",
  "Under Seat",
  "Warehouse",
] as const;

const OFFICE_SUBTYPES = [
  "Home Office",
  "Corporate Office",
  "Desk",
  "Filing Cabinet",
  "Storage Closet",
  "Supply Room",
  "Warehouse Office",
  "Server Room / IT Closet",
  "Tool Room",
  "Classroom / Training Room",
  "Break Room",
  "Other",
] as const;

type StorageCategory = "storage" | "office" | "vehicle";

function getSubtypePlaceholder(category: StorageCategory) {
  if (category === "vehicle") {
    return "Select subtype, for example Car, SUV, Van";
  }

  if (category === "office") {
    return "Select subtype, for example Home Office, Desk, Supply Room";
  }

  return "Select subtype, for example Attic, Garage, Shed";
}

export default function CreateStorageScreen() {
  const theme = useThemedValues();
  const params = useLocalSearchParams<{
    returnTo?: string;
  }>();

  const returnRoute =
    params.returnTo === "dashboard" ? "/(tabs)" : "/(tabs)/storage";

  const {
    isLocked: interactionLocked,
    lock: lockInteraction,
    unlock: unlockInteraction,
  } = useInteractionLock(450);

  const [name, setName] = useState("");
  const [category, setCategory] = useState<StorageCategory>("storage");
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
      }

      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      if (customSubtypeFocusTimeoutRef.current) {
        clearTimeout(customSubtypeFocusTimeoutRef.current);
      }
    };
  }, []);

  const subtypeOptions = useMemo(() => {
    if (category === "vehicle") {
      return VEHICLE_SUBTYPES;
    }

    if (category === "office") {
      return OFFICE_SUBTYPES;
    }

    return STORAGE_SUBTYPES;
  }, [category]);

  const selectedSubtypeLabel = useMemo(() => {
    if (!subtype) {
      return getSubtypePlaceholder(category);
    }

    return subtype;
  }, [category, subtype]);

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

      scrollRef.current?.scrollToEnd({
        animated: true,
      });

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
      router.replace(returnRoute);
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

  function handleSelectCategory(nextCategory: StorageCategory) {
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
      subtype === "Other"
        ? customSubtype.trim()
        : subtype.trim();

    if (!trimmedName) {
      Alert.alert(
        "Required name",
        "Please enter a storage space name."
      );

      return;
    }

    if (!subtype) {
      Alert.alert(
        "Required subtype",
        "Please select a subtype."
      );

      return;
    }

    if (subtype === "Other" && !finalSubtype) {
      Alert.alert(
        "Required custom subtype",
        "Please enter a custom subtype."
      );

      return;
    }

    if (!finalSubtype) {
      Alert.alert(
        "Required subtype",
        "Please select or enter a subtype."
      );

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
          throw new Error(
            "Storage space was not saved. Please try again."
          );
        }

        if (isMountedRef.current) {
          setName("");
          setCategory("storage");
          setSubtype("");
          setCustomSubtype("");
          setShowSubtypeDropdown(false);
          router.replace(returnRoute);
        }
      } catch (err: any) {
        console.error(
          "Failed to create storage space:",
          err
        );

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
          keyboardVerticalOffset={
            Platform.OS === "ios" ? 8 : 0
          }
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
                    backgroundColor: "#FFFFFF",
                    borderColor: "rgba(255,255,255,0.14)",
                  },
                  (saving || interactionLocked) &&
                  styles.disabledInteraction,
                ]}
                disabled={saving || interactionLocked}
              >
                <ChevronLeft
                  size={24}
                  color="#111827"
                />
              </HapticPressable>

              <View style={styles.headerTextWrap}>
                <Text style={styles.headerTitle}>
                  Add Storage Space
                </Text>
              </View>

              <HapticPressable
                onPress={handleBackPress}
                style={[
                  styles.cancelButton,
                  (saving || interactionLocked) &&
                  styles.disabledInteraction,
                ]}
                disabled={saving || interactionLocked}
              >
                <Text style={styles.cancelText}>
                  Cancel
                </Text>
              </HapticPressable>
            </View>

            <Text style={styles.headerSubtitle}>
              Create a vehicle or storage location for
              organizing your gear.
            </Text>

            <BlurView
              intensity={theme.isLight ? 18 : 20}
              tint={theme.isLight ? "light" : "systemUltraThinMaterialDark"}
              style={[
                styles.card,
                {
                  backgroundColor: theme.isLight
                    ? "#FFFFFF"
                    : "rgba(10,18,32,0.52)",
                  borderColor: "rgba(255,255,255,0.14)",
                },
              ]}
            >
              <Text
                style={[
                  styles.label,
                  {
                    color: theme.colors.textSecondary,
                  },
                ]}
              >
                Name
              </Text>

              <TextInput
                ref={nameInputRef}
                value={name}
                onChangeText={setName}
                onFocus={closeSubtypeDropdown}
                placeholder="e.g. My Sprinter Van"
                placeholderTextColor={
                  theme.colors.textMuted
                }
                style={[
                  styles.input,
                  {
                    color: theme.colors.text,
                    backgroundColor: theme.isLight
                      ? "rgba(255,255,255,0.72)"
                      : "rgba(255,255,255,0.05)",
                    borderColor: theme.isLight
                      ? "rgba(0,0,0,0.12)"
                      : "rgba(255,255,255,0.12)",
                  },
                ]}
                returnKeyType="done"
                inputAccessoryViewID={
                  Platform.OS === "ios"
                    ? KEYBOARD_ACCESSORY_ID
                    : undefined
                }
                editable={
                  !saving && !interactionLocked
                }
              />

              <Text
                style={[
                  styles.label,
                  {
                    color: theme.colors.textSecondary,
                  },
                ]}
              >
                Category
              </Text>

              <View style={styles.row}>
                {(["storage", "office", "vehicle"] as const).map((option) => {
                  const selected = category === option;

                  return (
                    <HapticPressable
                      key={option}
                      style={[
                        styles.toggle,
                        {
                          backgroundColor: theme.isLight
                            ? "rgba(255,255,255,0.72)"
                            : "rgba(255,255,255,0.05)",
                          borderColor: theme.isLight
                            ? "rgba(0,0,0,0.12)"
                            : "rgba(255,255,255,0.12)",
                        },
                        selected && styles.toggleActive,
                      ]}
                      onPress={() => handleSelectCategory(option)}
                    >
                      <Text
                        style={[
                          styles.toggleText,
                          {
                            color: theme.isLight
                              ? "#000000"
                              : "#FFFFFF",
                          },
                          selected && styles.toggleTextActive,
                        ]}
                      >
                        {option === "storage"
                          ? "Storage"
                          : option === "office"
                            ? "Office"
                            : "Vehicle"}
                      </Text>
                    </HapticPressable>
                  );
                })}
              </View>

              <Text
                style={[
                  styles.label,
                  {
                    color: theme.colors.textSecondary,
                  },
                ]}
              >
                Subtype
              </Text>

              <View style={styles.dropdownWrap}>
                <HapticPressable
                  style={styles.dropdownPressable}
                  onPressIn={() => {
                    Keyboard.dismiss();
                    blurInputs();
                  }}
                  onPress={
                    handleToggleSubtypeDropdown
                  }
                >
                  <BlurView
                    intensity={theme.isLight ? 18 : 28}
                    tint={theme.isLight ? "light" : "systemUltraThinMaterialDark"}
                    style={styles.dropdownButton}
                  >
                    <Text
                      style={[
                        styles.dropdownButtonText,
                        {
                          color:
                            !subtype &&
                              !customSubtype
                              ? theme.colors.textMuted
                              : theme.isLight
                                ? "#000000"
                                : "#FFFFFF",
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {selectedSubtypeLabel}
                    </Text>

                    <ChevronDown
                      size={18}
                      color={theme.isLight ? "#000000" : "#FFFFFF"}
                    />
                  </BlurView>
                </HapticPressable>

                {showSubtypeDropdown && (
                  <BlurView
                    intensity={theme.isLight ? 18 : 40}
                    tint={theme.isLight ? "light" : "systemUltraThinMaterialDark"}
                    style={[
                      styles.dropdownCard,
                      {
                        borderColor: theme.isLight
                          ? "rgba(0,0,0,0.10)"
                          : "rgba(255,255,255,0.14)",
                        backgroundColor: theme.isLight
                          ? "#FFFFFF"
                          : "rgba(255,255,255,0.04)",
                      },
                    ]}
                  >
                    <ScrollView
                      showsVerticalScrollIndicator={
                        false
                      }
                      nestedScrollEnabled
                      keyboardShouldPersistTaps="handled"
                    >
                      {subtypeOptions.map(
                        (option, index) => (
                          <HapticPressable
                            key={option}
                            style={[
                              styles.dropdownRow,
                              {
                                borderBottomColor:
                                  "rgba(255,255,255,0.10)",
                              },
                              index ===
                              subtypeOptions.length -
                              1 &&
                              styles.dropdownRowLast,
                            ]}
                            onPress={() =>
                              handleSelectSubtype(
                                option
                              )
                            }
                          >
                            <Text
                              style={[
                                styles.dropdownRowTitle,
                                {
                                  color: theme.isLight ? "#000000" : "#FFFFFF",
                                },
                              ]}
                            >
                              {option}
                            </Text>
                          </HapticPressable>
                        )
                      )}
                    </ScrollView>
                  </BlurView>
                )}
              </View>

              {subtype === "Other" && (
                <>
                  <Text
                    style={[
                      styles.label,
                      {
                        color:
                          theme.colors.textSecondary,
                      },
                    ]}
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
                    placeholderTextColor={
                      theme.colors.textMuted
                    }
                    style={[
                      styles.input,
                      {
                        color: theme.colors.text,
                        backgroundColor:
                          "rgba(255,255,255,0.05)",
                        borderColor:
                          "rgba(255,255,255,0.12)",
                      },
                    ]}
                    returnKeyType="done"
                    inputAccessoryViewID={
                      Platform.OS === "ios"
                        ? KEYBOARD_ACCESSORY_ID
                        : undefined
                    }
                  />
                </>
              )}

              <HapticPressable
                style={styles.saveButton}
                onPress={handleSave}
              >
                <Text style={styles.saveText}>
                  {saving ? "Saving..." : "Save"}
                </Text>
              </HapticPressable>
            </BlurView>
          </ScrollView>

          <KeyboardDismissAccessory nativeID={KEYBOARD_ACCESSORY_ID} />
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
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 26,
  },

  cancelButton: {
    minWidth: 64,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },

  cancelText: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "700",
  },

  headerSubtitle: {
    color: "#FFFFFF",
    opacity: 0.82,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 18,
  },

  card: {
    borderRadius: 20,
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
    borderRadius: 14,
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
    borderRadius: 14,
    alignItems: "center",
    borderWidth: 1,
  },

  toggleActive: {
    backgroundColor: "rgba(55,130,245,0.92)",
    borderColor: "rgba(55,130,245,0.92)",
  },

  toggleText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 14,
  },

  toggleTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },

  dropdownWrap: {
    position: "relative",
    zIndex: 50,
  },

  dropdownPressable: {
    borderRadius: 14,
  },

  dropdownButton: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.04)",
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
    maxHeight: 220,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,

    borderColor: "rgba(255,255,255,0.14)",

    backgroundColor: "rgba(255,255,255,0.04)",

    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: {
      width: 0,
      height: 8,
    },

    elevation: 8,
  },

  dropdownRow: {
    paddingHorizontal: 16,
    paddingVertical: 18,
    borderBottomWidth: 1,
  },

  dropdownRowLast: {
    borderBottomWidth: 0,
  },

  dropdownRowTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 20,
  },

  saveButton: {
    marginTop: 20,
    backgroundColor: "rgba(55,130,245,0.95)",
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
  },

  saveText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 15,
  },

  keyboardAccessory: {
    minHeight: 44,
    backgroundColor: "rgba(20,20,24,0.96)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.12)",
    alignItems: "flex-end",
    justifyContent: "center",
    paddingHorizontal: 12,
  },

  keyboardDismissButton: {
    width: 40,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
  },

  disabledInteraction: {
    opacity: 0.6,
  },
});