import React, { useCallback, useState } from "react";
import {
  FlatList,
  Text,
  Pressable,
  StyleSheet,
  View,
  Alert,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Pencil, Trash2, Plus } from "lucide-react-native";
import { Swipeable } from "react-native-gesture-handler";

import ScreenBackground from "../../components/ui/ScreenBackground";
import { colors } from "../../theme/tokens";
import {
  deleteStorageSpace,
  getStorageSpaces,
  StorageSpace,
} from "../../lib/gearService";

export default function InventoryScreen() {
  const [spaces, setSpaces] = useState<StorageSpace[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadSpaces();
    }, [])
  );

  async function loadSpaces() {
    try {
      setLoading(true);
      const data = await getStorageSpaces();
      setSpaces(data);
    } catch (err) {
      console.error("Failed to load storage spaces:", err);
      setSpaces([]);
    } finally {
      setLoading(false);
    }
  }

  function handleOpen(space: StorageSpace) {
    router.push(`/vehicles/${space.id}`);
  }

  function handleEdit(space: StorageSpace) {
    router.push(`/edit-storage/${space.id}`);
  }

  function confirmDelete(space: StorageSpace) {
    Alert.alert(
      "Delete storage space?",
      `Delete "${space.name}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteStorageSpace(space.id);
              await loadSpaces();
            } catch (err) {
              console.error("Failed to delete storage space:", err);
            }
          },
        },
      ]
    );
  }

  function renderRightActions(space: StorageSpace) {
    return (
      <Pressable
        style={styles.swipeDeleteAction}
        onPress={() => confirmDelete(space)}
      >
        <Trash2 size={18} color="#fff" />
        <Text style={styles.swipeDeleteText}>Delete</Text>
      </Pressable>
    );
  }

  function renderItem({ item }: { item: StorageSpace }) {
    return (
      <Swipeable
        renderRightActions={() => renderRightActions(item)}
        overshootRight={false}
      >
        <Pressable
          style={styles.card}
          onPress={() => handleOpen(item)}
        >
          <View style={styles.cardLeft}>
            <Text style={styles.title}>{item.name}</Text>
            <Text style={styles.subtitle}>
              {formatCategory(item.category)} • {item.subtype}
            </Text>
          </View>

          <Pressable
            style={styles.editButton}
            onPress={() => handleEdit(item)}
          >
            <Pencil size={16} color={colors.textSecondary} />
          </Pressable>
        </Pressable>
      </Swipeable>
    );
  }

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe}>
        <FlatList
          data={spaces}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.headerRow}>
              <Text style={styles.headerTitle}>Inventory</Text>

              <Pressable
                style={styles.addButton}
                onPress={() => router.push("/create-storage")}
              >
                <Plus size={16} color="#fff" />
                <Text style={styles.addButtonText}>Add</Text>
              </Pressable>
            </View>
          }
          renderItem={renderItem}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {loading ? "Loading..." : "No storage spaces found."}
            </Text>
          }
        />
      </SafeAreaView>
    </ScreenBackground>
  );
}

function formatCategory(category: string) {
  if (category === "vehicle") return "Vehicle";
  if (category === "storage") return "Storage";
  return category;
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 120,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "700",
  },
  addButton: {
    backgroundColor: "rgba(55,130,245,0.95)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  addButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
  card: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: "rgba(12,24,50,0.9)",
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardLeft: {
    flex: 1,
    paddingRight: 10,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
  subtitle: {
    color: colors.textSecondary,
    marginTop: 4,
    textTransform: "capitalize",
  },
  editButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  empty: {
    color: colors.textSecondary,
    marginTop: 40,
    textAlign: "center",
  },
  swipeDeleteAction: {
    width: 110,
    marginBottom: 12,
    borderRadius: 18,
    backgroundColor: "rgba(180, 40, 40, 0.95)",
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