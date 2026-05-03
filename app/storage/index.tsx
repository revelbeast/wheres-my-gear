import { BlurView } from "expo-blur";
import { router, useFocusEffect } from "expo-router";
import {
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react-native";
import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";

import ScreenBackground from "../../components/ui/ScreenBackground";
import {
  deleteStorageSpace,
  getStorageSpaces,
  StorageSpace,
} from "../../lib/gearService";
import { colors } from "../../theme/tokens";

export default function StorageManagementScreen() {
  const [storageSpaces, setStorageSpaces] = useState<StorageSpace[]>([]);
  const [deletingStorageId, setDeletingStorageId] = useState<string | null>(null);

  const sortedStorageSpaces = useMemo(() => {
    return [...storageSpaces].sort((a, b) => {
      const aName = String(a.name ?? "").trim().toLowerCase();
      const bName = String(b.name ?? "").trim().toLowerCase();

      return aName.localeCompare(bName);
    });
  }, [storageSpaces]);

  useFocusEffect(
    useCallback(() => {
      loadStorageSpaces();
    }, [])
  );

  async function loadStorageSpaces() {
    try {
      const spaces = await getStorageSpaces();
      setStorageSpaces(spaces);
    } catch (error) {
      console.error("Failed to load storage spaces:", error);
      setStorageSpaces([]);
    }
  }

  function handleCreateStorage() {
    router.push("/storage/create");
  }

  function handleOpenCompartments(space: StorageSpace) {
    router.push(`/vehicles/${encodeURIComponent(String(space.id))}`);
  }

  function handleEditStorage(space: StorageSpace) {
    router.push({
      pathname: "/storage/edit",
      params: { id: String(space.id) },
    });
  }

  function handleConfirmDeleteStorage(space: StorageSpace) {
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
    try {
      setDeletingStorageId(space.id);
      await deleteStorageSpace(space.id);
      await loadStorageSpaces();
    } catch (error) {
      console.error("Failed to delete storage space:", error);
      Alert.alert(
        "Delete Failed",
        "Unable to delete this storage space. Please try again."
      );
    } finally {
      setDeletingStorageId(null);
    }
  }

  function renderRightActions(space: StorageSpace) {
    const isDeleting = deletingStorageId === space.id;

    return (
      <Pressable
        style={styles.deleteAction}
        onPress={() => handleConfirmDeleteStorage(space)}
        disabled={isDeleting}
      >
        <Trash2 size={20} color={colors.text} />
        <Text style={styles.deleteActionText}>
          {isDeleting ? "Deleting" : "Delete"}
        </Text>
      </Pressable>
    );
  }

  function renderStorageCard(space: StorageSpace) {
    return (
      <Swipeable
        overshootRight={false}
        renderRightActions={() => renderRightActions(space)}
      >
        <BlurView intensity={18} tint="dark" style={styles.storageCard}>
          <Pressable
            style={styles.storageCardMainPressable}
            onPress={() => handleOpenCompartments(space)}
          >
            <View style={styles.storageCardLeft}>
              <Text style={styles.storageTitle}>{space.name}</Text>
              <Text style={styles.storageMeta}>
                {space.category === "vehicle" ? "Vehicle" : "Storage"}
                {space.subtype ? ` • ${space.subtype}` : ""}
              </Text>
            </View>

            <View style={styles.storageCardRight}>
              <Pressable
                style={styles.iconButton}
                onPress={() => handleEditStorage(space)}
                hitSlop={8}
              >
                <Pencil size={16} color={colors.textSecondary} />
              </Pressable>

              <View style={styles.chevronWrap}>
                <ChevronRight size={18} color={colors.textSecondary} />
              </View>
            </View>
          </Pressable>
        </BlurView>
      </Swipeable>
    );
  }

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <View style={styles.headerRow}>
            <Pressable onPress={() => router.back()} style={styles.backButton}>
              <ChevronLeft size={24} color={colors.text} />
            </Pressable>

            <View style={styles.headerTextWrap}>
              <Text style={styles.headerTitle}>Manage Storage Spaces</Text>
            </View>

            <Pressable onPress={handleCreateStorage} style={styles.addButton}>
              <BlurView intensity={20} tint="dark" style={styles.addButtonInner}>
                <Plus size={18} color={colors.text} />
              </BlurView>
            </Pressable>
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
    width: 36,
    height: 36,
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
  },

  addButton: {
    borderRadius: 12,
    overflow: "hidden",
  },

  addButtonInner: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.04)",
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
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.02)",
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
});