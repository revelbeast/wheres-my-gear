import React, { useEffect, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ChevronRight, Plus } from "lucide-react-native";

import ScreenBackground from "../../components/ui/ScreenBackground";
import { colors } from "../../theme/tokens";
import { subscribeToChecklists } from "../../lib/checklistsService";

import type { Checklist } from "../../types/checklists";

const DEMO_USER_ID = "demo-user-123";

export default function ChecklistsTabScreen() {
  const [checklists, setChecklists] = useState<Checklist[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeToChecklists(DEMO_USER_ID, (items) => {
      setChecklists(items.filter((item) => !item.isArchived));
    });

    return unsubscribe;
  }, []);

  function handleOpenChecklist(checklistId: string) {
    router.push({
      pathname: "/checklists/[checklistId]",
      params: { checklistId },
    });
  }

  function handleCreateChecklist() {
    router.push("/checklists/create");
  }

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>Checklists</Text>

            <Pressable style={styles.addButton} onPress={handleCreateChecklist}>
              <Plus size={16} color="#fff" />
              <Text style={styles.addButtonText}>New</Text>
            </Pressable>
          </View>

          {checklists.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No checklists yet</Text>
              <Text style={styles.emptyText}>
                Create your first checklist to start tracking gear.
              </Text>
            </View>
          ) : (
            checklists.map((checklist) => (
              <View key={checklist.id} style={styles.card}>
                <Pressable
                  style={styles.row}
                  onPress={() => handleOpenChecklist(checklist.id)}
                >
                  <View style={styles.left}>
                    <Text style={styles.title}>{checklist.name}</Text>

                    <Text style={styles.meta}>
                      {checklist.packedCount} / {checklist.totalCount} packed
                    </Text>

                    <Text style={styles.subMeta}>
                      {checklist.missingCount} missing
                    </Text>
                  </View>

                  <ChevronRight size={18} color={colors.textSecondary} />
                </Pressable>
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
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
    fontSize: 22,
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

  emptyCard: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: "rgba(12,24,50,0.9)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 6,
  },

  emptyText: {
    color: colors.textSecondary,
    fontSize: 14,
  },

  card: {
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: "rgba(12,24,50,0.9)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  row: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  left: {
    flex: 1,
    paddingRight: 10,
  },

  title: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 4,
  },

  meta: {
    color: colors.textSecondary,
    fontSize: 14,
    marginBottom: 2,
  },

  subMeta: {
    color: colors.textMuted,
    fontSize: 13,
  },
});