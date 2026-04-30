import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FolderCog,
  ListChecks,
  Plus,
  SquarePen,
} from "lucide-react-native";
import { router } from "expo-router";

import { useAuth } from "../../components/auth/AuthProvider";
import ScreenBackground from "../../components/ui/ScreenBackground";
import AppHeader from "../../components/ui/AppHeader";
import { colors } from "../../theme/tokens";
import {
  createChecklistFromTemplate,
  getChecklistTemplates,
  subscribeToChecklists,
} from "../../lib/checklistsService";
import type { Checklist, ChecklistTemplate } from "../../types/checklists";

type SummaryCardProps = {
  icon: React.ReactNode;
  value: number;
  label: string;
};

function SummaryCard({ icon, value, label }: SummaryCardProps) {
  return (
    <View style={styles.summaryCard}>
      <View style={styles.summaryIconWrap}>{icon}</View>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

export default function ChecklistsScreen() {
  const { user, initializing } = useAuth();

  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [creatingTemplateId, setCreatingTemplateId] = useState<string | null>(null);

  useEffect(() => {
    if (initializing) {
      return;
    }

    if (!user) {
      setChecklists([]);
      setTemplates([]);
      setLoadingTemplates(false);
      return;
    }

    loadTemplates(user.uid);

    const unsubscribe = subscribeToChecklists(user.uid, (items) => {
      setChecklists(items.filter((item) => !item.isArchived));
    });

    return unsubscribe;
  }, [initializing, user]);

  async function loadTemplates(userId: string) {
    try {
      setLoadingTemplates(true);
      const data = await getChecklistTemplates(userId);
      setTemplates(data);
    } catch (err) {
      console.error("Failed to load templates:", err);
      setTemplates([]);
    } finally {
      setLoadingTemplates(false);
    }
  }

  async function handleTemplatePress(template: ChecklistTemplate) {
    if (!user) {
      Alert.alert("Sign in required", "Please sign in to create a checklist.");
      return;
    }

    try {
      setCreatingTemplateId(template.id);

      const checklistId = await createChecklistFromTemplate(
        user.uid,
        template
      );

      router.push({
        pathname: "/checklists/[checklistId]",
        params: { checklistId },
      });
    } catch (err) {
      console.error("Failed to create checklist:", err);
      Alert.alert("Error", "Failed to create checklist.");
    } finally {
      setCreatingTemplateId(null);
    }
  }

  function handleOpenChecklist(checklistId: string) {
    router.push({
      pathname: "/checklists/[checklistId]",
      params: { checklistId },
    });
  }

  function handleCreateBlankChecklist() {
    router.push("/checklists/create-blank");
  }

  function handleOpenTemplates() {
    router.push("/checklists/templates");
  }

  const activeChecklists = useMemo(() => {
    return checklists.filter((item) => item.status !== "archived");
  }, [checklists]);

  const totalItems = useMemo(() => {
    return activeChecklists.reduce((sum, item) => sum + (item.totalCount ?? 0), 0);
  }, [activeChecklists]);

  const packedItems = useMemo(() => {
    return activeChecklists.reduce((sum, item) => sum + (item.packedCount ?? 0), 0);
  }, [activeChecklists]);

  const missingItems = useMemo(() => {
    return activeChecklists.reduce((sum, item) => sum + (item.missingCount ?? 0), 0);
  }, [activeChecklists]);

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <AppHeader title="Checklists" />

          <View style={styles.heroSection}>
            <Text style={styles.sectionEyebrow}>Packing System</Text>
            <Text style={styles.heroTitle}>Build and manage your checklists</Text>
            <Text style={styles.heroSubtitle}>
              Start from a blank checklist or a template, track progress, and keep your gear organized.
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <SummaryCard
              icon={<ClipboardList size={18} color={colors.text} />}
              value={activeChecklists.length}
              label="Active"
            />
            <SummaryCard
              icon={<CheckCircle2 size={18} color={colors.text} />}
              value={packedItems}
              label="Packed"
            />
            <SummaryCard
              icon={<ListChecks size={18} color={colors.text} />}
              value={missingItems}
              label="To Pack"
            />
          </View>

          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionEyebrow}>Create</Text>
              <Text style={styles.sectionTitle}>Start a Checklist</Text>
              <Text style={styles.sectionSubtitle}>
                Create a blank checklist or start from one of your saved templates.
              </Text>
            </View>
          </View>

          <Pressable style={styles.primaryCreateCard} onPress={handleCreateBlankChecklist}>
            <View style={styles.primaryCreateLeft}>
              <View style={styles.primaryCreateIconWrap}>
                <SquarePen size={18} color={colors.text} />
              </View>

              <View style={styles.primaryCreateTextWrap}>
                <Text style={styles.primaryCreateTitle}>New Blank Checklist</Text>
                <Text style={styles.primaryCreateSubtitle}>
                  Start from scratch and add your own items
                </Text>
              </View>
            </View>

            <View style={styles.chevronWrap}>
              <ChevronRight size={18} color={colors.textSecondary} />
            </View>
          </Pressable>

          <Pressable style={styles.manageTemplatesCard} onPress={handleOpenTemplates}>
            <View style={styles.manageTemplatesLeft}>
              <View style={styles.manageTemplatesIconWrap}>
                <FolderCog size={18} color={colors.text} />
              </View>

              <View style={styles.manageTemplatesTextWrap}>
                <Text style={styles.manageTemplatesTitle}>Manage Templates</Text>
                <Text style={styles.manageTemplatesSubtitle}>
                  Rename and delete your saved checklist templates
                </Text>
              </View>
            </View>

            <View style={styles.chevronWrap}>
              <ChevronRight size={18} color={colors.textSecondary} />
            </View>
          </Pressable>

          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionEyebrow}>Your checklists</Text>
              <Text style={styles.sectionTitle}>
                Active Checklists ({activeChecklists.length})
              </Text>
            </View>
          </View>

          {activeChecklists.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No active checklists yet</Text>
              <Text style={styles.emptyText}>
                Create a blank checklist or use a template below to get started.
              </Text>
            </View>
          ) : (
            activeChecklists.map((checklist) => (
              <View key={checklist.id} style={styles.card}>
                <Pressable
                  style={styles.row}
                  onPress={() => handleOpenChecklist(checklist.id)}
                >
                  <View style={styles.leftRow}>
                    <View style={styles.iconWrap}>
                      <ClipboardList size={18} color={colors.text} />
                    </View>

                    <View style={styles.left}>
                      <Text style={styles.title}>{checklist.name}</Text>
                      <Text style={styles.meta}>
                        {checklist.packedCount} packed • {checklist.missingCount} to pack •{" "}
                        {checklist.totalCount} total
                      </Text>
                    </View>
                  </View>

                  <View style={styles.chevronWrap}>
                    <ChevronRight size={18} color={colors.textSecondary} />
                  </View>
                </Pressable>
              </View>
            ))
          )}

          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionEyebrow}>Templates</Text>
              <Text style={styles.sectionTitle}>Create From Template</Text>
              <Text style={styles.sectionSubtitle}>
                Choose a reusable checklist template to start quickly.
              </Text>
            </View>
          </View>

          {loadingTemplates ? (
            <View style={styles.loadingCard}>
              <Text style={styles.loading}>Loading templates...</Text>
            </View>
          ) : templates.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No templates available</Text>
              <Text style={styles.emptyText}>
                Save a checklist as a template to reuse it later.
              </Text>
            </View>
          ) : (
            templates.map((template) => {
              const isCreating = creatingTemplateId === template.id;

              return (
                <View key={template.id} style={styles.card}>
                  <Pressable
                    style={styles.row}
                    onPress={() => handleTemplatePress(template)}
                    disabled={isCreating}
                  >
                    <View style={styles.leftRow}>
                      <View style={styles.iconWrap}>
                        <ListChecks size={18} color={colors.text} />
                      </View>

                      <View style={styles.left}>
                        <Text style={styles.title}>{template.name}</Text>
                        <Text style={styles.meta}>
                          {template.itemCount} {template.itemCount === 1 ? "item" : "items"}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.templateActionWrap}>
                      {isCreating ? (
                        <Text style={styles.creatingText}>Creating...</Text>
                      ) : (
                        <>
                          <Plus size={16} color={colors.textSecondary} />
                          <ChevronRight size={18} color={colors.textSecondary} />
                        </>
                      )}
                    </View>
                  </Pressable>
                </View>
              );
            })
          )}

          <View style={styles.footerCard}>
            <Text style={styles.footerTitle}>Checklist coverage</Text>
            <Text style={styles.footerText}>
              {totalItems} total checklist items are currently being tracked across your active checklists.
            </Text>
          </View>
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
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 140,
  },

  heroSection: {
    marginTop: 6,
    marginBottom: 16,
  },

  sectionEyebrow: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 4,
  },

  heroTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 6,
    lineHeight: 28,
  },

  heroSubtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },

  summaryRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 18,
  },

  summaryCard: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    minHeight: 92,
  },

  summaryIconWrap: {
    marginBottom: 8,
  },

  summaryValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 2,
    lineHeight: 22,
  },

  summaryLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16,
  },

  sectionHeader: {
    marginBottom: 12,
  },

  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 24,
  },

  sectionSubtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },

  primaryCreateCard: {
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: "rgba(55,130,245,0.18)",
    borderWidth: 1,
    borderColor: "rgba(55,130,245,0.35)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  primaryCreateLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    paddingRight: 10,
  },

  primaryCreateIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },

  primaryCreateTextWrap: {
    flex: 1,
  },

  primaryCreateTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
    lineHeight: 22,
  },

  primaryCreateSubtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },

  manageTemplatesCard: {
    marginBottom: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  manageTemplatesLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    paddingRight: 10,
  },

  manageTemplatesIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  manageTemplatesTextWrap: {
    flex: 1,
  },

  manageTemplatesTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
    lineHeight: 22,
  },

  manageTemplatesSubtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },

  loadingCard: {
    marginTop: 4,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },

  loading: {
    color: colors.textMuted,
    fontSize: 14,
  },

  emptyCard: {
    marginTop: 4,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },

  emptyTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 6,
    lineHeight: 22,
  },

  emptyText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },

  card: {
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },

  row: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  leftRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 10,
  },

  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  left: {
    flex: 1,
  },

  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
    lineHeight: 22,
  },

  meta: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },

  chevronWrap: {
    width: 24,
    alignItems: "flex-end",
    justifyContent: "center",
  },

  templateActionWrap: {
    minWidth: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
  },

  creatingText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
  },

  footerCard: {
    marginTop: 4,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },

  footerTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 4,
    lineHeight: 20,
  },

  footerText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
});