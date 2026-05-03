import { useFocusEffect } from "@react-navigation/native";
import { BlurView } from "expo-blur";
import { router, useLocalSearchParams } from "expo-router";
import {
  AlertCircle,
  Boxes,
  CheckCircle2,
  ChevronRight,
  FolderCog,
  Plus,
  Search,
} from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../../components/auth/AuthProvider";
import ScreenBackground from "../../components/ui/ScreenBackground";
import { ThemedButton, ThemedText } from "../../components/ui/Themed";
import {
  getAllItems,
  getStorageSpaces,
  Item,
  StorageSpace,
} from "../../lib/gearService";
import { useTheme } from "../../lib/useTheme";

type StatusFilter = "all" | "packed" | "toPack";

function getItemQuantity(item: { quantity?: number }) {
  const qty = Number(item.quantity ?? 1);
  return Number.isFinite(qty) && qty > 0 ? qty : 1;
}

function normalizeSearchValue(value: string) {
  return value.trim().toLowerCase();
}

function isPackedItem(item: Item) {
  return item.status === "packed";
}

export default function InventoryScreen() {
  const { user, initializing } = useAuth();
  const params = useLocalSearchParams<{ status?: string }>();
  const theme = useTheme();

  const [inventoryItems, setInventoryItems] = useState<Item[]>([]);
  const [storageSpaces, setStorageSpaces] = useState<StorageSpace[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  useEffect(() => {
    const incomingStatus = String(params.status ?? "").toLowerCase().trim();

    if (incomingStatus === "packed") {
      setStatusFilter("packed");
      return;
    }

    if (incomingStatus === "missing" || incomingStatus === "topack") {
      setStatusFilter("toPack");
      return;
    }

    setStatusFilter("all");
  }, [params.status]);

  useFocusEffect(
    useCallback(() => {
      if (initializing || !user) {
        setInventoryItems([]);
        setStorageSpaces([]);
        return;
      }

      loadInventoryData();
    }, [initializing, user])
  );

  async function loadInventoryData() {
    if (!user) return;

    try {
      const [items, spaces] = await Promise.all([
        getAllItems(),
        getStorageSpaces(),
      ]);

      setInventoryItems(items);
      setStorageSpaces(spaces);
    } catch {
      setInventoryItems([]);
      setStorageSpaces([]);
    }
  }

  const vehicleNameById = useMemo(() => {
    return new Map(storageSpaces.map((s) => [s.id, s.name]));
  }, [storageSpaces]);

  const allDisplayItems = useMemo(() => {
    return inventoryItems
      .filter((item) => {
        if (statusFilter === "packed") return isPackedItem(item);
        if (statusFilter === "toPack") return !isPackedItem(item);
        return true;
      })
      .map((item) => ({
        ...item,
        resolvedVehicleName:
          item.vehicleName ||
          vehicleNameById.get(item.vehicleId ?? "") ||
          "No storage",
        resolvedCompartmentName: item.compartmentName || "No compartment",
      }))
      .sort((a, b) => {
        const aName = String(a.name ?? "").trim().toLowerCase();
        const bName = String(b.name ?? "").trim().toLowerCase();

        return aName.localeCompare(bName);
      });
  }, [inventoryItems, statusFilter, vehicleNameById]);

  const filteredItems = useMemo(() => {
    const q = normalizeSearchValue(searchQuery);

    return allDisplayItems.filter((item) => {
      if (!q) return true;

      return (
        item.name?.toLowerCase().includes(q) ||
        item.notes?.toLowerCase().includes(q) ||
        item.resolvedCompartmentName.toLowerCase().includes(q) ||
        item.resolvedVehicleName.toLowerCase().includes(q)
      );
    });
  }, [allDisplayItems, searchQuery]);

  const allCount = inventoryItems.reduce(
    (total, item) => total + getItemQuantity(item),
    0
  );

  const packedCount = inventoryItems
    .filter(isPackedItem)
    .reduce((total, item) => total + getItemQuantity(item), 0);

  const toPackCount = inventoryItems
    .filter((item) => !isPackedItem(item))
    .reduce((total, item) => total + getItemQuantity(item), 0);

  function getHeaderTitle() {
    if (statusFilter === "packed") return "Packed Items";
    if (statusFilter === "toPack") return "Still To Pack";
    return "Inventory";
  }

  function getHeaderSubtitle() {
    if (statusFilter === "packed") {
      return "Items currently marked as packed.";
    }

    if (statusFilter === "toPack") {
      return "Items still waiting to be packed.";
    }

    return "All items across your storage spaces.";
  }

  function getListHeaderTitle() {
    if (statusFilter === "packed") return "Packed Items";
    if (statusFilter === "toPack") return "Still To Pack Items";
    return "Running Inventory";
  }

  function getEmptyTitle() {
    if (!user) return "Sign in required";

    if (searchQuery.trim().length > 0) return "No matching items found";

    if (inventoryItems.length === 0) return "No inventory yet";

    if (statusFilter === "packed") return "No packed items yet";

    if (statusFilter === "toPack") return "Nothing left to pack";

    return "No items found";
  }

  function getEmptyText() {
    if (!user) {
      return "Sign in to view the gear saved to your storage spaces and compartments.";
    }

    if (searchQuery.trim().length > 0) {
      return "Try searching by item name, notes, compartment, or storage space.";
    }

    if (inventoryItems.length === 0) {
      return "Add a storage space, create compartments, then add items to build your inventory.";
    }

    if (statusFilter === "packed") {
      return "Items will appear here once you mark them as packed.";
    }

    if (statusFilter === "toPack") {
      return "All visible items are currently packed. Mark an item as To Pack when it needs attention.";
    }

    return "No items match the current view.";
  }

  function handleAddStorageSpace() {
    router.push("/storage/create");
  }

  function handleOpenItem(item: Item) {
    if (!item.vehicleId || !item.compartmentId) {
      return;
    }

    router.push({
      pathname: "/vehicles/[vehicleId]/compartments/[compartmentId]",
      params: {
        vehicleId: item.vehicleId,
        compartmentId: item.compartmentId,
      },
    });
  }

  function renderFilterChip(
    value: StatusFilter,
    label: string,
    count: number,
    icon: React.ReactNode
  ) {
    const selected = statusFilter === value;

    return (
      <Pressable
        key={value}
        style={styles.filterPressable}
        onPress={() => setStatusFilter(value)}
      >
        <BlurView
          intensity={theme.isLight ? 18 : 18}
          tint={theme.isLight ? "light" : "dark"}
          style={[
            styles.filterChip,
            {
              backgroundColor: theme.colors.card,
              borderColor: selected
                ? theme.colors.primary
                : theme.colors.border,
            },
          ]}
        >
          {icon}
          <ThemedText variant="title">{count}</ThemedText>
          <ThemedText color="secondary">{label}</ThemedText>
        </BlurView>
      </Pressable>
    );
  }

  function renderEmptyState() {
    const showAddStorageAction =
      !!user && inventoryItems.length === 0 && searchQuery.trim().length === 0;

    return (
      <BlurView
        intensity={theme.isLight ? 18 : 22}
        tint={theme.isLight ? "light" : "dark"}
        style={[
          styles.emptyCard,
          {
            backgroundColor: theme.colors.card,
            borderColor: theme.colors.border,
          },
        ]}
      >
        <View style={styles.emptyIconWrap}>
          {inventoryItems.length === 0 ? (
            <FolderCog size={24} color={theme.colors.text} />
          ) : searchQuery.trim().length > 0 ? (
            <Search size={24} color={theme.colors.text} />
          ) : (
            <Boxes size={24} color={theme.colors.text} />
          )}
        </View>

        <ThemedText variant="bodyStrong" style={styles.emptyTitle}>
          {getEmptyTitle()}
        </ThemedText>

        <ThemedText color="secondary" style={styles.emptyText}>
          {getEmptyText()}
        </ThemedText>

        {showAddStorageAction && (
          <ThemedButton style={styles.emptyButton} onPress={handleAddStorageSpace}>
            <ThemedText style={styles.emptyButtonText}>
              Add Storage Space
            </ThemedText>
          </ThemedButton>
        )}
      </BlurView>
    );
  }

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <ThemedText
            variant="header"
            style={{ color: "#FFFFFF", marginBottom: 4 }}
          >
            {getHeaderTitle()}
          </ThemedText>

          <ThemedText
            color="secondary"
            style={{ color: "#FFFFFF", opacity: 0.8, marginBottom: 12 }}
          >
            {getHeaderSubtitle()}
          </ThemedText>

          <BlurView
            intensity={theme.isLight ? 18 : 22}
            tint={theme.isLight ? "light" : "dark"}
            style={[
              styles.searchCard,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <View style={styles.searchRow}>
              <Search size={18} color={theme.colors.textMuted} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search inventory..."
                placeholderTextColor={theme.colors.textMuted}
                style={[styles.searchInput, { color: theme.colors.text }]}
                editable={!initializing && !!user}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
              />
            </View>
          </BlurView>

          <View style={styles.summaryRow}>
            {renderFilterChip(
              "all",
              "All",
              allCount,
              <Boxes size={18} color={theme.colors.text} />
            )}
            {renderFilterChip(
              "packed",
              "Packed",
              packedCount,
              <CheckCircle2 size={18} color={theme.colors.text} />
            )}
            {renderFilterChip(
              "toPack",
              "To Pack",
              toPackCount,
              <AlertCircle size={18} color={theme.colors.text} />
            )}
          </View>

          <ThemedText
            variant="title"
            style={{ color: "#FFFFFF", marginBottom: 8 }}
          >
            {getListHeaderTitle()}
          </ThemedText>

          <FlatList
            data={filteredItems}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={renderEmptyState}
            renderItem={({ item }) => {
              const canOpenItem = !!item.vehicleId && !!item.compartmentId;

              return (
                <Pressable
                  onPress={() => handleOpenItem(item)}
                  disabled={!canOpenItem}
                >
                  <BlurView
                    intensity={theme.isLight ? 18 : 18}
                    tint={theme.isLight ? "light" : "dark"}
                    style={[
                      styles.itemCard,
                      {
                        backgroundColor: theme.colors.card,
                        borderColor: theme.colors.border,
                      },
                    ]}
                  >
                    <View style={styles.itemRow}>
                      <View style={{ flex: 1 }}>
                        <ThemedText variant="bodyStrong">{item.name}</ThemedText>

                        <ThemedText color="secondary">
                          {item.resolvedCompartmentName} •{" "}
                          {item.resolvedVehicleName}
                        </ThemedText>

                        <ThemedText
                          color={isPackedItem(item) ? "secondary" : "danger"}
                          style={styles.statusText}
                        >
                          {isPackedItem(item) ? "Packed" : "To Pack"} • Qty{" "}
                          {getItemQuantity(item)}
                        </ThemedText>
                      </View>

                      {canOpenItem && (
                        <ChevronRight
                          size={16}
                          color={theme.colors.textSecondary}
                        />
                      )}
                    </View>
                  </BlurView>
                </Pressable>
              );
            }}
          />
        </View>
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 16 },

  searchCard: {
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
  },

  summaryRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  filterPressable: {
    flex: 1,
  },
  filterChip: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 10,
    alignItems: "center",
  },

  listContent: {
    paddingBottom: 140,
  },

  itemCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusText: {
    marginTop: 4,
    fontWeight: "700",
  },

  emptyCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    alignItems: "center",
    marginTop: 4,
    overflow: "hidden",
  },
  emptyIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  emptyTitle: {
    marginBottom: 6,
    textAlign: "center",
  },
  emptyText: {
    textAlign: "center",
    lineHeight: 20,
  },
  emptyButton: {
    marginTop: 14,
    alignSelf: "stretch",
  },
  emptyButtonText: {
    color: "#fff",
    fontWeight: "700",
    textAlign: "center",
  },
});