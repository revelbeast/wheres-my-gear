import React, { useEffect, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronRight } from "lucide-react-native";
import { router } from "expo-router";

import ScreenBackground from "../../components/ui/ScreenBackground";
import AppHeader from "../../components/ui/AppHeader";
import { colors } from "../../theme/tokens";
import {
  getChecklistTemplates,
  createChecklistFromTemplate,
} from "../../lib/checklistsService";
import type { ChecklistTemplate } from "../../types/checklists";

const DEMO_USER_ID = "demo-user-123";

export default function CreateChecklistScreen() {
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    try {
      const data = await getChecklistTemplates(DEMO_USER_ID);
      setTemplates(data);
    } catch (err) {
      console.error("Failed to load templates:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleTemplatePress(template: ChecklistTemplate) {
    try {
      const checklistId = await createChecklistFromTemplate(
        DEMO_USER_ID,
        template
      );

      router.replace({
        pathname: "/checklists/[checklistId]",
        params: { checklistId },
      });
    } catch (err) {
      console.error("Failed to create checklist:", err);
    }
  }

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <AppHeader title="Create Checklist" showBackButton />

          {loading ? (
            <Text style={styles.loading}>Loading templates...</Text>
          ) : (
            templates.map((template) => (
              <View key={template.id} style={styles.card}>
                <Pressable
                  style={styles.row}
                  onPress={() => handleTemplatePress(template)}
                >
                  <View style={styles.left}>
                    <Text style={styles.title}>{template.name}</Text>
                    <Text style={styles.meta}>{template.itemCount} items</Text>
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
  safe: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 140,
  },
  loading: {
    color: colors.textMuted,
    marginTop: 20,
  },
  card: {
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
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
  },
});