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
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";

import HapticPressable from "../../../components/ui/HapticPressable";
import ScreenBackground from "../../../components/ui/ScreenBackground";
import { useThemedValues } from "../../../components/ui/Themed";
import {
  deleteStorageSpace,
  getStorageSpaces,
  StorageSpace,
} from "../../../lib/gearService";
import { useInteractionLock } from "../../../lib/useInteractionLock";
import { colors } from "../../../theme/tokens";

export default function StorageManagementScreen() {
  const theme = useThemedValues();

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
  }, []);

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
              borderColor: theme.isLight
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
            onPress={() => handleOpenCompartments(space)}
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