import NetInfo from "@react-native-community/netinfo";
import { useFocusEffect } from "expo-router";
import { Image as ImageIcon } from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../../components/auth/AuthProvider";
import AppHeader from "../../../components/ui/AppHeader";
import ScreenBackground from "../../../components/ui/ScreenBackground";
import { ThemedButton, ThemedCard, ThemedText, useThemedValues } from "../../../components/ui/Themed";
import { getDeletedItems, restoreDeletedItem, type Item } from "../../../lib/gearService";

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
  const [restoring, setRestoring] = useState<string[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [offline, setOffline] = useState<boolean | null>(null);
  const [retry, setRetry] = useState(0);

  useFocusEffect(useCallback(() => {
    let active = true;
    const request = ++version.current;
    const current = () => active && request === version.current;
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
    return () => { active = false; version.current += 1; };
  }, [user?.uid, retry]));

  async function handleRestore(itemId: string) {
    if (offline === true || restoringIds.current.has(itemId)) return;
    restoringIds.current.add(itemId);
    setRestoring([...restoringIds.current]);
    const request = version.current;
    try {
      const result = await restoreDeletedItem(itemId);
      if (request !== version.current) return;
      setRetry(value => value + 1);
      Alert.alert("Item restored", result.cacheUpdated
        ? "Your gear is back in its original location."
        : "Your gear was restored. Local data could not refresh; reconnect and reload if it still appears here.");
    } catch (error) {
      if (request !== version.current) return;
      const code = (error as { code?: string })?.code;
      const message = code === "NEW_DESTINATION_REQUIRED"
        ? "Original location is no longer available. A new location must be selected to restore this item. Location selection is not available yet."
        : code === "CONNECT_REQUIRED" ? "Connect to restore an item."
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
                  <ThemedText style={styles.buttonText}>{restoring.includes(item.id) ? "Restoring…" : "Restore"}</ThemedText>
                </ThemedButton>
              </View>
            </ThemedCard>;
          })}
      </ScrollView>
    </SafeAreaView>
  </ScreenBackground>;
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", justifyContent: "flex-end", marginTop: 12, gap: 12 },
  restoreButton: { minHeight: 44, paddingHorizontal: 18, paddingVertical: 10 },
  buttonText: { color: "#FFFFFF", fontWeight: "700" },
  screen: { flex: 1 },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  row: { flexDirection: "row", gap: 14, alignItems: "center" },
  details: { flex: 1, gap: 4 },
  photo: { width: 64, height: 64, borderRadius: 10, alignItems: "center", justifyContent: "center" },
});
