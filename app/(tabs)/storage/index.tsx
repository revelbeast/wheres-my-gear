import { BlurView } from "expo-blur";
import { router, useFocusEffect } from "expo-router";
import {
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";

import HapticPressable from "../../../components/ui/HapticPressable";
import ScreenBackground from "../../../components/ui/ScreenBackground";
import { useThemedValues } from "../../../components/ui/Themed";
import {
  deleteStorageSpace,
  getCompartmentsByVehicle,
  getItemsByCompartment,
  getStorageSpaces,
  updateItem,
  type Compartment,
  type Item,
  type StorageSpace
} from "../../../lib/gearService";
import { useDeviceLayout } from "../../../lib/useDeviceLayout";
import { useInteractionLock } from "../../../lib/useInteractionLock";
import { colors } from "../../../theme/tokens";

export default function StorageManagementScreen() {
  const theme = useThemedValues();
  const { isTablet, isLandscape } = useDeviceLayout();
  const isTabletLandscape = isTablet && isLandscape;

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

  const [storageSpaces, setStorageSpaces] = useState<StorageSpace[]>([]);
  const [selectedStorageId, setSelectedStorageId] = useState<string | null>(null);
  const [compartments, setCompartments] = useState<Compartment[]>([]);
  const [selectedCompartmentId, setSelectedCompartmentId] = useState<string | null>(null);
  const [compartmentItems, setCompartmentItems] = useState<Item[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemName, setEditingItemName] = useState("");
  const [savingItemEdit, setSavingItemEdit] = useState(false);
  const [showCompartmentDropdown, setShowCompartmentDropdown] = useState(false);
  const [deletingStorageId, setDeletingStorageId] = useState<string | null>(null);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      loadRequestVersionRef.current += 1;
      actionLockRef.current = false;
      navigationTransitionLockedRef.current = false;

      if (navigationUnlockTimeoutRef.current) {
        clearTimeout(navigationUnlockTimeoutRef.current);
        navigationUnlockTimeoutRef.current = null;
      }
    };
  }, []);

  const sortedStorageSpaces = useMemo(() => {
    return [...storageSpaces].sort((a, b) => {
      const aName = String(a.name ?? "").trim().toLowerCase();
      const bName = String(b.name ?? "").trim().toLowerCase();

      return aName.localeCompare(bName);
    });
  }, [storageSpaces]);

  const loadStorageSpaces = useCallback(async () => {
    const requestVersion = loadRequestVersionRef.current + 1;
    loadRequestVersionRef.current = requestVersion;

    try {
      const spaces = await getStorageSpaces();

      if (
        !isMountedRef.current ||
        loadRequestVersionRef.current !== requestVersion
      ) {
        return;
      }

      setStorageSpaces(spaces);

      const sortedSpaces = [...spaces].sort((a, b) =>
        String(a.name ?? "").localeCompare(String(b.name ?? ""))
      );

      const nextSelectedStorageId =
        selectedStorageId && sortedSpaces.some((space) => space.id === selectedStorageId)
          ? selectedStorageId
          : sortedSpaces[0]?.id ?? null;

      setSelectedStorageId(nextSelectedStorageId);

      if (nextSelectedStorageId) {
        const nextCompartments = await getCompartmentsByVehicle(nextSelectedStorageId);

        if (
          !isMountedRef.current ||
          loadRequestVersionRef.current !== requestVersion
        ) {
          return;
        }

        setCompartments(nextCompartments);

        const nextSelectedCompartmentId =
          selectedCompartmentId &&
            nextCompartments.some((compartment) => compartment.id === selectedCompartmentId)
            ? selectedCompartmentId
            : nextCompartments[0]?.id ?? null;

        setSelectedCompartmentId(nextSelectedCompartmentId);

        if (nextSelectedCompartmentId) {
          const nextItems = await getItemsByCompartment(nextSelectedCompartmentId);

          if (
            !isMountedRef.current ||
            loadRequestVersionRef.current !== requestVersion
          ) {
            return;
          }

          setCompartmentItems(nextItems);
        } else {
          setCompartmentItems([]);
        }
      } else {
        setCompartments([]);
        setSelectedCompartmentId(null);
        setCompartmentItems([]);
      }
    } catch (error) {
      console.error("Failed to load storage spaces:", error);

      if (
        !isMountedRef.current ||
        loadRequestVersionRef.current !== requestVersion
      ) {
        return;
      }

      setStorageSpaces([]);
    }
  }, [selectedStorageId, selectedCompartmentId]);

  useFocusEffect(
    useCallback(() => {
      isMountedRef.current = true;

      // IMPORTANT: reset interaction state when returning to screen
      navigationTransitionLockedRef.current = false;
      actionLockRef.current = false;

      loadStorageSpaces();

      return () => {
        loadRequestVersionRef.current += 1;

        // safety reset on blur
        navigationTransitionLockedRef.current = false;
        actionLockRef.current = false;
      };
    }, [loadStorageSpaces])
  );

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
      interactionLocked ||
      actionLockRef.current ||
      !!deletingStorageId ||
      navigationTransitionLockedRef.current
    );
  }

  function lockNavigationTransition() {
    if (navigationTransitionLockedRef.current || !isMountedRef.current) {
      return false;
    }

    navigationTransitionLockedRef.current = true;

    if (navigationUnlockTimeoutRef.current) {
      clearTimeout(navigationUnlockTimeoutRef.current);
    }

    navigationUnlockTimeoutRef.current = setTimeout(() => {
      navigationTransitionLockedRef.current = false;
      navigationUnlockTimeoutRef.current = null;
    }, 1500);

    return true;
  }

  function handleBack() {
    if (isBusy()) return;

    const lockAcquired = lockNavigationTransition();
    if (!lockAcquired) return;

    router.replace("/inventory");
  }

  function handleCreateStorage() {
    if (isBusy()) return;

    const lockAcquired = lockNavigationTransition();
    if (!lockAcquired) return;

    router.push({
      pathname: "/(tabs)/storage/create",
    });
  }

  function handleCreateCompartment() {
    if (!isTabletLandscape || !selectedStorageId || isBusy()) return;

    const lockAcquired = lockNavigationTransition();
    if (!lockAcquired) return;

    router.push({
      pathname: "/(tabs)/vehicles/[vehicleId]/compartments/create",
      params: {
        vehicleId: selectedStorageId,
      },
    });
  }

  function handleOpenCompartments(space: StorageSpace) {
    if (!space.id || isBusy()) return;

    const lockAcquired = lockNavigationTransition();
    if (!lockAcquired) return;

    router.push({
      pathname: "/vehicles/[vehicleId]",
      params: {
        vehicleId: String(space.id),
      },
    });
  }

  function handleSelectStorage(space: StorageSpace) {
    if (!space.id || isBusy()) return;

    if (isTabletLandscape) {
      setSelectedStorageId(String(space.id));
      return;
    }

    handleOpenCompartments(space);
  }

  async function handleSelectCompartment(compartmentId: string) {
    if (isBusy()) return;

    setSelectedCompartmentId(compartmentId);
    setShowCompartmentDropdown(false);

    try {
      const nextItems = await getItemsByCompartment(compartmentId);

      if (!isMountedRef.current) return;

      setCompartmentItems(nextItems);
    } catch (error) {
      console.error("Failed to load compartment items:", error);

      if (!isMountedRef.current) return;

      setCompartmentItems([]);
    }
  }

  function startEditingItem(item: Item) {
    if (isBusy()) return;

    setSelectedItemId(item.id);
    setEditingItemId(item.id);
    setEditingItemName(String(item.name ?? ""));
  }

  function cancelEditingItem() {
    setEditingItemId(null);
    setEditingItemName("");
    setSavingItemEdit(false);
  }

  async function saveEditingItem(item: Item) {
    const nextName = editingItemName.trim();

    if (!item.id || !nextName || savingItemEdit || isBusy()) return;

    try {
      setSavingItemEdit(true);
      await updateItem(item.id, { name: nextName });

      if (!isMountedRef.current) return;

      setCompartmentItems((currentItems) =>
        currentItems.map((currentItem) =>
          currentItem.id === item.id
            ? { ...currentItem, name: nextName }
            : currentItem
        )
      );

      cancelEditingItem();
    } catch (error) {
      console.error("Failed to edit item:", error);

      if (!isMountedRef.current) return;

      Alert.alert("Edit Failed", "Unable to update this item. Please try again.");
    } finally {
      if (isMountedRef.current) {
        setSavingItemEdit(false);
      }
    }
  }

  function handleEditStorage(space: StorageSpace) {
    if (!space.id || isBusy()) return;

    const lockAcquired = lockNavigationTransition();
    if (!lockAcquired) return;

    router.push({
      pathname: "/(tabs)/storage/edit",
      params: { id: String(space.id) },
    });
  }

  function handleConfirmDeleteStorage(space: StorageSpace) {
    if (!space.id || isBusy()) return;

    Alert.alert(
      "Delete Storage Space?",
      `This will permanently delete "${space.name}", its compartments, and all inventory items stored inside it. This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => handleDeleteStorage(space),
        },
      ]
    );
  }

  async function handleDeleteStorage(space: StorageSpace) {
    if (!space.id || isBusy()) return;

    const storageId = String(space.id);

    if (isMountedRef.current) {
      setDeletingStorageId(storageId);
    }

    await runWithLock(async () => {
      try {
        await deleteStorageSpace(storageId);

        if (!isMountedRef.current) {
          return;
        }

        await loadStorageSpaces();
      } catch (error) {
        console.error("Failed to delete storage space:", error);

        if (!isMountedRef.current) {
          return;
        }

        Alert.alert(
          "Delete Failed",
          "Unable to delete this storage space. Please try again."
        );
      } finally {
        if (isMountedRef.current) {
          setDeletingStorageId(null);
        }
      }
    });
  }

  function renderRightActions(space: StorageSpace) {
    const isDeleting = deletingStorageId === space.id;
    const disabled = isDeleting || isBusy();

    return (
      <HapticPressable
        style={[styles.deleteAction, disabled && styles.disabledInteraction]}
        onPress={() => handleConfirmDeleteStorage(space)}
        disabled={disabled}
      >
        <Trash2 size={20} color={colors.text} />
        <Text style={styles.deleteActionText}>
          {isDeleting ? "Deleting" : "Delete"}
        </Text>
      </HapticPressable>
    );
  }

  function renderStorageCard(space: StorageSpace) {
    const isDeleting = deletingStorageId === space.id;
    const isSelected = isTabletLandscape && selectedStorageId === space.id;
    const interactionDisabled = isDeleting || isBusy();

    return (
      <Swipeable
        overshootRight={false}
        renderRightActions={() => renderRightActions(space)}
        enabled={!interactionDisabled}
      >
        <BlurView
          intensity={theme.isLight ? 0 : 18}
          tint={theme.isLight ? "light" : "dark"}
          style={[
            styles.storageCard,
            {
              backgroundColor: theme.isLight
                ? "#FFFFFF"
                : "rgba(15,23,42,0.20)",
              borderColor: isSelected
                ? "rgba(59,130,246,0.95)"
                : theme.isLight
                  ? "rgba(15,23,42,0.10)"
                  : "rgba(255,255,255,0.12)",
            },
          ]}
        >
          <HapticPressable
            style={[
              styles.storageCardMainPressable,
              interactionDisabled && styles.disabledInteraction,
            ]}
            onPress={() => handleSelectStorage(space)}
            disabled={interactionDisabled}
          >
            <View style={styles.storageCardLeft}>
              <Text
                style={[
                  styles.storageTitle,
                  {
                    color: theme.isLight ? "#000000" : colors.text,
                  },
                ]}
              >
                {space.name}
              </Text>

              <Text
                style={[
                  styles.storageMeta,
                  {
                    color: theme.isLight ? "#000000" : colors.textSecondary,
                  },
                ]}
              >
                {space.category === "vehicle" ? "Vehicle" : "Storage"}
                {space.subtype ? ` • ${space.subtype}` : ""}
              </Text>
            </View>

            <View style={styles.storageCardRight}>
              <HapticPressable
                style={[
                  styles.iconButton,
                  interactionDisabled && styles.disabledInteraction,
                ]}
                onPress={() => handleEditStorage(space)}
                hitSlop={8}
                disabled={interactionDisabled}
              >
                <Pencil
                  size={16}
                  color={theme.isLight ? "#000000" : colors.textSecondary}
                />
              </HapticPressable>

              <HapticPressable
                style={[
                  styles.iconButton,
                  interactionDisabled && styles.disabledInteraction,
                ]}
                onPress={() => handleConfirmDeleteStorage(space)}
                hitSlop={8}
                disabled={interactionDisabled}
              >
                <Trash2
                  size={16}
                  color={theme.isLight ? "#DC2626" : "#F87171"}
                />
              </HapticPressable>

              <View style={styles.chevronWrap}>
                <ChevronRight
                  size={18}
                  color={theme.isLight ? "#000000" : colors.textSecondary}
                />
              </View>
            </View>
          </HapticPressable>
        </BlurView>
      </Swipeable >
    );
  }

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <View style={styles.headerRow}>
            <HapticPressable
              onPress={handleBack}
              style={[styles.backButton, isBusy() && styles.disabledInteraction]}
              disabled={isBusy()}
            >
              <ChevronLeft size={24} color="#111827" />
            </HapticPressable>

            <View style={styles.headerTextWrap}>
              <Text style={styles.headerTitle}>Manage Storage Spaces</Text>
            </View>

            <HapticPressable
              onPress={handleCreateStorage}
              style={[styles.addButton, isBusy() && styles.disabledInteraction]}
              disabled={isBusy()}
            >
              <BlurView intensity={20} tint="dark" style={styles.addButtonInner}>
                <Plus size={18} color="#111827" />
              </BlurView>
            </HapticPressable>
          </View>

          <Text style={styles.headerSubtitle}>
            Tap a storage space to view compartments. Use the pencil to edit, or swipe left to delete.
          </Text>

          {isTabletLandscape ? (
            <View style={styles.splitLayout}>
              <View style={styles.splitColumn}>
                <FlatList
                  data={sortedStorageSpaces}
                  keyExtractor={(item) => item.id}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.listContent}
                  renderItem={({ item }) => renderStorageCard(item)}
                  ListEmptyComponent={
                    <BlurView intensity={18} tint="dark" style={styles.emptyCard}>
                      <Text style={styles.emptyTitle}>
                        Start by adding a storage space
                      </Text>
                      <Text style={styles.emptyText}>
                        Add a storage space to begin organizing your gear.
                      </Text>
                    </BlurView>
                  }
                />
              </View>

              <View style={styles.splitColumn}>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 10,
                  }}
                >
                  <Text style={styles.panelTitle}>Compartments</Text>

                  <HapticPressable
                    onPress={handleCreateCompartment}
                    disabled={!selectedStorageId || isBusy()}
                    style={[
                      styles.iconButton,
                      (!selectedStorageId || isBusy()) &&
                      styles.disabledInteraction,
                    ]}
                  >
                    <Plus
                      size={18}
                      color={theme.isLight ? "#000000" : colors.text}
                    />
                  </HapticPressable>
                </View>

                {compartments.length === 0 ? (
                  <BlurView intensity={18} tint="dark" style={styles.emptyCard}>
                    <Text style={styles.emptyTitle}>No compartments yet</Text>
                    <Text style={styles.emptyText}>
                      Tap + to create your first compartment.
                    </Text>
                  </BlurView>
                ) : (
                  <View>
                    <HapticPressable
                      onPress={() =>
                        setShowCompartmentDropdown((currentValue) => !currentValue)
                      }
                      style={{ width: "100%" }}
                    >
                      <BlurView
                        intensity={theme.isLight ? 0 : 18}
                        tint={theme.isLight ? "light" : "dark"}
                        style={[
                          styles.compartmentCard,
                          {
                            backgroundColor: theme.isLight
                              ? "#FFFFFF"
                              : "rgba(15,23,42,0.20)",
                            borderColor: "#3B82F6",
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.storageTitle,
                            {
                              color: theme.isLight ? "#000000" : colors.text,
                            },
                          ]}
                        >
                          {compartments.find(
                            (compartment) =>
                              compartment.id === selectedCompartmentId
                          )?.name ?? "Select compartment"}
                        </Text>

                        <Text style={styles.storageMeta}>
                          Tap to choose a compartment
                        </Text>
                      </BlurView>
                    </HapticPressable>

                    {showCompartmentDropdown ? (
                      <FlatList
                        data={compartments}
                        keyExtractor={(item) => item.id}
                        showsVerticalScrollIndicator={true}
                        style={{ maxHeight: 220 }}
                        renderItem={({ item }) => (
                          <HapticPressable
                            onPress={() => handleSelectCompartment(item.id)}
                            style={{ width: "100%" }}
                          >
                            <BlurView
                              intensity={theme.isLight ? 0 : 18}
                              tint={theme.isLight ? "light" : "dark"}
                              style={[
                                styles.compartmentCard,
                                {
                                  backgroundColor:
                                    selectedCompartmentId === item.id
                                      ? theme.isLight
                                        ? "#E5F0FF"
                                        : "rgba(59,130,246,0.15)"
                                      : theme.isLight
                                        ? "#FFFFFF"
                                        : "rgba(15,23,42,0.20)",
                                  borderColor:
                                    selectedCompartmentId === item.id
                                      ? "#3B82F6"
                                      : theme.isLight
                                        ? "rgba(15,23,42,0.10)"
                                        : "rgba(255,255,255,0.12)",
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.storageTitle,
                                  {
                                    color:
                                      selectedCompartmentId === item.id
                                        ? "#3B82F6"
                                        : theme.isLight
                                          ? "#000000"
                                          : colors.text,
                                  },
                                ]}
                              >
                                {item.name}
                              </Text>
                            </BlurView>
                          </HapticPressable>
                        )}
                      />
                    ) : null}
                  </View>
                )}

                {selectedCompartmentId ? (
                  <View style={{ marginTop: 16 }}>
                    <Text style={styles.panelTitle}>Items</Text>

                    {compartmentItems.length === 0 ? (
                      <Text style={styles.storageMeta}>
                        No items in this compartment
                      </Text>
                    ) : (
                      <FlatList
                        data={compartmentItems}
                        keyExtractor={(item) => item.id}
                        scrollEnabled={false}
                        renderItem={({ item }) => {
                          const isSelectedItem = selectedItemId === item.id;

                          return (
                            <HapticPressable
                              onPress={() => setSelectedItemId(item.id)}
                              style={{ width: "100%" }}
                              disabled={isBusy()}
                            >
                              <BlurView
                                intensity={theme.isLight ? 0 : 18}
                                tint={theme.isLight ? "light" : "dark"}
                                style={[
                                  styles.compartmentCard,
                                  {
                                    backgroundColor: isSelectedItem
                                      ? theme.isLight
                                        ? "#E5F0FF"
                                        : "rgba(59,130,246,0.15)"
                                      : theme.isLight
                                        ? "#FFFFFF"
                                        : "rgba(15,23,42,0.20)",
                                    borderColor: isSelectedItem
                                      ? "#3B82F6"
                                      : theme.isLight
                                        ? "rgba(15,23,42,0.10)"
                                        : "rgba(255,255,255,0.12)",
                                  },
                                ]}
                              >
                                {editingItemId === item.id ? (
                                  <View>
                                    <TextInput
                                      value={editingItemName}
                                      onChangeText={setEditingItemName}
                                      placeholder="Item name"
                                      placeholderTextColor={
                                        theme.isLight
                                          ? "rgba(0,0,0,0.45)"
                                          : colors.textSecondary
                                      }
                                      style={{
                                        borderWidth: 1,
                                        borderRadius: 12,
                                        paddingHorizontal: 12,
                                        paddingVertical: 10,
                                        color: theme.isLight
                                          ? "#000000"
                                          : colors.text,
                                        borderColor: theme.isLight
                                          ? "rgba(15,23,42,0.12)"
                                          : "rgba(255,255,255,0.12)",
                                        backgroundColor: theme.isLight
                                          ? "#FFFFFF"
                                          : "rgba(255,255,255,0.04)",
                                      }}
                                    />

                                    <View
                                      style={{
                                        flexDirection: "row",
                                        gap: 8,
                                        marginTop: 10,
                                      }}
                                    >
                                      <HapticPressable
                                        onPress={() => saveEditingItem(item)}
                                        disabled={savingItemEdit}
                                        style={{
                                          backgroundColor: "#2563EB",
                                          borderRadius: 10,
                                          paddingHorizontal: 14,
                                          paddingVertical: 10,
                                        }}
                                      >
                                        <Text style={{ color: "#FFFFFF" }}>
                                          Save
                                        </Text>
                                      </HapticPressable>

                                      <HapticPressable
                                        onPress={cancelEditingItem}
                                        style={{
                                          borderRadius: 10,
                                          paddingHorizontal: 14,
                                          paddingVertical: 10,
                                          borderWidth: 1,
                                          borderColor: theme.isLight
                                            ? "rgba(15,23,42,0.12)"
                                            : "rgba(255,255,255,0.12)",
                                        }}
                                      >
                                        <Text
                                          style={{
                                            color: theme.isLight
                                              ? "#000000"
                                              : colors.text,
                                          }}
                                        >
                                          Cancel
                                        </Text>
                                      </HapticPressable>
                                    </View>
                                  </View>
                                ) : (
                                  <>
                                    <View
                                      style={{
                                        flexDirection: "row",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                      }}
                                    >
                                      <Text style={styles.storageTitle}>
                                        {item.name}
                                      </Text>

                                      {isSelectedItem ? (
                                        <HapticPressable
                                          onPress={() => startEditingItem(item)}
                                          style={{
                                            width: 34,
                                            height: 34,
                                            borderRadius: 10,
                                            justifyContent: "center",
                                            alignItems: "center",
                                            backgroundColor: theme.isLight
                                              ? "rgba(15,23,42,0.05)"
                                              : "rgba(255,255,255,0.08)",
                                          }}
                                        >
                                          <Pencil
                                            size={16}
                                            color={
                                              theme.isLight
                                                ? "#000000"
                                                : colors.text
                                            }
                                          />
                                        </HapticPressable>
                                      ) : null}
                                    </View>

                                    <Text style={styles.storageMeta}>
                                      Qty: {item.quantity} • {item.status}
                                    </Text>
                                  </>
                                )}
                              </BlurView>
                            </HapticPressable>
                          );
                        }}
                      />
                    )}
                  </View>
                ) : null}
              </View>
            </View>
          ) : (
            <FlatList
              data={sortedStorageSpaces}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => renderStorageCard(item)}
              ListEmptyComponent={
                <BlurView intensity={18} tint="dark" style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>No storage spaces found</Text>
                  <Text style={styles.emptyText}>
                    Tap the plus button to add your first storage space.
                  </Text>
                </BlurView>
              }
            />
          )}
        </View>
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
    paddingTop: 8,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    gap: 10,
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },

  headerTextWrap: {
    flex: 1,
    alignItems: "flex-start",
    paddingHorizontal: 8,
  },

  headerTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "700",
    textAlign: "left",
  },

  addButton: {
    borderRadius: 13,
    overflow: "hidden",
  },

  addButtonInner: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "#FFFFFF",
  },

  headerSubtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    marginBottom: 14,
  },

  splitLayout: {
    flex: 1,
    flexDirection: "row",
    gap: 16,
  },

  splitColumn: {
    flex: 1,
    minWidth: 0,
  },

  panelTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 10,
  },

  compartmentCard: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 8,
  },

  listContent: {
    paddingBottom: 140,
  },

  storageCard: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.10)",
    backgroundColor: "#FFFFFF",
    marginBottom: 8,
  },

  storageCardMainPressable: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  storageCardLeft: {
    flex: 1,
  },

  storageTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },

  storageMeta: {
    color: colors.textSecondary,
    fontSize: 12,
  },

  storageCardRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
  },

  chevronWrap: {
    width: 24,
    alignItems: "flex-end",
  },

  deleteAction: {
    width: 92,
    minHeight: 58,
    marginBottom: 8,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.danger,
  },

  deleteActionText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "700",
  },

  emptyCard: {
    borderRadius: 16,
    padding: 14,
    marginTop: 4,
  },

  emptyTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },

  emptyText: {
    color: colors.textSecondary,
    fontSize: 13,
  },

  disabledInteraction: {
    opacity: 0.6,
  },
});