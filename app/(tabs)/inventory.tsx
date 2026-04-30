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
import { ThemedText } from "../../components/ui/Themed";
import {
  getAllItems,
  getStorageSpaces,
  Item,
  StorageSpace,
} from "../../lib/gearService";
import { useTheme } from "../../lib/useTheme";

type StatusFilter = "all" | "packed" | "missing";

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

    if (incomingStatus === "packed" || incomingStatus === "missing") {
      setStatusFilter(incomingStatus);
      return;
    }

    setStatusFilter("all");
  }, [params.status]);

  useFocusEffect(
    useCallback(() => {
      if (initializing || !user) return;
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
        if (statusFilter === "missing") return !isPackedItem(item);
        return true;
      })
      .map((item) => ({
        ...item,
        resolvedVehicleName:
          item.vehicleName ||
          vehicleNameById.get(item.vehicleId ?? "") ||
          "No storage",
        resolvedCompartmentName: item.compartmentName || "No compartment",
      }));
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

  function getHeaderTitle() {
    if (statusFilter === "packed") return "Packed Items";
    if (statusFilter === "missing") return "Still To Pack";
    return "Inventory";
  }

  function getListHeaderTitle() {
    if (statusFilter === "packed") return "Packed Items";
    if (statusFilter === "missing") return "Still To Pack Items";
    return "Running Inventory";
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

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          
          {/* HEADER (WHITE ALWAYS) */}
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
            All items across your storage spaces
          </ThemedText>

          {/* SEARCH */}
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
              />
            </View>
          </BlurView>

          {/* FILTERS */}
          <View style={styles.summaryRow}>
            {renderFilterChip(
              "all",
              "All",
              inventoryItems.length,
              <Boxes size={18} color={theme.colors.text} />
            )}
            {renderFilterChip(
              "packed",
              "Packed",
              inventoryItems.filter(isPackedItem).length,
              <CheckCircle2 size={18} color={theme.colors.text} />
            )}
            {renderFilterChip(
              "missing",
              "To Pack",
              inventoryItems.filter((i) => !isPackedItem(i)).length,
              <AlertCircle size={18} color={theme.colors.text} />
            )}
          </View>

          {/* LIST HEADER (WHITE) */}
          <ThemedText
            variant="title"
            style={{ color: "#FFFFFF", marginBottom: 8 }}
          >
            {getListHeaderTitle()}
          </ThemedText>

          {/* LIST */}
          <FlatList
            data={filteredItems}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: 140 }}
            renderItem={({ item }) => (
              <Pressable
                onPress={() =>
                  router.push({
                    pathname:
                      "/vehicles/[vehicleId]/compartments/[compartmentId]",
                    params: {
                      vehicleId: item.vehicleId,
                      compartmentId: item.compartmentId,
                    },
                  })
                }
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
                      <ThemedText variant="bodyStrong">
                        {item.name}
                      </ThemedText>

                      <ThemedText color="secondary">
                        {item.resolvedCompartmentName} •{" "}
                        {item.resolvedVehicleName}
                      </ThemedText>
                    </View>

                    <ChevronRight
                      size={16}
                      color={theme.colors.textSecondary}
                    />
                  </View>
                </BlurView>
              </Pressable>
            )}
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
});