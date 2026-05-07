import { BlurView } from "expo-blur";
import { router, useLocalSearchParams } from "expo-router";
import { ChevronDown, ChevronLeft, Trash2 } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

import HapticPressable from "../../components/ui/HapticPressable";
import ScreenBackground from "../../components/ui/ScreenBackground";
import {
  deleteStorageSpace,
  getStorageSpaceById,
  updateStorageSpace,
} from "../../lib/gearService";
import { useInteractionLock } from "../../lib/useInteractionLock";
import { colors } from "../../theme/tokens";

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

export default function EditStorageScreen() {
  const params = useLocalSearchParams<{
    id?: string | string[];
    storageId?: string | string[];
  }>();

  const storageId = useMemo(() => {
    const value = params.storageId ?? params.id;

    if (Array.isArray(value)) {
      return value[0] ?? "";
    }

    return value ?? "";
  }, [params.storageId, params.id]);

  const {
    isLocked: interactionLocked,
    lock: lockInteraction,
    unlock: unlockInteraction,
  } = useInteractionLock(450);

  const isMountedRef = useRef(true);
  const loadRequestVersionRef = useRef(0);
  const actionLockRef = useRef(false);
  const navigationTransitionLockedRef = useRef(false);
  const navigationUnlockTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const [name, setName] = useState("");
  const [category, setCategory] = useState<"vehicle" | "storage">("vehicle");
  const [subtype, setSubtype] = useState("");
  const [customSubtype, setCustomSubtype] = useState("");
  const [showSubtypeDropdown, setShowSubtypeDropdown] = useState(false);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const nameInputRef = useRef<TextInput | null>(null);
  const customSubtypeInputRef = useRef<TextInput | null>(null);
  const dropdownOpenTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const subtypeOptions = useMemo(() => {
    return category === "vehicle" ? VEHICLE_SUBTYPES : STORAGE_SUBTYPES;
  }, [category]);

  const selectedSubtypeLabel = useMemo(() => {
    if (!subtype && !customSubtype.trim()) return getSubtypePlaceholder(category);
    if (subtype === "Other") {
      return customSubtype.trim() ? customSubtype.trim() : "Other";
    }
    if (!subtype && customSubtype.trim()) return customSubtype.trim();
    return subtype;
  }, [category, subtype, customSubtype]);

  function clearNavigationUnlockTimeout() {
    if (navigationUnlockTimeoutRef.current) {
      clearTimeout(navigationUnlockTimeoutRef.current);
      navigationUnlockTimeoutRef.current = null;
    }
  }

  function clearPendingDropdownOpen() {
    if (dropdownOpenTimeoutRef.current) {
      clearTimeout(dropdownOpenTimeoutRef.current);
      dropdownOpenTimeoutRef.current = null;
    }
  }

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      loadRequestVersionRef.current += 1;
      actionLockRef.current = false;
      navigationTransitionLockedRef.current = false;
      clearNavigationUnlockTimeout();
      clearPendingDropdownOpen();
    };
  }, []);

  const loadStorage = useCallback(async () => {
    const requestVersion = loadRequestVersionRef.current + 1;
    loadRequestVersionRef.current = requestVersion;

    if (!storageId) {
      if (
        !isMountedRef.current ||
        loadRequestVersionRef.current !== requestVersion
      ) {
        return;
      }

      setNotFound(true);
      setLoading(false);
      return;
    }

    try {
      if (isMountedRef.current) {
        setLoading(true);
      }

      const storage = await getStorageSpaceById(storageId);

      if (
        !isMountedRef.current ||
        loadRequestVersionRef.current !== requestVersion
      ) {
        return;
      }

      if (!storage) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const nextCategory = storage.category === "storage" ? "storage" : "vehicle";
      const validOptions =
        nextCategory === "vehicle" ? VEHICLE_SUBTYPES : STORAGE_SUBTYPES;

      setName(storage.name ?? "");
      setCategory(nextCategory);

      if (validOptions.includes(storage.subtype as any)) {
        setSubtype(storage.subtype ?? "");
        setCustomSubtype("");
      } else {
        setSubtype("Other");
        setCustomSubtype(storage.subtype ?? "");
      }

      setNotFound(false);
    } catch (err) {
      console.error("Failed to load storage space:", err);

      if (
        !isMountedRef.current ||
        loadRequestVersionRef.current !== requestVersion
      ) {
        return;
      }

      setNotFound(true);
    } finally {
      if (
        isMountedRef.current &&
        loadRequestVersionRef.current === requestVersion
      ) {
        setLoading(false);
      }
    }
  }, [storageId]);

  useEffect(() => {
    loadStorage();
  }, [loadStorage]);

  async function runWithLock(action: () => Promise<void> | void) {
    if (interactionLocked || actionLockRef.current) return;

    actionLockRef.current = true;
    lockInteraction();

    try {
      await action();
    } finally {
      actionLockRef.current = false;

      if (isMountedRef.current) {
        unlockInteraction();
      }
    }
  }

  function isBusy() {
    return (
      saving ||
      deleting ||
      loading ||
      interactionLocked ||
      actionLockRef.current ||
      navigationTransitionLockedRef.current
    );
  }

  function lockNavigationTransition() {
    if (navigationTransitionLockedRef.current || !isMountedRef.current) {
      return false;
    }

    navigationTransitionLockedRef.current = true;
    clearNavigationUnlockTimeout();

    navigationUnlockTimeoutRef.current = setTimeout(() => {
      navigationTransitionLockedRef.current = false;
      navigationUnlockTimeoutRef.current = null;
    }, 1500);

    return true;
  }

  function runNavigationAction(action: () => void) {
    if (isBusy()) return;

    const lockAcquired = lockNavigationTransition();
    if (!lockAcquired) return;

    action();
  }

  function blurInputs() {
    nameInputRef.current?.blur();
    customSubtypeInputRef.current?.blur();
  }

  function closeSubtypeDropdown() {
    clearPendingDropdownOpen();

    if (isMountedRef.current) {
      setShowSubtypeDropdown(false);
    }
  }

  function handleBack() {
    blurInputs();
    closeSubtypeDropdown();

    runNavigationAction(() => {
      router.back();
    });
  }

  function handleToggleSubtypeDropdown() {
    if (isBusy()) return;

    if (showSubtypeDropdown) {
      closeSubtypeDropdown();
      return;
    }

    blurInputs();
    clearPendingDropdownOpen();

    dropdownOpenTimeoutRef.current = setTimeout(() => {
      if (!isMountedRef.current) {
        return;
      }

      setShowSubtypeDropdown(true);
      dropdownOpenTimeoutRef.current = null;
    }, Platform.OS === "ios" ? 120 : 0);
  }

  function handleSelectSubtype(value: string) {
    if (isBusy()) return;

    blurInputs();
    clearPendingDropdownOpen();
    setSubtype(value);
    setShowSubtypeDropdown(false);

    if (value !== "Other") {
      setCustomSubtype("");
    }
  }

  function handleSelectCategory(nextCategory: "vehicle" | "storage") {
    if (isBusy()) return;

    blurInputs();
    setCategory(nextCategory);
    setSubtype("");
    setCustomSubtype("");
    closeSubtypeDropdown();
  }

  async function handleSave() {
    if (!storageId || isBusy()) return;

    blurInputs();
    closeSubtypeDropdown();

    const trimmedName = name.trim();

    if (!trimmedName) return;

    const finalSubtype =
      subtype === "Other" ? customSubtype.trim() : subtype.trim();

    if (!finalSubtype) return;

    await runWithLock(async () => {
      try {
        if (isMountedRef.current) {
          setSaving(true);
        }

        await updateStorageSpace(storageId, {
          name: trimmedName,
          category,
          subtype: finalSubtype,
        });

        if (!isMountedRef.current) {
          return;
        }

        const lockAcquired = lockNavigationTransition();
        if (!lockAcquired) return;

        router.back();
      } catch (err) {
        console.error("Failed to update storage space:", err);

        if (!isMountedRef.current) {
          return;
        }

        Alert.alert(
          "Save failed",
          "Unable to update this storage space. Please try again."
        );
      } finally {
        if (isMountedRef.current) {
          setSaving(false);
        }
      }
    });
  }

  function handleDelete() {
    if (!storageId || isBusy()) return;

    Alert.alert(
      "Delete Storage Space",
      "Are you sure you want to delete this storage space?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: confirmDelete,
        },
      ]
    );
  }

  async function confirmDelete() {
    if (!storageId || isBusy()) return;

    await runWithLock(async () => {
      try {
        if (isMountedRef.current) {
          setDeleting(true);
        }

        await deleteStorageSpace(storageId);

        if (!isMountedRef.current) {
          return;
        }

        const lockAcquired = lockNavigationTransition();
        if (!lockAcquired) return;

        router.replace("/storage");
      } catch (err) {
        console.error("Failed to delete storage space:", err);

        if (!isMountedRef.current) {
          return;
        }

        Alert.alert(
          "Delete failed",
          "Unable to delete this storage space. Please try again."
        );
      } finally {
        if (isMountedRef.current) {
          setDeleting(false);
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
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="always"
            keyboardDismissMode="on-drag"
            automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.headerRow}>
              <HapticPressable
                onPress={handleBack}
                style={[
                  styles.backButton,
                  isBusy() && styles.disabledInteraction,
                ]}
                disabled={isBusy()}
              >
                <ChevronLeft size={24} color={colors.text} />
              </HapticPressable>

              <View style={styles.headerTextWrap}>
                <Text style={styles.headerTitle}>Edit Storage Space</Text>
              </View>

              <HapticPressable
                onPress={handleDelete}
                disabled={isBusy()}
                style={[
                  styles.deleteButton,
                  isBusy() && styles.disabledInteraction,
                ]}
              >
                <Trash2 size={20} color={colors.danger} />
              </HapticPressable>
            </View>

            <Text style={styles.headerSubtitle}>
              Update the name, category, and subtype for this storage space.
            </Text>

            <BlurView intensity={25} tint="dark" style={styles.card}>
              {loading ? (
                <Text style={styles.loadingText}>Loading...</Text>
              ) : notFound ? (
                <>
                  <Text style={styles.loadingText}>Storage space not found.</Text>
                  <HapticPressable
                    style={[
                      styles.secondaryButton,
                      isBusy() && styles.disabledInteraction,
                    ]}
                    onPress={handleBack}
                    disabled={isBusy()}
                  >
                    <Text style={styles.secondaryButtonText}>Go Back</Text>
                  </HapticPressable>
                </>
              ) : (
                <>
                  <Text style={styles.label}>Name</Text>
                  <TextInput
                    ref={nameInputRef}
                    value={name}
                    onChangeText={setName}
                    onFocus={closeSubtypeDropdown}
                    placeholder="e.g. My Sprinter Van"
                    placeholderTextColor={colors.textMuted}
                    style={styles.input}
                    returnKeyType="done"
                    editable={!isBusy()}
                  />

                  <Text style={styles.label}>Category</Text>
                  <View style={styles.row}>
                    <HapticPressable
                      style={[
                        styles.toggle,
                        category === "vehicle" && styles.toggleActive,
                        isBusy() && styles.disabledInteraction,
                      ]}
                      onPress={() => handleSelectCategory("vehicle")}
                      disabled={isBusy()}
                    >
                      <Text
                        style={[
                          styles.toggleText,
                          category === "vehicle" && styles.toggleTextActive,
                        ]}
                      >
                        Vehicle
                      </Text>
                    </HapticPressable>

                    <HapticPressable
                      style={[
                        styles.toggle,
                        category === "storage" && styles.toggleActive,
                        isBusy() && styles.disabledInteraction,
                      ]}
                      onPress={() => handleSelectCategory("storage")}
                      disabled={isBusy()}
                    >
                      <Text
                        style={[
                          styles.toggleText,
                          category === "storage" && styles.toggleTextActive,
                        ]}
                      >
                        Storage
                      </Text>
                    </HapticPressable>
                  </View>

                  <Text style={styles.label}>Subtype</Text>

                  <View style={styles.dropdownWrap}>
                    <HapticPressable
                      style={[
                        styles.dropdownPressable,
                        isBusy() && styles.disabledInteraction,
                      ]}
                      onPressIn={blurInputs}
                      onPress={handleToggleSubtypeDropdown}
                      disabled={isBusy()}
                    >
                      <BlurView
                        intensity={20}
                        tint="dark"
                        style={styles.dropdownButton}
                      >
                        <Text
                          style={[
                            styles.dropdownButtonText,
                            !subtype && !customSubtype && styles.placeholderText,
                          ]}
                          numberOfLines={1}
                        >
                          {selectedSubtypeLabel}
                        </Text>
                        <ChevronDown size={18} color={colors.textSecondary} />
                      </BlurView>
                    </HapticPressable>

                    {showSubtypeDropdown && (
                      <BlurView
                        intensity={20}
                        tint="dark"
                        style={styles.dropdownCard}
                      >
                        <ScrollView
                          showsVerticalScrollIndicator={false}
                          nestedScrollEnabled
                          keyboardShouldPersistTaps="always"
                        >
                          {subtypeOptions.map((option, index) => (
                            <HapticPressable
                              key={option}
                              style={[
                                styles.dropdownRow,
                                index === subtypeOptions.length - 1 &&
                                  styles.dropdownRowLast,
                                isBusy() && styles.disabledInteraction,
                              ]}
                              onPress={() => handleSelectSubtype(option)}
                              disabled={isBusy()}
                            >
                              <Text style={styles.dropdownRowTitle}>{option}</Text>
                            </HapticPressable>
                          ))}
                        </ScrollView>
                      </BlurView>
                    )}
                  </View>

                  {subtype === "Other" && (
                    <>
                      <Text style={styles.label}>Custom subtype</Text>
                      <TextInput
                        ref={customSubtypeInputRef}
                        value={customSubtype}
                        onChangeText={setCustomSubtype}
                        onFocus={closeSubtypeDropdown}
                        placeholder="Enter your subtype, for example Pods"
                        placeholderTextColor={colors.textMuted}
                        style={styles.input}
                        returnKeyType="done"
                        editable={!isBusy()}
                      />
                    </>
                  )}

                  <HapticPressable
                    style={[
                      styles.saveButton,
                      isBusy() && styles.saveButtonDisabled,
                    ]}
                    onPress={handleSave}
                    disabled={isBusy()}
                  >
                    <Text style={styles.saveText}>
                      {saving ? "Saving..." : "Save Changes"}
                    </Text>
                  </HapticPressable>
                </>
              )}
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
    width: 32,
    height: 32,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  headerTextWrap: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 8,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 26,
  },
  deleteButton: {
    width: 32,
    height: 32,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  headerSubtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 18,
  },

  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.02)",
    overflow: "hidden",
  },

  loadingText: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 20,
  },

  label: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
    marginTop: 12,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },

  input: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: colors.text,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
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
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  toggleActive: {
    backgroundColor: "rgba(255,255,255,0.14)",
    borderColor: "rgba(255,255,255,0.14)",
  },

  toggleText: {
    color: colors.text,
    fontWeight: "600",
    fontSize: 14,
  },

  toggleTextActive: {
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
    borderColor: "rgba(255,255,255,0.10)",
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  dropdownButtonText: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    lineHeight: 18,
  },
  placeholderText: {
    color: colors.textMuted,
  },
  dropdownCard: {
    marginTop: 8,
    maxHeight: 220,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  dropdownRow: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  dropdownRowLast: {
    borderBottomWidth: 0,
  },
  dropdownRowTitle: {
    color: colors.text,
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

  secondaryButton: {
    marginTop: 20,
    backgroundColor: "rgba(255,255,255,0.10)",
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
  },

  secondaryButtonText: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 14,
  },

  disabledInteraction: {
    opacity: 0.6,
  },
});