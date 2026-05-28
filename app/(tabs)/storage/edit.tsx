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
import {
  getStorageSpaceById,
  updateStorageSpace,
} from "../../../lib/gearService";
import { useInteractionLock } from "../../../lib/useInteractionLock";

const KEYBOARD_ACCESSORY_ID = "storage-edit-keyboard-accessory";

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

export default function EditStorageScreen() {
  const theme = useThemedValues();

  const params = useLocalSearchParams<{
    id?: string | string[];
  }>();

  const storageId = useMemo(() => {
    const value = params.id;

    if (Array.isArray(value)) {
      return value[0] ?? "";
    }

    return value ?? "";
  }, [params.id]);

  const {
    isLocked: interactionLocked,
    lock: lockInteraction,
    unlock: unlockInteraction,
  } = useInteractionLock(450);

  const isMountedRef = useRef(true);
  const nameInputRef = useRef<TextInput | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [category, setCategory] = useState<StorageCategory>("storage");

  const [subtype, setSubtype] = useState("");
  const [showSubtypeDropdown, setShowSubtypeDropdown] = useState(false);

  const subtypeOptions = useMemo(() => {
    if (category === "vehicle") {
      return VEHICLE_SUBTYPES;
    }

    if (category === "office") {
      return OFFICE_SUBTYPES;
    }

    return STORAGE_SUBTYPES;
  }, [category]);

  useEffect(() => {
    isMountedRef.current = true;

    void loadStorage();

    return () => {
      isMountedRef.current = false;
    };
  }, [storageId]);

  async function runWithLock(
    action: () => Promise<void> | void
  ) {
    if (interactionLocked) return;

    lockInteraction();

    try {
      await action();
    } finally {
      unlockInteraction();
    }
  }

  async function loadStorage() {
    if (!storageId) {
      Alert.alert(
        "Storage not found",
        "Unable to load this storage space."
      );

      router.replace("/(tabs)/storage");
      return;
    }

    try {
      const storage =
        await getStorageSpaceById(storageId);

      if (!storage) {
        throw new Error("Storage not found.");
      }

      if (!isMountedRef.current) return;

      setName(storage.name ?? "");
      setCategory(storage.category ?? "storage");
      setSubtype(storage.subtype ?? "");
    } catch (err: any) {
      Alert.alert(
        "Load failed",
        err?.message ??
        "Unable to load storage details."
      );

      router.replace("/(tabs)/storage");
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }

  function handleSelectCategory(nextCategory: StorageCategory) {
    if (saving || loading || interactionLocked) return;

    Keyboard.dismiss();
    nameInputRef.current?.blur();

    setCategory(nextCategory);
    setSubtype("");
    setShowSubtypeDropdown(false);
  }

  function handleToggleSubtypeDropdown() {
    if (saving || loading || interactionLocked) return;

    Keyboard.dismiss();
    nameInputRef.current?.blur();

    setShowSubtypeDropdown((currentValue) => !currentValue);
  }

  function handleSelectSubtype(nextSubtype: string) {
    if (saving || loading || interactionLocked) return;

    setSubtype(nextSubtype);
    setShowSubtypeDropdown(false);
  }

  function handleBackPress() {
    if (saving || interactionLocked) return;

    runWithLock(() => {
      router.replace("/(tabs)/storage");
    });
  }

  async function handleSave() {
    if (saving || interactionLocked) return;

    Keyboard.dismiss();
    nameInputRef.current?.blur();

    const trimmedName = name.trim();
    const trimmedSubtype = subtype.trim();

    if (!trimmedName) {
      Alert.alert(
        "Required name",
        "Please enter a storage space name."
      );
      return;
    }

    if (!trimmedSubtype) {
      Alert.alert(
        "Required subtype",
        "Please enter a subtype."
      );
      return;
    }

    setSaving(true);

    await runWithLock(async () => {
      try {
        await updateStorageSpace(storageId, {
          name: trimmedName,
          category,
          subtype: trimmedSubtype,
        });

        if (isMountedRef.current) {
          router.replace("/(tabs)/storage");
        }
      } catch (err: any) {
        Alert.alert(
          "Save failed",
          err?.message ??
          "Unable to save storage space."
        );
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
          behavior={
            Platform.OS === "ios"
              ? "padding"
              : "height"
          }
          style={styles.container}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={
              styles.scrollContent
            }
          >
            <View style={styles.headerRow}>
              <HapticPressable
                onPress={handleBackPress}
                style={styles.backButton}
              >
                <ChevronLeft
                  size={24}
                  color="#111827"
                />
              </HapticPressable>

              <View style={styles.headerTextWrap}>
                <Text style={styles.headerTitle}>
                  Edit Storage Space
                </Text>
              </View>

              <HapticPressable
                onPress={handleBackPress}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelText}>
                  Cancel
                </Text>
              </HapticPressable>
            </View>

            <Text style={styles.headerSubtitle}>
              Update your storage space
              details.
            </Text>

            <BlurView
              intensity={theme.isLight ? 0 : 20}
              tint={
                theme.isLight
                  ? "light"
                  : "systemUltraThinMaterialDark"
              }
              style={[
                styles.card,
                {
                  backgroundColor: theme.isLight
                    ? "#FFFFFF"
                    : "rgba(10,18,32,0.52)",
                  borderColor: theme.isLight
                    ? "rgba(15,23,42,0.10)"
                    : "rgba(255,255,255,0.14)",
                },
              ]}
            >
              <Text
                style={[
                  styles.label,
                  {
                    color: theme.isLight ? "#000000" : "#FFFFFF",
                  },
                ]}
              >
                Name
              </Text>

              <TextInput
                ref={nameInputRef}
                value={name}
                onChangeText={setName}
                placeholder="Storage name"
                placeholderTextColor={
                  theme.colors.textMuted
                }
                style={[
                  styles.input,
                  {
                    color: theme.isLight ? "#000000" : theme.colors.text,
                    backgroundColor: theme.isLight
                      ? "#FFFFFF"
                      : "rgba(255,255,255,0.05)",
                    borderColor: theme.isLight
                      ? "rgba(15,23,42,0.18)"
                      : "rgba(255,255,255,0.12)",
                  },
                ]}
                editable={!saving && !loading}
                inputAccessoryViewID={
                  Platform.OS === "ios"
                    ? KEYBOARD_ACCESSORY_ID
                    : undefined
                }
              />

              <Text
                style={[
                  styles.label,
                  {
                    color: theme.isLight ? "#000000" : "#FFFFFF",
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
                            ? "#FFFFFF"
                            : "rgba(255,255,255,0.05)",
                          borderColor: theme.isLight
                            ? "rgba(15,23,42,0.18)"
                            : "rgba(255,255,255,0.12)",
                        },
                        selected && styles.toggleActive,
                      ]}
                      onPress={() => handleSelectCategory(option)}
                      disabled={saving || loading || interactionLocked}
                    >
                      <Text
                        style={[
                          styles.toggleText,
                          {
                            color: theme.isLight ? "#000000" : "#FFFFFF",
                          },
                          selected && styles.toggleTextActive,
                        ]}
                      >
                        {option === "vehicle" ? "Vehicle" : "Storage"}
                      </Text>
                    </HapticPressable>
                  );
                })}
              </View>

              <Text
                style={[
                  styles.label,
                  {
                    color: theme.isLight ? "#000000" : "#FFFFFF",
                  },
                ]}
              >
                Subtype
              </Text>

              <View style={styles.dropdownWrap}>
                <HapticPressable
                  style={styles.dropdownPressable}
                  onPress={handleToggleSubtypeDropdown}
                  disabled={saving || loading || interactionLocked}
                >
                  <BlurView
                    intensity={theme.isLight ? 0 : 28}
                    tint={
                      theme.isLight
                        ? "light"
                        : "systemUltraThinMaterialDark"
                    }
                    style={[
                      styles.dropdownButton,
                      {
                        backgroundColor: theme.isLight
                          ? "#FFFFFF"
                          : "rgba(255,255,255,0.05)",
                        borderColor: theme.isLight
                          ? "rgba(15,23,42,0.18)"
                          : "rgba(255,255,255,0.12)",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.dropdownButtonText,
                        {
                          color: subtype
                            ? theme.isLight
                              ? "#000000"
                              : "#FFFFFF"
                            : theme.colors.textMuted,
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {subtype || "Select subtype"}
                    </Text>

                    <ChevronDown
                      size={18}
                      color={theme.isLight ? "#000000" : "#FFFFFF"}
                    />
                  </BlurView>
                </HapticPressable>

                {showSubtypeDropdown && (
                  <BlurView
                    intensity={theme.isLight ? 0 : 40}
                    tint={
                      theme.isLight
                        ? "light"
                        : "systemUltraThinMaterialDark"
                    }
                    style={[
                      styles.dropdownCard,
                      {
                        borderColor: theme.isLight
                          ? "rgba(15,23,42,0.10)"
                          : "rgba(255,255,255,0.14)",
                        backgroundColor: theme.isLight
                          ? "#FFFFFF"
                          : "rgba(255,255,255,0.04)",
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
                            {
                              borderBottomColor: theme.isLight
                                ? "rgba(15,23,42,0.08)"
                                : "rgba(255,255,255,0.10)",
                            },
                            index === subtypeOptions.length - 1 &&
                            styles.dropdownRowLast,
                          ]}
                          onPress={() => handleSelectSubtype(option)}
                          disabled={saving || loading || interactionLocked}
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
                      ))}
                    </ScrollView>
                  </BlurView>
                )}
              </View>

              <HapticPressable
                style={styles.saveButton}
                onPress={handleSave}
              >
                <Text style={styles.saveText}>
                  {saving
                    ? "Saving..."
                    : "Save Changes"}
                </Text>
              </HapticPressable>
            </BlurView>
          </ScrollView>

          <KeyboardDismissAccessory
            nativeID={KEYBOARD_ACCESSORY_ID}
          />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1, padding: 16 },
  scrollContent: { paddingBottom: 120 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTextWrap: {
    flex: 1,
    alignItems: "flex-start",
    marginLeft: 12,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
  },
  cancelButton: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    height: 36,
    borderRadius: 12,
    justifyContent: "center",
  },
  cancelText: {
    color: "#111827",
    fontWeight: "700",
  },
  headerSubtitle: {
    color: "#FFFFFF",
    opacity: 0.8,
    marginTop: 8,
    marginBottom: 20,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    overflow: "hidden",
    borderWidth: 1,
  },
  label: {
    marginBottom: 6,
    marginTop: 12,
    fontWeight: "700",
  },
  input: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
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
  },
});