import { useFocusEffect } from "@react-navigation/native";
import { BlurView } from "expo-blur";
import { router, useLocalSearchParams } from "expo-router";
import {
  Boxes,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FolderCog,
  ListChecks,
  Search,
  X,
} from "lucide-react-native";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  FlatList,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../../components/auth/AuthProvider";
import HapticPressable from "../../components/ui/HapticPressable";
import KeyboardDismissAccessory from "../../components/ui/KeyboardDismissAccessory";
import ScreenBackground from "../../components/ui/ScreenBackground";
import { ThemedButton, ThemedText } from "../../components/ui/Themed";
const INVENTORY_SEARCH_KEYBOARD_ACCESSORY_ID =
  "inventory-search-keyboard-accessory";

import {
  getAllItems,
  getStorageSpaces,
  Item,
  StorageSpace,
} from "../../lib/gearService";
import { triggerSuccessHaptic } from "../../lib/haptics";
import { useDeviceLayout } from "../../lib/useDeviceLayout";
import { useInteractionLock } from "../../lib/useInteractionLock";
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
  const params = useLocalSearchParams<{ status?: string | string[] }>();
  const theme = useTheme();
  const { isTablet, isLandscape } = useDeviceLayout();
  const isTabletLandscape = isTablet && isLandscape;

  const isScreenMountedRef = useRef(true);
  const inventoryLoadVersionRef = useRef(0);

  const navigationTransitionLockedRef = useRef(false);
  const navigationUnlockTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);

  const {
    isLocked: interactionLocked,
    lock: lockInteraction,
    unlock: unlockInteraction,
  } = useInteractionLock(450);

  const [inventoryItems, setInventoryItems] = useState<Item[]>([]);
  const [storageSpaces, setStorageSpaces] = useState<StorageSpace[]>([]);
  const [selectedStorageId, setSelectedStorageId] = useState<string | null>(
    null
  );
  const [showStorageDropdown, setShowStorageDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  useEffect(() => {
    const rawStatus = Array.isArray(params.status)
      ? params.status[0]
      : params.status;

    const incomingStatus = String(rawStatus ?? "")
      .toLowerCase()
      .trim();

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

  useEffect(() => {
    isScreenMountedRef.current = true;

    return () => {
      isScreenMountedRef.current = false;
      inventoryLoadVersionRef.current += 1;

      if (navigationUnlockTimeoutRef.current) {
        clearTimeout(navigationUnlockTimeoutRef.current);
        navigationUnlockTimeoutRef.current = null;
      }
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      const loadVersion = inventoryLoadVersionRef.current + 1;
      inventoryLoadVersionRef.current = loadVersion;

      if (initializing) {
        return;
      }

      if (!user) {
        if (isScreenMountedRef.current) {
          setInventoryItems([]);
          setStorageSpaces([]);
          setSelectedStorageId(null);
          setShowStorageDropdown(false);
        }

        return;
      }

      void loadInventoryData(loadVersion);

      return () => {
        inventoryLoadVersionRef.current += 1;
      };
    }, [initializing, user])
  );

  async function runWithLock(action: () => Promise<void> | void) {
    if (interactionLocked) return;

    lockInteraction();

    try {
      await action();
    } finally {
      unlockInteraction();
    }
  }

  function lockNavigationTransition() {
    if (navigationTransitionLockedRef.current) {
      return false;
    }

    navigationTransitionLockedRef.current = true;

    if (navigationUnlockTimeoutRef.current) {
      clearTimeout(navigationUnlockTimeoutRef.current);
    }

    navigationUnlockTimeoutRef.current = setTimeout(() => {
      if (!isScreenMountedRef.current) return;

      navigationTransitionLockedRef.current = false;
      navigationUnlockTimeoutRef.current = null;
    }, 1500);

    return true;
  }

  function runNavigationAction(action: () => void) {
    if (interactionLocked || navigationTransitionLockedRef.current) {
      return;
    }

    const lockAcquired = lockNavigationTransition();

    if (!lockAcquired) {
      return;
    }

    action();
  }

  async function loadInventoryData(loadVersion: number) {
    if (!user) return;

    try {
      const [items, spaces] = await Promise.all([
        getAllItems(),
        getStorageSpaces(),
      ]);

      if (
        inventoryLoadVersionRef.current !== loadVersion ||
        !isScreenMountedRef.current
      ) {
        return;
      }

      setInventoryItems(items);
      setStorageSpaces(spaces);

      setSelectedStorageId((currentStorageId) => {
        if (
          currentStorageId &&
          spaces.some((space) => space.id === currentStorageId)
        ) {
          return currentStorageId;
        }

        return spaces[0]?.id ?? null;
      });
    } catch {
      if (
        inventoryLoadVersionRef.current !== loadVersion ||
        !isScreenMountedRef.current
      ) {
        return;
      }

      setInventoryItems([]);
      setStorageSpaces([]);
      setSelectedStorageId(null);
      setShowStorageDropdown(false);
    }
  }

  const sortedStorageSpaces = useMemo(() => {
    return [...storageSpaces].sort((a, b) => {
      const aName = String(a.name ?? "").trim().toLowerCase();
      const bName = String(b.name ?? "").trim().toLowerCase();

      return aName.localeCompare(bName);
    });
  }, [storageSpaces]);

  const selectedStorage = useMemo(() => {
    return storageSpaces.find((space) => space.id === selectedStorageId) ?? null;
  }, [storageSpaces, selectedStorageId]);

  const vehicleNameById = useMemo(() => {
    return new Map(storageSpaces.map((s) => [s.id, s.name]));
  }, [storageSpaces]);

  const scopedInventoryItems = useMemo(() => {
    if (!selectedStorageId) {
      return inventoryItems;
    }

    return inventoryItems.filter((item) => item.vehicleId === selectedStorageId);
  }, [inventoryItems, selectedStorageId]);

  const allDisplayItems = useMemo(() => {
    const baseItems =
      searchQuery.trim().length > 0 ? inventoryItems : scopedInventoryItems;

    return baseItems
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
  }, [inventoryItems, scopedInventoryItems, searchQuery, statusFilter, vehicleNameById]);

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

  const allCount = scopedInventoryItems.length;

  const packedCount = scopedInventoryItems.filter(isPackedItem).length;

  const toPackCount = scopedInventoryItems.filter(
    (item) => !isPackedItem(item)
  ).length;

  function getHeaderTitle() {
    if (statusFilter === "packed") return "Packed Items";
    if (statusFilter === "toPack") return "Still To Pack";
    return "Inventory";
  }

  function getHeaderSubtitlePrefix() {
    if (statusFilter === "packed") {
      return "Items currently marked as packed in";
    }

    if (statusFilter === "toPack") {
      return "Items still waiting to be packed in";
    }

    return "Running inventory for";
  }

  function getHeaderSubtitleScope() {
    return selectedStorage?.name ?? "your storage spaces";
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

    if (scopedInventoryItems.length === 0 && selectedStorage) {
      return "No items in this storage space";
    }

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

    if (scopedInventoryItems.length === 0 && selectedStorage) {
      return "This storage space does not have inventory items yet. Add compartments and items to build its running inventory.";
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
    runNavigationAction(() => {
      void runWithLock(async () => {
        await triggerSuccessHaptic();

        if (!isScreenMountedRef.current) {
          return;
        }

        router.push({
          pathname: "/(tabs)/storage/create",
        });
      });
    });
  }

  function handleManageStorageSpaces() {
    runNavigationAction(() => {
      router.push({
        pathname: "/(tabs)/storage",
      });
    });
  }

  function handleToggleStorageDropdown() {
    if (interactionLocked || navigationTransitionLockedRef.current) {
      return;
    }

    setShowStorageDropdown((currentValue) => !currentValue);
  }

  function handleSelectStorageSpace(spaceId: string) {
    if (interactionLocked || navigationTransitionLockedRef.current) {
      return;
    }

    setSelectedStorageId(spaceId);
    setShowStorageDropdown(false);
  }

  function handleOpenItem(item: Item) {
    if (!item.vehicleId || !item.compartmentId) {
      return;
    }

    runNavigationAction(() => {
      router.push({
        pathname: "/vehicles/[vehicleId]/compartments/[compartmentId]",
        params: {
          vehicleId: item.vehicleId,
          compartmentId: item.compartmentId,
        },
      });
    });
  }


  function renderFilterChip(
    value: StatusFilter,
    label: string,
    count: number,
    icon: React.ReactNode
  ) {
    const selected = statusFilter === value;

    const tone =
      value === "packed"
        ? {
          borderColor: "rgba(34,197,94,0.95)",
          backgroundColor: "rgba(34,197,94,0.24)",
          textColor: "rgb(34,197,94)",
        }
        : value === "toPack"
          ? {
            borderColor: "rgba(255,76,76,0.98)",
            backgroundColor: "rgba(120,20,32,0.34)",
            textColor: "rgb(255,110,110)",
          }
          : {
            borderColor: "rgba(59,130,246,0.95)",
            backgroundColor: "rgba(37,99,235,0.28)",
            textColor: "rgb(59,130,246)",
          };

    const unselectedBg = theme.isLight
      ? "#FFFFFF"
      : "rgba(15,23,42,0.34)";

    const unselectedText = theme.isLight
      ? "#000000"
      : theme.colors.text;

    const textColor = selected ? "#FFFFFF" : unselectedText;

    return (
      <HapticPressable
        style={[
          styles.filterPressable,
          (interactionLocked || navigationTransitionLockedRef.current) &&
          styles.disabledInteraction,
        ]}
        onPress={() => setStatusFilter(value)}
        disabled={interactionLocked || navigationTransitionLockedRef.current}
      >
        <View
          style={[
            styles.filterChip,
            {
              backgroundColor: selected
                ? tone.backgroundColor
                : unselectedBg,

              borderColor: selected
                ? tone.borderColor
                : theme.colors.border,
            },
          ]}
        >
          {React.cloneElement(icon as any, {
            size: 22,
            color: selected ? tone.textColor : unselectedText
          })}

          <Text style={[styles.filterChipCount, { color: textColor }]}>
            {count}
          </Text>

          <Text style={[styles.filterChipText, { color: textColor }]}>
            {label}
          </Text>
        </View>
      </HapticPressable>
    );
  }


  function renderEmptyState() {
    const showAddStorageAction =
      !!user && inventoryItems.length === 0 && searchQuery.trim().length === 0;

    return (
      < BlurView
        intensity={theme.isLight ? 18 : 18}
        tint={theme.isLight ? "light" : "dark"}
        style={
          [
            styles.manageStorageCard,
            {
              backgroundColor: theme.isLight
                ? theme.colors.card
                : "rgba(255,255,255,0.20)",
              borderColor: theme.isLight
                ? theme.colors.border
                : "rgba(255,255,255,0.12)",
            },
          ]}
      >
        <View
          style={[
            styles.emptyIconWrap,
            {
              backgroundColor: theme.colors.iconSurface,
              borderColor: theme.colors.border,
            },
          ]}
        >
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

        {
          showAddStorageAction && (
            <ThemedButton
              style={styles.emptyButton}
              onPress={handleAddStorageSpace}
              disabled={interactionLocked || navigationTransitionLockedRef.current}
            >
              <ThemedText style={styles.emptyButtonText}>
                Add Storage Space
              </ThemedText>
            </ThemedButton>
          )
        }
      </BlurView >
    );
  }

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe}>
        <View
          style={[
            styles.container,
            isTablet && {
              maxWidth: isLandscape ? 1100 : 900,
              width: "100%",
              alignSelf: "center",
            },
          ]}
        >
          <ThemedText
            variant="header"
            style={{ color: "#FFFFFF", marginBottom: 4 }}
          >
            {getHeaderTitle()}
          </ThemedText>

          <View style={styles.headerSubtitleRow}>
            <ThemedText
              color="secondary"
              style={styles.headerSubtitleText}
            >
              {getHeaderSubtitlePrefix()}{" "}
            </ThemedText>

            <ThemedText style={styles.headerSubtitleScope}>
              {getHeaderSubtitleScope()}.
            </ThemedText>
          </View>

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
                selectionColor={theme.isLight ? "#2563EB" : "#93C5FD"}
                style={[styles.searchInput, { color: theme.colors.text }]}
                editable={
                  !initializing &&
                  !!user &&
                  !interactionLocked &&
                  !navigationTransitionLockedRef.current
                }
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                inputAccessoryViewID={undefined}
              />

              {searchQuery.length > 0 && (
                <HapticPressable
                  style={[
                    styles.clearSearchButton,
                    (interactionLocked || navigationTransitionLockedRef.current) &&
                    styles.disabledInteraction,
                  ]}
                  onPress={() => setSearchQuery("")}
                  disabled={interactionLocked || navigationTransitionLockedRef.current}
                  hitSlop={10}
                >
                  <X size={16} color={theme.colors.textSecondary} />
                </HapticPressable>
              )}
            </View>
          </BlurView>


          <View
            style={[
              styles.inventoryMainLayout,
              isTabletLandscape && styles.inventoryTabletLandscapeLayout,
            ]}
          >
            <View
              style={isTabletLandscape ? styles.inventoryTabletLeftColumn : undefined}
            >
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
                  <ListChecks size={18} color={theme.colors.text} />
                )}
              </View>

              <View style={styles.storageSelectorWrap}>
                <HapticPressable
                  style={[
                    styles.storageSelectorPressable,
                    (interactionLocked || navigationTransitionLockedRef.current) &&
                    styles.disabledInteraction,
                  ]}
                  onPress={handleToggleStorageDropdown}
                  disabled={
                    interactionLocked ||
                    navigationTransitionLockedRef.current ||
                    storageSpaces.length === 0
                  }
                >
                  <BlurView
                    intensity={theme.isLight ? 18 : 22}
                    tint={theme.isLight ? "light" : "dark"}
                    style={[
                      styles.storageSelectorCard,
                      {
                        backgroundColor: theme.colors.card,
                        borderColor: theme.colors.border,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.storageSelectorIconWrap,
                        {
                          backgroundColor: theme.isLight
                            ? "rgba(0,0,0,0.10)"
                            : "rgba(255,255,255,0.10)",
                          borderWidth: 1,
                          borderColor: theme.isLight
                            ? "rgba(0,0,0,0.08)"
                            : "rgba(255,255,255,0.12)",
                        },
                      ]}
                    >
                      <Boxes
                        size={18}
                        color={theme.isLight ? "#000000" : "#FFFFFF"}
                      />
                    </View>

                    <View style={styles.storageSelectorTextWrap}>
                      <ThemedText
                        variant="bodyStrong"
                        style={styles.storageSelectorTitle}
                      >
                        Select Storage Space
                      </ThemedText>

                      <ThemedText
                        style={styles.storageSelectorSelectedText}
                        numberOfLines={1}
                      >
                        {selectedStorage?.name ?? "No storage spaces found"}
                      </ThemedText>
                    </View>

                    <ChevronDown size={18} color={theme.colors.primary} />
                  </BlurView>
                </HapticPressable>

                {showStorageDropdown && (
                  <BlurView
                    intensity={theme.isLight ? 18 : 22}
                    tint={theme.isLight ? "light" : "dark"}
                    style={[
                      styles.storageDropdownCard,
                      {
                        backgroundColor: theme.colors.card,
                        borderColor: theme.colors.border,
                      },
                    ]}
                  >
                    <ScrollView
                      showsVerticalScrollIndicator
                      nestedScrollEnabled
                      keyboardShouldPersistTaps="handled"
                    >
                      {sortedStorageSpaces.map((space, index) => (
                        <HapticPressable
                          key={space.id}
                          style={[
                            styles.storageDropdownRow,
                            { borderBottomColor: theme.colors.border },
                            index === sortedStorageSpaces.length - 1 &&
                            styles.storageDropdownRowLast,
                          ]}
                          onPress={() => handleSelectStorageSpace(space.id)}
                          disabled={
                            interactionLocked || navigationTransitionLockedRef.current
                          }
                        >
                          <View style={styles.storageDropdownRowTextWrap}>
                            <ThemedText variant="bodyStrong">{space.name}</ThemedText>

                            <ThemedText
                              color="secondary"
                              style={styles.storageDropdownMeta}
                            >
                              {space.category === "vehicle" ? "Vehicle" : "Storage"}
                              {space.subtype ? ` • ${space.subtype}` : ""}
                            </ThemedText>
                          </View>

                          {space.id === selectedStorageId && (
                            <CheckCircle2 size={18} color={theme.colors.primary} />
                          )}
                        </HapticPressable>
                      ))}
                    </ScrollView>
                  </BlurView>
                )}
              </View>

              <HapticPressable
                style={[
                  styles.manageStoragePressable,
                  (interactionLocked || navigationTransitionLockedRef.current) &&
                  styles.disabledInteraction,
                ]}
                onPress={handleManageStorageSpaces}
                disabled={interactionLocked || navigationTransitionLockedRef.current}
              >
                <BlurView
                  intensity={theme.isLight ? 18 : 22}
                  tint={theme.isLight ? "light" : "dark"}
                  style={[
                    styles.manageStorageCard,
                    {
                      backgroundColor: theme.colors.card,
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  <View style={styles.manageStorageIconWrap}>
                    <FolderCog
                      size={22}
                      color={theme.isLight ? "#000000" : "#FFFFFF"}
                    />
                  </View>

                  <View style={styles.manageStorageTextWrap}>
                    <ThemedText
                      variant="bodyStrong"
                      style={styles.manageStorageTitle}
                    >
                      Manage Storage Spaces
                    </ThemedText>

                    <ThemedText color="secondary" style={styles.manageStorageText}>
                      Edit names, update subtypes, or remove storage spaces.
                    </ThemedText>
                  </View>

                  <ChevronRight size={18} color={theme.colors.primary} />
                </BlurView>
              </HapticPressable>

            </View>

            <View
              style={[
                styles.inventoryListColumn,
                isTabletLandscape && styles.inventoryTabletRightColumn,
              ]}
            >
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

                  const itemDisabled =
                    !canOpenItem ||
                    interactionLocked ||
                    navigationTransitionLockedRef.current;

                  return (
                    <HapticPressable
                      onPress={() => handleOpenItem(item)}
                      disabled={itemDisabled}
                      style={itemDisabled && styles.disabledInteraction}
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

                            <ThemedText
                              color={isPackedItem(item) ? "secondary" : "danger"}
                              style={styles.statusText}
                            >
                              {isPackedItem(item) ? "Packed" : "To Pack"} • Qty{" "}
                              {getItemQuantity(item)}
                            </ThemedText>

                            <ThemedText color="secondary">
                              Storage: {item.resolvedCompartmentName}
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
                    </HapticPressable>
                  );
                }}
              />
            </View>
          </View>
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
  },

  inventoryMainLayout: {
    flex: 1,
  },

  inventoryTabletLandscapeLayout: {
    flexDirection: "row",
    gap: 16,
    alignItems: "flex-start",
  },

  inventoryTabletLeftColumn: {
    flex: 1,
    minWidth: 0,
  },

  inventoryListColumn: {
    flex: 1,
    minWidth: 0,
  },

  inventoryTabletRightColumn: {
    flex: 1,
    minWidth: 0,
  },

  headerSubtitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },

  headerSubtitleText: {
    color: "#FFFFFF",
    opacity: 0.8,
  },

  headerSubtitleScope: {
    color: "rgb(59,130,246)",
    fontWeight: "700",
  },

  searchCard: {
    borderRadius: 22,
    borderWidth: 1,
    marginBottom: 12,
    overflow: "hidden",
  },

  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 13,
  },

  searchInput: {
    flex: 1,
    marginLeft: 10,
  },

  clearSearchButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
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
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    minHeight: 72,
  },

  filterChipCount: {
    fontSize: 15,
    fontWeight: "800",
    marginTop: 2,
    lineHeight: 20,
  },

  filterChipText: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 0,
  },

  filterChipSelectedValue: {
    color: "#FFFFFF",
    fontWeight: "800",
  },

  storageSelectorWrap: {
    marginBottom: 10,
    zIndex: 50,
  },

  storageSelectorPressable: {
    borderRadius: 16,
    overflow: "hidden",
  },

  storageSelectorCard: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },

  storageSelectorIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  storageSelectorTextWrap: {
    flex: 1,
    paddingRight: 10,
  },

  storageSelectorTitle: {
    marginBottom: 3,
  },

  storageSelectorText: {
    lineHeight: 18,
  },

  storageSelectorSelectedText: {
    color: "rgb(59,130,246)",
    fontWeight: "800",
    lineHeight: 18,
  },

  storageDropdownCard: {
    marginTop: 8,
    maxHeight: 240,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },

  storageDropdownRow: {
    minHeight: 58,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
  },

  storageDropdownRowLast: {
    borderBottomWidth: 0,
  },

  storageDropdownRowTextWrap: {
    flex: 1,
    paddingRight: 10,
  },

  storageDropdownMeta: {
    marginTop: 2,
  },

  manageStoragePressable: {
    borderRadius: 16,
    marginBottom: 14,
    overflow: "hidden",
  },

  manageStorageCard: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },

  manageStorageIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },

  manageStorageTextWrap: {
    flex: 1,
    paddingRight: 10,
  },

  manageStorageTitle: {
    marginBottom: 3,
  },

  manageStorageText: {
    lineHeight: 18,
  },

  listContent: {
    paddingBottom: 140,
  },

  itemCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
    overflow: "hidden",
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
    borderWidth: 1,
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

  disabledInteraction: {
    opacity: 0.6,
  },
});