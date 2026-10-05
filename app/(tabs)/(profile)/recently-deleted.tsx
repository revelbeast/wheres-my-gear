import NetInfo from "@react-native-community/netinfo";
import { useFocusEffect } from "expo-router";
import { Image as ImageIcon } from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Image, Modal, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../../components/auth/AuthProvider";
import AppHeader from "../../../components/ui/AppHeader";
import HapticPressable from "../../../components/ui/HapticPressable";
import ScreenBackground from "../../../components/ui/ScreenBackground";
import { ThemedButton, ThemedCard, ThemedText, useThemedValues } from "../../../components/ui/Themed";
import { getDeletedItems, restoreDeletedItem, permanentlyDeleteDeletedItem, getStorageSpaces, getCompartmentsByVehicle, getRoomsByStorageSpace, type StorageSpace, type RestoreDestination, type Item } from "../../../lib/gearService";

function deletionTime(value: unknown): number | null {
  try {
    let time: number;
    if (typeof value === "string") time = Date.parse(value);
    else if (value instanceof Date) time = value.getTime();
    else if (value && typeof value === "object") {
      const stamp = value as { toMillis?: () => number; seconds?: number; nanoseconds?: number };
      if (typeof stamp.toMillis === "function") time = stamp.toMillis();
      else if (typeof stamp.seconds === "number") time = stamp.seconds * 1000 + (stamp.nanoseconds ?? 0) / 1e6;
      else return null;
    } else return null;
    return Number.isFinite(time) && !Number.isNaN(new Date(time).getTime()) ? time : null;
  } catch { return null; }
}

function sortedDeletedItems(items: Item[]): Item[] {
  return items.filter(item => item.isDeleted === true).sort((a, b) => {
    const left = deletionTime(a.deletedAt);
    const right = deletionTime(b.deletedAt);
    if (left !== right) {
      if (left === null) return 1;
      if (right === null) return -1;
      return right - left;
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

function originalLocation(item: Item): string {
  const location = item.deletedLocation;
  if (!location) return "Original location unavailable";
  return [location.vehicleName, location.roomName, location.compartmentName]
    .filter(value => typeof value === "string" && value.trim()).join(" → ") || "Original location unavailable";
}

function DeletedPhoto({ item }: { item: Item }) {
  const theme = useThemedValues();
  const [failed, setFailed] = useState<string[]>([]);
  const uri = [item.itemPhotoUri, item.itemPhotoDownloadUrl].find(value =>
    typeof value === "string" && /^(file:|content:|https?:)/.test(value) && !failed.includes(value));
  return uri ? <Image source={{ uri }} style={styles.photo} onError={() => setFailed(previous => [...previous, uri])} />
    : <View style={styles.photo}><ImageIcon size={28} color={theme.colors.textSecondary} /></View>;
}

type DestinationOption = RestoreDestination & { label: string };

function permanentId(id: unknown): id is string {
  return typeof id === "string" && id.trim().length > 0 && !id.startsWith("offline-") && !id.includes("/");
}

export default function RecentlyDeletedScreen() {
  const { user } = useAuth();
  const theme = useThemedValues();
  const version = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const restoringIds = useRef(new Set<string>());
  const [deleting, setDeleting] = useState<string[]>([]);
  const [restoring, setRestoring] = useState<string[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [offline, setOffline] = useState<boolean | null>(null);
  const [retry, setRetry] = useState(0);
  const pickerVersion = useRef(0);
  const [pickerItem, setPickerItem] = useState<Item | null>(null);
  const [spaces, setSpaces] = useState<StorageSpace[]>([]);
  const [options, setOptions] = useState<DestinationOption[]>([]);
  const [selectedStorage, setSelectedStorage] = useState("");
  const [selection, setSelection] = useState<DestinationOption | null>(null);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerMessage, setPickerMessage] = useState("");


  useFocusEffect(useCallback(() => {
    let active = true;
    const request = ++version.current;
    const current = () => active && request === version.current;
    pickerVersion.current += 1;
    setPickerItem(null);
    setLoading(true);
    setError(false);
    setItems([]);
    setOffline(null);
    setRestoring([...restoringIds.current]);
    void NetInfo.fetch().then(state => {
      if (current()) setOffline(state.isConnected === false || state.isInternetReachable === false);
    }).catch(() => { if (current()) setOffline(null); });
    async function load() {
      try {
        if (!user) throw new Error("Authentication required");
        const result = await getDeletedItems();
        if (current()) setItems(sortedDeletedItems(result));
      } catch {
        if (current()) setError(true);
      } finally {
        if (current()) setLoading(false);
      }
    }
    void load();
    return () => { active = false; version.current += 1; pickerVersion.current += 1; };
  }, [user?.uid, retry]));

  async function openDestinationPicker(item: Item, stale = false) {
    const request = ++pickerVersion.current;
    setPickerItem(item);
    setSelection(null);
    setSelectedStorage("");
    setSpaces([]);
    setOptions([]);
    setPickerLoading(true);
    setPickerMessage(stale ? "That location changed or is no longer available. Choose another location." : "Choose a location for this item.");
    try {
      const loaded = await getStorageSpaces();
      if (mounted.current && request === pickerVersion.current) {
        setSpaces([...new Map(loaded.filter(space => permanentId(space.id) && !space.isArchived).map(space => [space.id, space])).values()]);
      }
    } catch {
      if (mounted.current && request === pickerVersion.current) setPickerMessage("Unable to load locations. Check your connection and retry.");
    } finally {
      if (mounted.current && request === pickerVersion.current) setPickerLoading(false);
    }
  }

  async function selectStorage(vehicleId: string) {
    const request = ++pickerVersion.current;
    setSelectedStorage(vehicleId);
    setSelection(null);
    setOptions([]);
    setPickerLoading(true);
    try {
      const [compartments, rooms] = await Promise.all([getCompartmentsByVehicle(vehicleId), getRoomsByStorageSpace(vehicleId)]);
      const validRooms = new Map(rooms.filter(room => permanentId(room.id) && !room.isArchived && room.storageSpaceId === vehicleId).map(room => [room.id, room]));
      const destinations = compartments.filter(compartment => permanentId(compartment.id) && compartment.vehicleId === vehicleId &&
        !(compartment as { isArchived?: boolean }).isArchived && (!compartment.roomId || validRooms.has(compartment.roomId)))
        .map(compartment => ({ vehicleId, compartmentId: compartment.id, roomId: compartment.roomId || null,
          label: compartment.roomId ? `${validRooms.get(compartment.roomId)!.name} → ${compartment.name}` : compartment.name }));
      if (mounted.current && request === pickerVersion.current) setOptions([...new Map(destinations.map(option => [option.compartmentId, option])).values()]);
    } catch {
      if (mounted.current && request === pickerVersion.current) setPickerMessage("Unable to load compartments. Select the storage space again to retry.");
    } finally {
      if (mounted.current && request === pickerVersion.current) setPickerLoading(false);
    }
  }

  function cancelPicker() {
    if (pickerItem && restoringIds.current.has(pickerItem.id)) return;
    pickerVersion.current += 1;
    setPickerItem(null);
    setSelection(null);
  }

  async function handleRestore(itemId: string, destination?: RestoreDestination) {
    if (offline === true || restoringIds.current.has(itemId)) return;
    restoringIds.current.add(itemId);
    setRestoring([...restoringIds.current]);
    const request = version.current;
    try {
      const result = await restoreDeletedItem(itemId, destination);
      if (request !== version.current) return;
      setPickerItem(null);
      setRetry(value => value + 1);
      Alert.alert("Item restored", result.cacheUpdated
        ? (destination ? "Your gear is back in the selected location." : "Your gear is back in its original location.")
        : "Your gear was restored. Local data could not refresh; reconnect and reload if it still appears here.");
    } catch (error) {
      if (request !== version.current) return;
      const code = (error as { code?: string })?.code;
      if (code === "NEW_DESTINATION_REQUIRED") {
        const item = items.find(candidate => candidate.id === itemId);
        if (item) void openDestinationPicker(item, !!destination);
        return;
      }
      const message = code === "CONNECT_REQUIRED" ? "Connect to restore an item."
        : code === "SYNC_REQUIRED" ? "This item has changes waiting to sync. Let syncing finish, then try again."
        : code === "ITEM_NOT_FOUND" ? "This item is no longer available. Reload Recently Deleted."
        : code === "NOT_DELETED" ? "This item is already active. Reload Recently Deleted."
        : "Unable to restore this item. Check your connection and try again.";
      Alert.alert("Restore unavailable", message);
    } finally {
      restoringIds.current.delete(itemId);
      if (mounted.current) setRestoring([...restoringIds.current]);
    }
  }

  function confirmPermanentDelete(itemId: string) {
    if (offline === true || restoringIds.current.has(itemId)) return;
    Alert.alert("Delete Permanently?", "Permanently delete this item? This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete Permanently", style: "destructive", onPress: () => void handlePermanentDelete(itemId) },
    ]);
  }

  async function handlePermanentDelete(itemId: string) {
    // The same synchronous lock protects Restore and permanent deletion.
    if (offline === true || restoringIds.current.has(itemId)) return;
    restoringIds.current.add(itemId);
    setRestoring([...restoringIds.current]);
    setDeleting(previous => [...previous, itemId]);
    const request = version.current;
    try {
      const result = await permanentlyDeleteDeletedItem(itemId);
      if (request !== version.current) return;
      setItems(previous => previous.filter(item => item.id !== itemId));
      setRetry(value => value + 1);
      Alert.alert("Item permanently deleted", result.cacheUpdated
        ? "The item has been permanently deleted."
        : "The item was permanently deleted. Local data could not refresh; reconnect and reload if it still appears here.");
    } catch (error) {
      if (request !== version.current) return;
      const code = (error as { code?: string })?.code;
      const message = code === "CONNECT_REQUIRED" ? "Connect to permanently delete an item."
        : code === "SYNC_REQUIRED" ? "Let pending inventory changes finish syncing, then try again."
        : code === "ITEM_NOT_FOUND" ? "This item is no longer available. Reload Recently Deleted."
        : code === "NOT_DELETED" ? "This item is active and cannot be deleted here. Reload Recently Deleted."
        : code === "UNAUTHENTICATED" ? "Sign in again to permanently delete this item."
        : code === "INVALID_ITEM_ID" ? "This item cannot be deleted here. Reload Recently Deleted."
        : "Unable to permanently delete this item. Check your connection and try again.";
      Alert.alert("Delete unavailable", message);
    } finally {
      restoringIds.current.delete(itemId);
      if (mounted.current) {
        setRestoring([...restoringIds.current]);
        setDeleting(previous => previous.filter(id => id !== itemId));
      }
    }
  }

  return <ScreenBackground>
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <AppHeader title="Recently Deleted" showBackButton />
        {offline === true && <ThemedText>Showing deleted gear saved on this device. Connect to restore an item.</ThemedText>}
        {loading ? <ActivityIndicator accessibilityLabel="Loading recently deleted gear" color={theme.colors.text} />
          : error ? <ThemedCard><ThemedText>Unable to load recently deleted gear.</ThemedText><ThemedButton onPress={() => setRetry(value => value + 1)}><ThemedText style={styles.buttonText}>Retry</ThemedText></ThemedButton></ThemedCard>
          : items.length === 0 ? <ThemedCard><ThemedText variant="title">No Recently Deleted Gear</ThemedText><ThemedText>Items you remove will appear here.</ThemedText></ThemedCard>
          : items.map(item => {
            const time = deletionTime(item.deletedAt);
            return <ThemedCard key={item.id}>
              <View style={styles.row}>
                <DeletedPhoto item={item} />
                <View style={styles.details}>
                  <ThemedText variant="bodyStrong">{item.name}</ThemedText>
                  <ThemedText>Quantity: {item.quantity}</ThemedText>
                  <ThemedText>{originalLocation(item)}</ThemedText>
                  <ThemedText>{time === null ? "Deletion date unavailable" : `Deleted ${new Date(time).toLocaleDateString()}`}</ThemedText>
                </View>
              </View>
              <View style={styles.actions}>
                <ThemedButton style={styles.restoreButton} disabled={offline === true || restoring.includes(item.id)} onPress={() => void handleRestore(item.id)}>
                  <ThemedText style={styles.buttonText}>{restoring.includes(item.id) && !deleting.includes(item.id) ? "Restoring…" : "Restore"}</ThemedText>
                </ThemedButton>
                <HapticPressable accessibilityRole="button" style={styles.restoreButton}
                  disabled={offline === true || restoring.includes(item.id)} onPress={() => confirmPermanentDelete(item.id)}>
                  <ThemedText style={styles.destructiveText}>{deleting.includes(item.id) ? "Deleting…" : "Delete Permanently"}</ThemedText>
                </HapticPressable>
              </View>
            </ThemedCard>;
          })}
      </ScrollView>
      {pickerItem && <Modal visible transparent animationType="fade" onRequestClose={cancelPicker}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.colors.cardStrong }]}>
            <ThemedText variant="title">Restore {pickerItem.name}</ThemedText>
            <ThemedText>{pickerMessage}</ThemedText>
            <ThemedText variant="bodyStrong">Storage Space</ThemedText>
            <ScrollView style={styles.optionList}>
              {spaces.map(space => <HapticPressable key={space.id} accessibilityRole="button" accessibilityState={{ selected: selectedStorage === space.id }}
                disabled={restoring.includes(pickerItem.id)} onPress={() => void selectStorage(space.id)}
                style={[styles.option, { borderColor: selectedStorage === space.id ? theme.colors.primary : theme.colors.border }]}>
                <ThemedText>{space.name}</ThemedText>
              </HapticPressable>)}
              {!pickerLoading && spaces.length === 0 && <ThemedText>No available storage spaces.</ThemedText>}
            </ScrollView>
            <ThemedText variant="bodyStrong">Compartment</ThemedText>
            <ScrollView style={styles.optionList}>
              {options.map(option => <HapticPressable key={option.compartmentId} accessibilityRole="button" accessibilityState={{ selected: selection?.compartmentId === option.compartmentId }}
                disabled={pickerLoading || restoring.includes(pickerItem.id)} onPress={() => setSelection(option)}
                style={[styles.option, { borderColor: selection?.compartmentId === option.compartmentId ? theme.colors.primary : theme.colors.border }]}>
                <ThemedText>{option.label}</ThemedText>
              </HapticPressable>)}
              {!pickerLoading && options.length === 0 && <ThemedText>{selectedStorage ? "No available compartments." : "Select a storage space first."}</ThemedText>}
            </ScrollView>
            {pickerLoading && <ActivityIndicator accessibilityLabel="Loading destinations" />}
            <View style={styles.actions}>
              <HapticPressable style={styles.restoreButton} disabled={restoring.includes(pickerItem.id)} onPress={cancelPicker}><ThemedText>Cancel</ThemedText></HapticPressable>
              <ThemedButton style={styles.restoreButton} disabled={pickerLoading || !selection || offline === true || restoring.includes(pickerItem.id)}
                onPress={() => { if (selection && !pickerLoading) void handleRestore(pickerItem.id, { vehicleId: selection.vehicleId, compartmentId: selection.compartmentId, roomId: selection.roomId }); }}>
                <ThemedText style={styles.buttonText}>{restoring.includes(pickerItem.id) ? "Restoring…" : "Restore"}</ThemedText>
              </ThemedButton>
            </View>
          </View>
        </View>
      </Modal>}
    </SafeAreaView>
  </ScreenBackground>;
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: 20 },
  modalCard: { maxHeight: "90%", borderRadius: 18, padding: 18, gap: 12 },
  optionList: { maxHeight: 180, flexShrink: 1 },
  option: { minHeight: 44, borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 8 },
  destructiveText: { color: "#DC2626", fontWeight: "700" },
  actions: { flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", marginTop: 12, gap: 12 },
  restoreButton: { minHeight: 44, paddingHorizontal: 18, paddingVertical: 10 },
  buttonText: { color: "#FFFFFF", fontWeight: "700" },
  screen: { flex: 1 },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  row: { flexDirection: "row", gap: 14, alignItems: "center" },
  details: { flex: 1, gap: 4 },
  photo: { width: 64, height: 64, borderRadius: 10, alignItems: "center", justifyContent: "center" },
});
