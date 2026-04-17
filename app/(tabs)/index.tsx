import React, { useCallback, useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
 TextInput,
  Pressable,
  Modal,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  MapPin,
  UserCircle2,
  Search,
  ChevronRight,
  ChevronDown,
  User,
  Settings,
  Lock,
  X,
  Box,
  CheckCircle2,
  AlertCircle,
} from "lucide-react-native";
import { router, useFocusEffect } from "expo-router";
import { BlurView } from "expo-blur";

import ScreenBackground from "../../components/ui/ScreenBackground";
import { colors } from "../../theme/tokens";
import {
  getStorageSpaces,
  getCompartments,
  getAllItems,
  searchItemsForUser,
  StorageSpace,
  Compartment,
  Item,
} from "../../lib/gearService";
import { getProfileSettings } from "../../lib/settingsService";

const DEMO_USER_ID = "demo-user-123";

type SearchResultItem = {
  id: string;
  name: string;
  compartmentId: string;
  compartmentName: string;
  vehicleId: string;
  vehicleName: string;
  missing?: boolean;
  packed?: boolean;
};

type QuickCompartment = {
  id: string;
  name: string;
  itemCount: number;
};

type ProfileMenuRowProps = {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onPress: () => void;
};

function FrostedCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: any;
}) {
  return (
    <BlurView intensity={35} tint="dark" style={[styles.frostedCard, style]}>
      {children}
    </BlurView>
  );
}

function ProfileMenuRow({
  icon,
  title,
  subtitle,
  onPress,
}: ProfileMenuRowProps) {
  return (
    <Pressable style={styles.menuRow} onPress={onPress}>
      <View style={styles.menuRowLeft}>
        <View style={styles.menuIconWrap}>{icon}</View>
        <View style={styles.menuTextWrap}>
          <Text style={styles.menuTitle}>{title}</Text>
          <Text style={styles.menuSubtitle}>{subtitle}</Text>
        </View>
      </View>
      <ChevronRight size={18} color={colors.textSecondary} />
    </Pressable>
  );
}

function StatCard({
  icon,
  value,
  label,
  onPress,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.statPressable} onPress={onPress}>
      <BlurView intensity={35} tint="dark" style={styles.statCard}>
        <View style={styles.statIconWrap}>{icon}</View>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </BlurView>
    </Pressable>
  );
}

export default function DashboardScreen() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [storageSpaces, setStorageSpaces] = useState<StorageSpace[]>([]);
  const [selectedStorageId, setSelectedStorageId] = useState<string | null>(null);
  const [showStorageDropdown, setShowStorageDropdown] = useState(false);

  const [allItems, setAllItems] = useState<Item[]>([]);
  const [selectedCompartments, setSelectedCompartments] = useState<Compartment[]>([]);
  const [quickCompartments, setQuickCompartments] = useState<QuickCompartment[]>([]);

  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [profilePhotoUri, setProfilePhotoUri] = useState("");

  const selectedStorage = useMemo(
    () => storageSpaces.find((space) => space.id === selectedStorageId) ?? null,
    [storageSpaces, selectedStorageId]
  );

  const storageItems = useMemo(
    () => allItems.filter((item) => item.vehicleId === selectedStorageId),
    [allItems, selectedStorageId]
  );

  const packedCount = useMemo(
    () => storageItems.filter((item) => item.status === "packed").length,
    [storageItems]
  );

  const missingCount = useMemo(
    () => storageItems.filter((item) => item.status === "missing").length,
    [storageItems]
  );

  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
      loadProfilePhoto();
    }, [])
  );

  async function loadProfilePhoto() {
    try {
      const profile = await getProfileSettings();
      setProfilePhotoUri(profile.profilePhotoUri ?? "");
    } catch (err) {
      console.error("Failed to load profile photo:", err);
      setProfilePhotoUri("");
    }
  }

  async function loadDashboardData() {
    try {
      const spaces = await getStorageSpaces();
      setStorageSpaces(spaces);

      const chosenId =
        selectedStorageId && spaces.some((space) => space.id === selectedStorageId)
          ? selectedStorageId
          : spaces[0]?.id ?? null;

      setSelectedStorageId(chosenId);

      const items = await getAllItems();
      setAllItems(items);

      if (!chosenId) {
        setSelectedCompartments([]);
        setQuickCompartments([]);
        return;
      }

      const compartments = await getCompartments(chosenId);
      setSelectedCompartments(compartments);

      const quickData = compartments
        .map((compartment) => ({
          id: compartment.id,
          name: compartment.name,
          itemCount: items.filter((item) => item.compartmentId === compartment.id).length,
        }))
        .sort((a, b) => b.itemCount - a.itemCount || a.name.localeCompare(b.name))
        .slice(0, 4);

      setQuickCompartments(quickData);
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
      setStorageSpaces([]);
      setSelectedStorageId(null);
      setAllItems([]);
      setSelectedCompartments([]);
      setQuickCompartments([]);
    }
  }

  async function handleSelectStorage(space: StorageSpace) {
    try {
      setSelectedStorageId(space.id);
      setShowStorageDropdown(false);

      const compartments = await getCompartments(space.id);
      setSelectedCompartments(compartments);

      const quickData = compartments
        .map((compartment) => ({
          id: compartment.id,
          name: compartment.name,
          itemCount: allItems.filter((item) => item.compartmentId === compartment.id).length,
        }))
        .sort((a, b) => b.itemCount - a.itemCount || a.name.localeCompare(b.name))
        .slice(0, 4);

      setQuickCompartments(quickData);
    } catch (err) {
      console.error("Failed to switch storage space:", err);
    }
  }

  React.useEffect(() => {
    const runSearch = async () => {
      const trimmed = searchQuery.trim();

      if (!trimmed) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      try {
        setIsSearching(true);
        const results = await searchItemsForUser(DEMO_USER_ID, trimmed);
        setSearchResults(results);
      } catch (error) {
        console.error("Search failed:", error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    const timeout = setTimeout(runSearch, 250);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  function handleSearchResultPress(item: SearchResultItem) {
    router.push({
      pathname: "/vehicles/[vehicleId]/compartments/[compartmentId]",
      params: {
        vehicleId: item.vehicleId,
        compartmentId: item.compartmentId,
      },
    });
  }

  function handleOpenInventory() {
    router.navigate("/inventory");
  }

  function handleOpenPackedItems() {
    setShowProfileMenu(false);
    router.push({
      pathname: "/items",
      params: { status: "packed" },
    });
  }

  function handleOpenMissingItems() {
    setShowProfileMenu(false);
    router.push({
      pathname: "/items",
      params: { status: "missing" },
    });
  }

  function handleOpenCompartment(compartmentId: string) {
    if (!selectedStorageId) return;

    router.push({
      pathname: "/vehicles/[vehicleId]/compartments/[compartmentId]",
      params: {
        vehicleId: selectedStorageId,
        compartmentId,
      },
    });
  }

  function handleOpenProfile() {
    setShowProfileMenu(false);
    router.push("/profile-settings");
  }

  function handleOpenSettings() {
    setShowProfileMenu(false);
    router.push("/settings");
  }

  function handleOpenPasswordManagement() {
    setShowProfileMenu(false);
    router.push("/password-management");
  }

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe}>
        <Modal
          visible={showProfileMenu}
          transparent
          animationType="fade"
          onRequestClose={() => setShowProfileMenu(false)}
        >
          <Pressable
            style={styles.menuOverlay}
            onPress={() => setShowProfileMenu(false)}
          >
            <BlurView intensity={35} tint="dark" style={styles.menuCard}>
              <View style={styles.menuHeader}>
                <Text style={styles.menuHeaderTitle}>Account Menu</Text>
                <Pressable
                  style={styles.menuCloseButton}
                  onPress={() => setShowProfileMenu(false)}
                >
                  <X size={18} color={colors.text} />
                </Pressable>
              </View>

              <ProfileMenuRow
                icon={<User size={18} color={colors.text} />}
                title="Profile"
                subtitle="Account basics and profile details"
                onPress={handleOpenProfile}
              />

              <ProfileMenuRow
                icon={<Settings size={18} color={colors.text} />}
                title="Settings"
                subtitle="App and account settings"
                onPress={handleOpenSettings}
              />

              <ProfileMenuRow
                icon={<Lock size={18} color={colors.text} />}
                title="Password Management"
                subtitle="Update password and security settings"
                onPress={handleOpenPasswordManagement}
              />
            </BlurView>
          </Pressable>
        </Modal>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.headerRow}>
            <View style={styles.brandRow}>
              <MapPin size={22} color={colors.text} />
              <Text style={styles.brandText}>Where&apos;s My Gear</Text>
            </View>

            <Pressable
              onPress={() => setShowProfileMenu(true)}
              style={styles.profileButton}
            >
              {profilePhotoUri ? (
                <Image source={{ uri: profilePhotoUri }} style={styles.profileAvatar} />
              ) : (
                <UserCircle2 size={30} color={colors.text} />
              )}
            </Pressable>
          </View>

          <FrostedCard style={styles.searchCard}>
            <View style={styles.searchInputWrap}>
              <Search size={20} color={colors.textMuted} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search gear..."
                placeholderTextColor={colors.textMuted}
                style={styles.searchInput}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
              />
            </View>
          </FrostedCard>

          {searchQuery.trim().length > 0 && (
            <View style={styles.searchResultsWrap}>
              <Text style={styles.sectionTitle}>
                {isSearching ? "Searching..." : "Results"}
              </Text>

              {!isSearching && searchResults.length === 0 ? (
                <FrostedCard style={styles.emptyCard}>
                  <Text style={styles.emptyText}>No items found</Text>
                </FrostedCard>
              ) : (
                searchResults.map((item) => (
                  <FrostedCard
                    key={`${item.vehicleId}:${item.compartmentId}:${item.id}`}
                    style={styles.searchResultCard}
                  >
                    <Pressable onPress={() => handleSearchResultPress(item)}>
                      <Text style={styles.searchTitle}>{item.name}</Text>
                      <Text style={styles.searchLocation}>
                        {item.compartmentName} • {item.vehicleName}
                      </Text>
                      <Text
                        style={[
                          styles.searchStatus,
                          item.missing ? styles.missing : styles.packed,
                        ]}
                      >
                        {item.missing ? "Missing" : "Packed"}
                      </Text>
                    </Pressable>
                  </FrostedCard>
                ))
              )}
            </View>
          )}

          <View style={styles.selectorWrap}>
            <Text style={styles.selectorLabel}>Selected Storage Space</Text>

            <Pressable
              style={styles.selectorPressable}
              onPress={() => setShowStorageDropdown((prev) => !prev)}
            >
              <BlurView intensity={35} tint="dark" style={styles.selectorButton}>
                <Text style={styles.selectorButtonText}>
                  {selectedStorage?.name ?? "Select a storage space"}
                </Text>
                <ChevronDown size={18} color={colors.textSecondary} />
              </BlurView>
            </Pressable>

            {showStorageDropdown && (
              <BlurView intensity={35} tint="dark" style={styles.dropdownCard}>
                {storageSpaces.length === 0 ? (
                  <Text style={styles.dropdownEmpty}>No storage spaces found.</Text>
                ) : (
                  storageSpaces.map((space) => (
                    <Pressable
                      key={space.id}
                      style={styles.dropdownRow}
                      onPress={() => handleSelectStorage(space)}
                    >
                      <View style={styles.dropdownRowLeft}>
                        <Text style={styles.dropdownRowTitle}>{space.name}</Text>
                        <Text style={styles.dropdownRowMeta}>
                          {space.category === "vehicle" ? "Vehicle" : "Storage"} • {space.subtype}
                        </Text>
                      </View>
                    </Pressable>
                  ))
                )}
              </BlurView>
            )}
          </View>

          <View style={styles.statsRow}>
            <StatCard
              icon={<Box size={24} color={colors.text} />}
              value={selectedCompartments.length}
              label="Compartments"
              onPress={handleOpenInventory}
            />

            <StatCard
              icon={<CheckCircle2 size={24} color={colors.text} />}
              value={packedCount}
              label="Items Packed"
              onPress={handleOpenPackedItems}
            />

            <StatCard
              icon={<AlertCircle size={24} color={colors.text} />}
              value={missingCount}
              label="Items Missing"
              onPress={handleOpenMissingItems}
            />
          </View>

          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeaderTitle}>Compartment Quick View</Text>
            <Pressable onPress={handleOpenInventory}>
              <Text style={styles.viewAllText}>View All</Text>
            </Pressable>
          </View>

          {selectedStorageId == null ? (
            <FrostedCard style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No storage space selected</Text>
              <Text style={styles.emptyText}>
                Add a storage space in Inventory to start tracking gear.
              </Text>
            </FrostedCard>
          ) : quickCompartments.length === 0 ? (
            <FrostedCard style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No compartments yet</Text>
              <Text style={styles.emptyText}>
                Create compartments inside this storage space to see them here.
              </Text>
            </FrostedCard>
          ) : (
            quickCompartments.map((compartment) => (
              <FrostedCard key={compartment.id} style={styles.quickCard}>
                <Pressable
                  style={styles.quickRow}
                  onPress={() => handleOpenCompartment(compartment.id)}
                >
                  <View style={styles.quickLeft}>
                    <Text style={styles.quickTitle}>{compartment.name}</Text>
                    <Text style={styles.quickMeta}>
                      {compartment.itemCount} {compartment.itemCount === 1 ? "item" : "items"}
                    </Text>
                  </View>
                  <ChevronRight size={18} color={colors.textSecondary} />
                </Pressable>
              </FrostedCard>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "transparent",
  },
  content: {
    padding: 16,
    paddingBottom: 140,
  },

  frostedCard: {
    overflow: "hidden",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.03)",
  },

  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  brandText: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "700",
  },
  profileButton: {
    padding: 4,
  },
  profileAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },

  menuOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    paddingTop: 70,
    paddingHorizontal: 16,
    alignItems: "flex-end",
  },
  menuCard: {
    width: "88%",
    maxWidth: 360,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    overflow: "hidden",
    padding: 14,
  },
  menuHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  menuHeaderTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "700",
  },
  menuCloseButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  menuRow: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  menuRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    paddingRight: 10,
  },
  menuIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    marginRight: 12,
  },
  menuTextWrap: {
    flex: 1,
  },
  menuTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 3,
  },
  menuSubtitle: {
    color: colors.textSecondary,
    fontSize: 13,
  },

  searchCard: {
    marginBottom: 12,
  },
  searchInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    marginLeft: 10,
  },

  searchResultsWrap: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 10,
  },
  searchResultCard: {
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  searchTitle: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 18,
    marginBottom: 4,
  },
  searchLocation: {
    color: colors.textMuted,
    fontSize: 14,
    marginBottom: 8,
  },
  searchStatus: {
    fontSize: 14,
    fontWeight: "700",
  },
  packed: {
    color: colors.success,
  },
  missing: {
    color: colors.danger,
  },

  selectorWrap: {
    marginBottom: 16,
  },
  selectorLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 6,
  },
  selectorPressable: {
    borderRadius: 14,
  },
  selectorButton: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    overflow: "hidden",
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  selectorButtonText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
    flex: 1,
    paddingRight: 10,
  },
  dropdownCard: {
    marginTop: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    overflow: "hidden",
  },
  dropdownEmpty: {
    color: colors.textSecondary,
    padding: 14,
  },
  dropdownRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  dropdownRowLeft: {
    flex: 1,
  },
  dropdownRowTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 2,
  },
  dropdownRowMeta: {
    color: colors.textSecondary,
    fontSize: 13,
  },

  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 18,
  },
  statPressable: {
    flex: 1,
    borderRadius: 18,
  },
  statCard: {
    minHeight: 138,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    padding: 14,
    justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  statIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  statValue: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "800",
    marginTop: 16,
  },
  statLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 18,
    marginTop: 6,
  },

  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sectionHeaderTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
  viewAllText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: "600",
  },

  emptyCard: {
    marginBottom: 20,
    padding: 16,
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
  },

  quickCard: {
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  quickRow: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  quickLeft: {
    flex: 1,
    paddingRight: 10,
  },
  quickTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 4,
  },
  quickMeta: {
    color: colors.textSecondary,
    fontSize: 14,
  },
});