import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";

import { useAuth } from "../../components/auth/AuthProvider";
import ScreenBackground from "../../components/ui/ScreenBackground";
import AppHeader from "../../components/ui/AppHeader";
import { colors } from "../../theme/tokens";
import {
  AssignedChecklistItemSummary,
  getAssignedChecklistItems,
} from "../../lib/checklistsService";

export default function ItemsScreen() {
  const { user } = useAuth();
  const { status } = useLocalSearchParams<{ status: string }>();
  const [items, setItems] = useState<AssignedChecklistItemSummary[]>([]);

  useEffect(() => {
    if (!user) {
      setItems([]);
      return;
    }

    loadItems();
  }, [status, user]);

  async function loadItems() {
    if (!user) {
      setItems([]);
      return;
    }

    try {
      const packed = String(status).toLowerCase().trim() === "packed";
      const data = await getAssignedChecklistItems(user.uid, { packed });
      setItems(data);
    } catch (err) {
      console.error("Failed to load items:", err);
      setItems([]);
    }
  }

  return (
    <ScreenBackground>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerWrap}>
          <AppHeader
            title={status === "packed" ? "Packed Items" : "Missing Items"}
            showBackButton
          />
        </View>

        {items.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No items found</Text>
            <Text style={styles.emptyText}>
              There are no {status === "packed" ? "packed" : "missing"} assigned checklist items right now.
            </Text>
          </View>
        ) : (
          items.map((item) => (
            <View key={`${item.checklistId}-${item.id}`} style={styles.card}>
              <Text style={styles.cardTitle}>{item.name}</Text>
              <Text style={styles.cardMeta}>
                {item.compartmentName} • {item.checklistName}
              </Text>
              <Text style={styles.cardSubMeta}>
                Qty: {item.quantity}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  headerWrap: {
    marginBottom: 8,
  },
  card: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 10,
    backgroundColor: "rgba(12,24,50,0.72)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  cardTitle: {
    color: colors.text,
    fontWeight: "600",
    marginBottom: 4,
    fontSize: 16,
  },
  cardMeta: {
    color: colors.textSecondary,
    fontSize: 13,
    marginBottom: 4,
  },
  cardSubMeta: {
    color: colors.textMuted,
    fontSize: 12,
  },
  emptyCard: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: "rgba(12,24,50,0.72)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  emptyTitle: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 16,
    marginBottom: 4,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
});