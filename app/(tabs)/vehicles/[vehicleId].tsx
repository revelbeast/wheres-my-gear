import { BlurView } from "expo-blur";
import { useLocalSearchParams, router } from "expo-router";
import {
  Check,
  ChevronRight,
  Pencil,
  Plus,
  Share2,
  Trash2,
  X,
} from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";

import AppHeader from "../../../components/ui/AppHeader";
import HapticPressable from "../../../components/ui/HapticPressable";
import ScreenBackground from "../../../components/ui/ScreenBackground";
import {
  Compartment,
  StorageSpace,
  createCompartment,
  deleteCompartment,
  getCompartments,
  getStorageSpaceById,
  updateCompartment,
} from "../../../lib/gearService";
import { useInteractionLock } from "../../../lib/useInteractionLock";
import { colors } from "../../../theme/tokens";

export default function VehicleDetailScreen() {
  const params = useLocalSearchParams<{ vehicleId: string | string[] }>();
  const vehicleId = Array.isArray(params.vehicleId)
    ? params.vehicleId[0]
    : params.vehicleId;

  const scrollRef = useRef<ScrollView | null>(null);
  const navigationTransitionLockedRef = useRef(false);
  const headerAddLockedRef = useRef(false);
  const navigationUnlockTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const headerAddUnlockTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const {
    isLocked: interactionLocked,
    lock: lockInteraction,
    unlock: unlockInteraction,
  } = useInteractionLock(450);

  const [storageSpace, setStorageSpace] = useState<StorageSpace | null>(null);
  const [compartments, setCompartments] = useState<Compartment[]>([]);
  const [showCreateBox, setShowCreateBox] = useState(false);
  const [newCompartmentName, setNewCompartmentName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const [editingCompartmentId, setEditingCompartmentId] = useState<string | null>(
    null
  );
  const [editingCompartmentName, setEditingCompartmentName] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingCompartmentId, setDeletingCompartmentId] = useState<
    string | null
  >(null);

  const headerTitle = storageSpace?.name
    ? `${storageSpace.name} Compartments`
    : "Compartments";

  useEffect(() => {
    if (!vehicleId) return;
    loadStorageSpace();
    loadCompartments();
  }, [vehicleId]);

  useEffect(() => {
    return () => {
      if (navigationUnlockTimeoutRef.current) {
        clearTimeout(navigationUnlockTimeoutRef.current);
      }

      if (headerAddUnlockTimeoutRef.current) {
        clearTimeout(headerAddUnlockTimeoutRef.current);
      }
    };
  }, []);

  async function runWithLock(action: () => Promise<void> | void) {
    if (interactionLocked) return;

    lockInteraction();

    try {
      await action();
    } finally {
      unlockInteraction();
    }
  }

  async function loadStorageSpace() {
    try {
      const data = await getStorageSpaceById(String(vehicleId));
      setStorageSpace(data);
    } catch (err) {
      console.error("Failed to load storage space:", err);
      setStorageSpace(null);
    }
  }

  async function loadCompartments() {
    try {
      const data = await getCompartments(String(vehicleId));
      setCompartments(data);
    } catch (err) {
      console.error("Failed to load compartments:", err);
      setCompartments([]);
    }
  }

  function isBusy() {
    return (
      isCreating ||
      savingEdit ||
      !!deletingCompartmentId ||
      interactionLocked ||
      navigationTransitionLockedRef.current ||
      headerAddLockedRef.current
    );
  }

  function scrollToBottom(delay = 120) {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, delay);
  }

  function unlockHeaderAddAfterDelay() {
    if (headerAddUnlockTimeoutRef.current) {
      clearTimeout(headerAddUnlockTimeoutRef.current);
    }

    headerAddUnlockTimeoutRef.current = setTimeout(() => {
      headerAddLockedRef.current = false;
      headerAddUnlockTimeoutRef.current = null;
    }, 700);
  }

  function toggleCreateBox() {
    if (isBusy()) return;

    if (headerAddLockedRef.current) {
      return;
    }

    headerAddLockedRef.current = true;

    Keyboard.dismiss();
    setEditingCompartmentId(null);
    setEditingCompartmentName("");

    setShowCreateBox((prev) => {
      const next = !prev;
      if (!next) {
        setNewCompartmentName("");
      } else {
        scrollToBottom(180);
      }
      return next;
    });

    unlockHeaderAddAfterDelay();
  }

  async function handleShareStorageSpace() {
    if (isBusy()) return;

    const storageName = storageSpace?.name?.trim() || "Storage Space";

    const compartmentText =
      compartments.length > 0
        ? compartments
            .map((compartment, index) => `${index + 1}. ${compartment.name}`)
            .join("\n")
        : "- No compartments added yet";

    const message = [
      `Where's My Gear Storage Space`,
      ``,
      `Storage: ${storageName}`,
      `Compartments: ${compartments.length}`,
      ``,
      `Compartment List`,
      compartmentText,
    ].join("\n");

    await runWithLock(async () => {
      try {
        await Share.share({
          title: storageName,
          message,
        });
      } catch (err) {
        console.error("Failed to share storage space:", err);
        Alert.alert(
          "Storage not shared",
          "Something went wrong while sharing this storage space."
        );
      }
    });
  }

  async function handleCreateCompartment() {
    if (!vehicleId || isCreating || interactionLocked) return;

    const trimmed = newCompartmentName.trim();
    if (!trimmed) return;

    setIsCreating(true);

    await runWithLock(async () => {
      try {
        Keyboard.dismiss();
        await createCompartment(trimmed, String(vehicleId));
        setNewCompartmentName("");
        setShowCreateBox(false);
        await loadCompartments();
      } catch (err) {
        console.error("Failed to create compartment:", err);
        Alert.alert("Error", "Failed to create compartment.");
      } finally {
        setIsCreating(false);
      }
    });
  }

  function startEditing(compartment: Compartment) {
    if (isBusy()) return;

    setShowCreateBox(false);
    setNewCompartmentName("");
    setEditingCompartmentId(compartment.id);
    setEditingCompartmentName(compartment.name);

    scrollToBottom(180);
  }

  function cancelEditing() {
    if (savingEdit) return;

    Keyboard.dismiss();
    setEditingCompartmentId(null);
    setEditingCompartmentName("");
  }

  async function saveEditing(compartmentId: string) {
    if (savingEdit || interactionLocked) return;

    const trimmed = editingCompartmentName.trim();
    if (!trimmed) return;

    setSavingEdit(true);

    await runWithLock(async () => {
      try {
        Keyboard.dismiss();
        await updateCompartment(compartmentId, { name: trimmed });
        setEditingCompartmentId(null);
        setEditingCompartmentName("");
        await loadCompartments();
      } catch (err) {
        console.error("Failed to update compartment:", err);
        Alert.alert("Error", "Failed to update compartment name.");
      } finally {
        setSavingEdit(false);
      }
    });
  }

  function confirmDelete(compartment: Compartment) {
    if (isBusy()) return;

    Alert.alert(
      "Delete compartment?",
      `Delete "${compartment.name}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => handleDelete(compartment),
        },
      ]
    );
  }

  async function handleDelete(compartment: Compartment) {
    if (deletingCompartmentId || interactionLocked) return;

    setDeletingCompartmentId(compartment.id);

    await runWithLock(async () => {
      try {
        await deleteCompartment(compartment.id);
        await loadCompartments();
      } catch (err) {
        console.error("Failed to delete compartment:", err);
        Alert.alert("Error", "Failed to delete compartment.");
      } finally {
        setDeletingCompartmentId(null);
      }
    });
  }

  function renderRightActions(compartment: Compartment) {
    return (
      <HapticPressable
        style={[
          styles.swipeDeleteAction,
          isBusy() && styles.disabledInteraction,
        ]}
        onPress={() => confirmDelete(compartment)}
        disabled={isBusy()}
      >
        <Trash2 size={18} color="#fff" />
        <Text style={styles.swipeDeleteText}>Delete</Text>
      </HapticPressable>
    );
  }

  function handleOpenCompartment(compartmentId: string) {
    if (!vehicleId || !compartmentId) return;

    if (isCreating || savingEdit || !!deletingCompartmentId || interactionLocked) {
      return;
    }

    if (navigationTransitionLockedRef.current) {
      return;
    }

    navigationTransitionLockedRef.current = true;

    if (navigationUnlockTimeoutRef.current) {
      clearTimeout(navigationUnlockTimeoutRef.current);
    }

    Keyboard.dismiss();

    router.push({
      pathname: "/vehicles/[vehicleId]/compartments/[compartmentId]",
      params: {
        vehicleId: String(vehicleId),
        compartmentId: String(compartmentId),
      },
    });

    navigationUnlockTimeoutRef.current = setTimeout(() => {
      navigationTransitionLockedRef.current = false;
      navigationUnlockTimeoutRef.current = null;
    }, 1500);
  }

  const headerRight = (
    <HapticPressable
      style={[styles.headerAddButton, isBusy() && styles.disabledInteraction]}
      onPress={toggleCreateBox}
      disabled={isBusy()}
      accessibilityRole="button"
      accessibilityLabel={showCreateBox ? "Close add compartment" : "Add compartment"}
    >
      <BlurView intensity={18} tint="dark" style={styles.headerAddButtonInner}>
        {showCreateBox ? (
          <X size={22} color="#fff" />
        ) : (
          <Plus size={24} color="#fff" />
        )}
      </BlurView>
    </HapticPressable>
  );

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
          style={styles.keyboardWrap}
        >
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            automaticallyAdjustKeyboardInsets
          >
            <AppHeader
              title={headerTitle}
              showBackButton
              rightContent={headerRight}
            />

            <BlurView intensity={18} tint="dark" style={styles.topActionCard}>
              <View style={styles.topActionTextWrap}>
                <Text style={styles.topActionTitle}>Add Compartment</Text>
                <Text style={styles.topActionSubtitle}>
                  Create a compartment inside this storage space for better
                  organization.
                </Text>
              </View>

              <HapticPressable
                style={[
                  styles.topActionButton,
                  isBusy() && styles.disabledInteraction,
                ]}
                onPress={toggleCreateBox}
                disabled={isBusy()}
              >
                <BlurView
                  intensity={18}
                  tint="dark"
                  style={styles.topActionButtonInner}
                >
                  {showCreateBox ? (
                    <Text style={styles.topActionButtonText}>Close</Text>
                  ) : (
                    <>
                      <Plus size={16} color="#fff" />
                      <Text style={styles.topActionButtonText}>Add</Text>
                    </>
                  )}
                </BlurView>
              </HapticPressable>
            </BlurView>

            <HapticPressable
              style={[
                styles.shareStorageButton,
                isBusy() && styles.disabledInteraction,
              ]}
              onPress={handleShareStorageSpace}
              disabled={isBusy()}
            >
              <Share2 size={18} color="#fff" />
              <Text style={styles.shareStorageButtonText}>
                Share Storage Space
              </Text>
            </HapticPressable>

            {showCreateBox && (
              <BlurView intensity={18} tint="dark" style={styles.createCard}>
                <Text style={styles.createTitle}>Create Compartment</Text>

                <View style={styles.createRow}>
                  <TextInput
                    value={newCompartmentName}
                    onChangeText={setNewCompartmentName}
                    placeholder="Enter compartment name"
                    placeholderTextColor={colors.textMuted}
                    style={styles.createInput}
                    returnKeyType="done"
                    onFocus={() => scrollToBottom(180)}
                    onSubmitEditing={handleCreateCompartment}
                    editable={!isCreating && !interactionLocked}
                    autoFocus
                  />

                  <HapticPressable
                    style={[
                      styles.createButton,
                      (!newCompartmentName.trim() ||
                        isCreating ||
                        interactionLocked) &&
                        styles.createButtonDisabled,
                    ]}
                    onPress={handleCreateCompartment}
                    disabled={
                      !newCompartmentName.trim() ||
                      isCreating ||
                      interactionLocked
                    }
                  >
                    <Plus size={18} color="#fff" />
                  </HapticPressable>
                </View>
              </BlurView>
            )}

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {compartments.length === 0
                  ? "No compartments yet"
                  : `Compartments (${compartments.length})`}
              </Text>
            </View>

            {compartments.length === 0 ? (
              <BlurView intensity={18} tint="dark" style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No compartments found</Text>
                <Text style={styles.emptyText}>
                  Add your first compartment for this storage space to start
                  organizing items.
                </Text>
              </BlurView>
            ) : (
              compartments.map((compartment) => {
                const isEditing = editingCompartmentId === compartment.id;
                const interactionDisabled =
                  isBusy() || deletingCompartmentId === compartment.id;

                return (
                  <Swipeable
                    key={compartment.id}
                    renderRightActions={() => renderRightActions(compartment)}
                    overshootRight={false}
                    enabled={!isEditing && !interactionDisabled}
                  >
                    <BlurView intensity={18} tint="dark" style={styles.card}>
                      {isEditing ? (
                        <View style={styles.editWrap}>
                          <Text style={styles.editLabel}>
                            Edit compartment name
                          </Text>

                          <TextInput
                            value={editingCompartmentName}
                            onChangeText={setEditingCompartmentName}
                            placeholder="Compartment name"
                            placeholderTextColor={colors.textMuted}
                            style={styles.editInput}
                            autoFocus
                            returnKeyType="done"
                            onFocus={() => scrollToBottom(180)}
                            onSubmitEditing={() => saveEditing(compartment.id)}
                            editable={!savingEdit && !interactionLocked}
                            selectTextOnFocus
                          />

                          <View style={styles.editActions}>
                            <HapticPressable
                              style={[
                                styles.saveEditButton,
                                (!editingCompartmentName.trim() ||
                                  savingEdit ||
                                  interactionLocked) &&
                                  styles.createButtonDisabled,
                              ]}
                              onPress={() => saveEditing(compartment.id)}
                              disabled={
                                !editingCompartmentName.trim() ||
                                savingEdit ||
                                interactionLocked
                              }
                            >
                              <Check size={16} color="#fff" />
                              <Text style={styles.saveEditText}>
                                {savingEdit ? "Saving..." : "Save"}
                              </Text>
                            </HapticPressable>

                            <HapticPressable
                              style={[
                                styles.cancelEditButton,
                                (savingEdit || interactionLocked) &&
                                  styles.disabledInteraction,
                              ]}
                              onPress={cancelEditing}
                              disabled={savingEdit || interactionLocked}
                            >
                              <X size={16} color={colors.text} />
                              <Text style={styles.cancelEditText}>Cancel</Text>
                            </HapticPressable>
                          </View>
                        </View>
                      ) : (
                        <>
                          <HapticPressable
                            style={[
                              styles.cardLeft,
                              interactionDisabled && styles.disabledInteraction,
                            ]}
                            onPress={() =>
                              handleOpenCompartment(compartment.id)
                            }
                            disabled={interactionDisabled}
                          >
                            <Text style={styles.cardTitle}>
                              {compartment.name}
                            </Text>
                          </HapticPressable>

                          <View style={styles.cardRight}>
                            <HapticPressable
                              style={[
                                styles.iconButton,
                                interactionDisabled &&
                                  styles.disabledInteraction,
                              ]}
                              onPress={() => startEditing(compartment)}
                              disabled={interactionDisabled}
                            >
                              <Pencil
                                size={16}
                                color={colors.textSecondary}
                              />
                            </HapticPressable>

                            <HapticPressable
                              style={[
                                styles.iconButton,
                                interactionDisabled &&
                                  styles.disabledInteraction,
                              ]}
                              onPress={() =>
                                handleOpenCompartment(compartment.id)
                              }
                              disabled={interactionDisabled}
                            >
                              <ChevronRight
                                size={18}
                                color={colors.textSecondary}
                              />
                            </HapticPressable>
                          </View>
                        </>
                      )}
                    </BlurView>
                  </Swipeable>
                );
              })
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
  },

  keyboardWrap: {
    flex: 1,
  },

  content: {
    padding: 16,
    paddingBottom: 180,
  },

  headerAddButton: {
    borderRadius: 18,
    overflow: "hidden",
  },

  headerAddButtonInner: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },

  topActionCard: {
    marginBottom: 12,
    padding: 16,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(12,24,50,0.20)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  topActionTextWrap: {
    flex: 1,
  },

  topActionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 4,
  },

  topActionSubtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },

  topActionButton: {
    borderRadius: 12,
    overflow: "hidden",
  },

  topActionButtonInner: {
    minWidth: 86,
    height: 42,
    paddingHorizontal: 14,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "rgba(55,130,245,0.95)",
  },

  topActionButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },

  shareStorageButton: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(12,24,50,0.28)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 16,
  },

  shareStorageButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
  },

  createCard: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(12,24,50,0.20)",
  },

  createTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 10,
  },

  createRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  createInput: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(7,20,44,0.55)",
  },

  createButton: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(55,130,245,0.95)",
  },

  createButtonDisabled: {
    opacity: 0.5,
  },

  disabledInteraction: {
    opacity: 0.6,
  },

  sectionHeader: {
    marginBottom: 10,
  },

  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },

  emptyCard: {
    padding: 16,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(12,24,50,0.20)",
  },

  emptyTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 6,
  },

  emptyText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },

  card: {
    padding: 16,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(12,24,50,0.20)",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  cardLeft: {
    flex: 1,
    paddingRight: 10,
  },

  cardRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  cardTitle: {
    color: colors.text,
    fontWeight: "600",
    fontSize: 16,
  },

  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
  },

  editWrap: {
    flex: 1,
    width: "100%",
  },

  editLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },

  editInput: {
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(7,20,44,0.72)",
    marginBottom: 12,
  },

  editActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  saveEditButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: "rgba(55,130,245,0.95)",
  },

  saveEditText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },

  cancelEditButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
  },

  cancelEditText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
  },

  swipeDeleteAction: {
    width: 110,
    marginBottom: 10,
    borderRadius: 16,
    backgroundColor: "rgba(180,40,40,0.95)",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },

  swipeDeleteText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
});