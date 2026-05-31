import { useFocusEffect, router } from "expo-router";
import { Archive, ClipboardList, RotateCcw, Trash2, Warehouse } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../../components/auth/AuthProvider";
import AppHeader from "../../components/ui/AppHeader";
import HapticPressable from "../../components/ui/HapticPressable";
import ScreenBackground from "../../components/ui/ScreenBackground";
import { ThemedCard, ThemedText, useThemedValues } from "../../components/ui/Themed";
import {
  deleteStorageSpace,
  getArchivedStorageSpaces,
  restoreStorageSpace,
  type StorageSpace,
} from "../../lib/gearService";
import {
  deleteChecklist,
  deleteChecklistTemplate,
  getArchivedChecklists,
  getArchivedChecklistTemplates,
  restoreChecklist,
  restoreChecklistTemplate,
} from "../../lib/checklistsService";
import { isPremiumPlusUser } from "../../lib/revenuecat";
import type { Checklist, ChecklistTemplate } from "../../types/checklists";

export default function ArchiveScreen() {
  const theme = useThemedValues();
  const { user } = useAuth();
  const userId = user?.uid ?? "";
  const isMountedRef = useRef(true);
  const [hasPremiumPlusAccess, setHasPremiumPlusAccess] = useState(false);
  const [checkingPremiumPlusAccess, setCheckingPremiumPlusAccess] = useState(true);
  const [archivedStorageSpaces, setArchivedStorageSpaces] = useState<StorageSpace[]>([]);
  const [archivedChecklists, setArchivedChecklists] = useState<Checklist[]>([]);
  const [archivedTemplates, setArchivedTemplates] = useState<ChecklistTemplate[]>([]);
  const [loadingStorageSpaces, setLoadingStorageSpaces] = useState(true);
  const [loadingChecklists, setLoadingChecklists] = useState(true);

  useEffect(() => {
    let active = true;

    async function validatePremiumPlusAccess() {
      try {
        if (!user) {
          router.replace("/sign-in");
          return;
        }

        const hasAccess = await isPremiumPlusUser();

        if (!active) return;

        setHasPremiumPlusAccess(hasAccess);

        if (!hasAccess) {
          Alert.alert(
            "Unlock Premium +",
            "Archive is a Premium + add-on feature for organizing hidden or completed gear records.",
            [
              {
                text: "Not Now",
                style: "cancel",
                onPress: () => router.back(),
              },
              {
                text: "Upgrade to Premium +",
                onPress: () =>
                  router.push({
                    pathname: "/paywall",
                    params: { plan: "premium_plus" },
                  }),
              },
            ]
          );
        }
      } catch (error) {
        console.error("Premium+ archive access check failed:", error);
        router.back();
      } finally {
        if (active) {
          setCheckingPremiumPlusAccess(false);
        }
      }
    }

    void validatePremiumPlusAccess();

    return () => {
      active = false;
    };
  }, [user]);

  useFocusEffect(
    React.useCallback(() => {
      isMountedRef.current = true;

      if (checkingPremiumPlusAccess || !hasPremiumPlusAccess) {
        setLoadingStorageSpaces(false);
        setLoadingChecklists(false);
        return;
      }

    async function loadArchivedStorageSpaces() {
      try {
        setLoadingStorageSpaces(true);
        const spaces = await getArchivedStorageSpaces();

        if (!isMountedRef.current) return;

        setArchivedStorageSpaces(spaces);
      } catch (error) {
        console.error("Failed to load archived storage spaces:", error);

        if (!isMountedRef.current) return;

        setArchivedStorageSpaces([]);
      } finally {
        if (isMountedRef.current) {
          setLoadingStorageSpaces(false);
        }
      }
    }

    async function loadArchivedChecklists() {
      if (!userId) {
        setArchivedChecklists([]);
        setArchivedTemplates([]);
        setLoadingChecklists(false);
        return;
      }

      try {
        setLoadingChecklists(true);

        const [checklists, templates] = await Promise.all([
          getArchivedChecklists(userId),
          getArchivedChecklistTemplates(userId),
        ]);

        if (!isMountedRef.current) return;

        setArchivedChecklists(checklists);
        setArchivedTemplates(templates);
      } catch (error) {
        console.error("Failed to load archived checklists:", error);

        if (!isMountedRef.current) return;

        setArchivedChecklists([]);
        setArchivedTemplates([]);
      } finally {
        if (isMountedRef.current) {
          setLoadingChecklists(false);
        }
      }
    }

    void loadArchivedStorageSpaces();
    void loadArchivedChecklists();

      return () => {
        isMountedRef.current = false;
      };
    }, [userId, checkingPremiumPlusAccess, hasPremiumPlusAccess])
  );

  async function handleRestoreStorageSpace(storageId: string) {
    await restoreStorageSpace(storageId);
    setArchivedStorageSpaces((current) =>
      current.filter((space) => space.id !== storageId)
    );
  }

  function handleConfirmDeleteStorageSpace(space: StorageSpace) {
    Alert.alert(
      "Delete Permanently?",
      `This will permanently delete "${space.name}", its compartments, and all inventory items stored inside it. This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Permanently",
          style: "destructive",
          onPress: () => {
            void handleDeleteStorageSpace(space.id);
          },
        },
      ]
    );
  }

  async function handleDeleteStorageSpace(storageId: string) {
    await deleteStorageSpace(storageId);
    setArchivedStorageSpaces((current) =>
      current.filter((space) => space.id !== storageId)
    );
  }

  async function handleRestoreChecklist(checklistId: string) {
    if (!userId) return;

    await restoreChecklist(userId, checklistId);
    setArchivedChecklists((current) =>
      current.filter((checklist) => checklist.id !== checklistId)
    );
  }

  async function handleRestoreTemplate(templateId: string) {
    if (!userId) return;

    await restoreChecklistTemplate(userId, templateId);
    setArchivedTemplates((current) =>
      current.filter((template) => template.id !== templateId)
    );
  }

  function handleConfirmDeleteChecklist(checklist: Checklist) {
    if (!userId) return;

    Alert.alert(
      "Delete Permanently?",
      `This will permanently delete "${checklist.name}". This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Permanently",
          style: "destructive",
          onPress: () => {
            void handleDeleteChecklist(checklist.id);
          },
        },
      ]
    );
  }

  async function handleDeleteChecklist(checklistId: string) {
    if (!userId) return;

    await deleteChecklist(userId, checklistId);
    setArchivedChecklists((current) =>
      current.filter((checklist) => checklist.id !== checklistId)
    );
  }

  function handleConfirmDeleteTemplate(template: ChecklistTemplate) {
    if (!userId) return;

    Alert.alert(
      "Delete Permanently?",
      `This will permanently delete "${template.name}" and its template items. This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Permanently",
          style: "destructive",
          onPress: () => {
            void handleDeleteTemplate(template.id);
          },
        },
      ]
    );
  }

  async function handleDeleteTemplate(templateId: string) {
    if (!userId) return;

    await deleteChecklistTemplate(userId, templateId);
    setArchivedTemplates((current) =>
      current.filter((template) => template.id !== templateId)
    );
  }

  if (checkingPremiumPlusAccess || !hasPremiumPlusAccess) {
    return (
      <ScreenBackground>
        <SafeAreaView style={styles.safe}>
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
            <ThemedText color="secondary">Checking Premium+ access...</ThemedText>
          </View>
        </SafeAreaView>
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <AppHeader title="Archive" showBackButton backHref="/(tabs)" />

          <ThemedCard contentStyle={styles.heroCardContent}>
            <View
              style={[
                styles.heroIconWrap,
                {
                  backgroundColor: theme.colors.iconSurface,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Archive size={28} color={theme.colors.text} />
            </View>

            <ThemedText variant="header" style={styles.heroTitle}>
              Archive
            </ThemedText>

            <ThemedText color="secondary" style={styles.heroSubtitle}>
              Archived storage spaces and checklists will appear here. You will be able to restore them or permanently delete them later.
            </ThemedText>
          </ThemedCard>

          <ThemedCard contentStyle={styles.sectionCardContent}>
            <View style={styles.sectionHeaderRow}>
              <Warehouse size={22} color={theme.colors.text} />
              <ThemedText variant="title" style={styles.sectionTitle}>
                Archived Storage Spaces
              </ThemedText>
            </View>

            {loadingStorageSpaces ? (
              <ThemedText color="secondary" style={styles.emptyText}>
                Loading archived storage spaces...
              </ThemedText>
            ) : archivedStorageSpaces.length === 0 ? (
              <ThemedText color="secondary" style={styles.emptyText}>
                No archived storage spaces yet.
              </ThemedText>
            ) : (
              <View style={styles.archiveList}>
                {archivedStorageSpaces.map((space) => (
                  <View
                    key={space.id}
                    style={[
                      styles.archiveRow,
                      { borderColor: theme.colors.border },
                    ]}
                  >
                    <View style={styles.archiveRowText}>
                      <ThemedText variant="bodyStrong" style={styles.archiveRowTitle}>
                        {space.name}
                      </ThemedText>
                      <ThemedText color="secondary" style={styles.archiveRowSubtitle}>
                        {space.subtype || space.category || "Storage Space"}
                      </ThemedText>
                    </View>

                    <View style={styles.archiveRowActions}>
                      <HapticPressable
                        style={[
                          styles.archiveActionButton,
                          styles.restoreActionButton,
                        ]}
                        onPress={() => {
                          void handleRestoreStorageSpace(space.id);
                        }}
                      >
                        <RotateCcw size={16} color="#22C55E" />
                        <ThemedText style={styles.restoreButtonText}>
                          Restore
                        </ThemedText>
                      </HapticPressable>

                      <HapticPressable
                        style={[
                          styles.archiveActionButton,
                          styles.deleteActionButton,
                        ]}
                        onPress={() => handleConfirmDeleteStorageSpace(space)}
                      >
                        <Trash2 size={16} color="#EF4444" />
                        <ThemedText style={styles.deleteButtonText}>
                          Delete
                        </ThemedText>
                      </HapticPressable>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </ThemedCard>

          <ThemedCard contentStyle={styles.sectionCardContent}>
            <View style={styles.sectionHeaderRow}>
              <ClipboardList size={22} color={theme.colors.text} />
              <ThemedText variant="title" style={styles.sectionTitle}>
                Archived Checklists
              </ThemedText>
            </View>

            {loadingChecklists ? (
              <ThemedText color="secondary" style={styles.emptyText}>
                Loading archived checklists...
              </ThemedText>
            ) : archivedChecklists.length === 0 &&
              archivedTemplates.length === 0 ? (
              <ThemedText color="secondary" style={styles.emptyText}>
                No archived checklists yet.
              </ThemedText>
            ) : (
              <View style={styles.archiveList}>
                {archivedChecklists.map((checklist) => (
                  <View
                    key={`checklist-${checklist.id}`}
                    style={[
                      styles.archiveRow,
                      { borderColor: theme.colors.border },
                    ]}
                  >
                    <View style={styles.archiveRowText}>
                      <ThemedText
                        variant="bodyStrong"
                        style={styles.archiveRowTitle}
                      >
                        {checklist.name}
                      </ThemedText>

                      <ThemedText
                        color="secondary"
                        style={styles.archiveRowSubtitle}
                      >
                        Checklist
                      </ThemedText>
                    </View>

                    <View style={styles.archiveRowActions}>
                      <HapticPressable
                        style={[
                          styles.archiveActionButton,
                          styles.restoreActionButton,
                        ]}
                        onPress={() => {
                          void handleRestoreChecklist(checklist.id);
                        }}
                      >
                        <RotateCcw size={16} color="#22C55E" />
                        <ThemedText style={styles.restoreButtonText}>
                          Restore
                        </ThemedText>
                      </HapticPressable>

                      <HapticPressable
                        style={[
                          styles.archiveActionButton,
                          styles.deleteActionButton,
                        ]}
                        onPress={() => handleConfirmDeleteChecklist(checklist)}
                      >
                        <Trash2 size={16} color="#EF4444" />
                        <ThemedText style={styles.deleteButtonText}>
                          Delete
                        </ThemedText>
                      </HapticPressable>
                    </View>
                  </View>
                ))}

                {archivedTemplates.map((template) => (
                  <View
                    key={`template-${template.id}`}
                    style={[
                      styles.archiveRow,
                      { borderColor: theme.colors.border },
                    ]}
                  >
                    <View style={styles.archiveRowText}>
                      <ThemedText
                        variant="bodyStrong"
                        style={styles.archiveRowTitle}
                      >
                        {template.name}
                      </ThemedText>

                      <ThemedText
                        color="secondary"
                        style={styles.archiveRowSubtitle}
                      >
                        Template
                      </ThemedText>
                    </View>

                    <View style={styles.archiveRowActions}>
                      <HapticPressable
                        style={[
                          styles.archiveActionButton,
                          styles.restoreActionButton,
                        ]}
                        onPress={() => {
                          void handleRestoreTemplate(template.id);
                        }}
                      >
                        <RotateCcw size={16} color="#22C55E" />
                        <ThemedText style={styles.restoreButtonText}>
                          Restore
                        </ThemedText>
                      </HapticPressable>

                      <HapticPressable
                        style={[
                          styles.archiveActionButton,
                          styles.deleteActionButton,
                        ]}
                        onPress={() => handleConfirmDeleteTemplate(template)}
                      >
                        <Trash2 size={16} color="#EF4444" />
                        <ThemedText style={styles.deleteButtonText}>
                          Delete
                        </ThemedText>
                      </HapticPressable>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </ThemedCard>
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
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 120,
  },

  heroCardContent: {
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 22,
  },

  heroIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    marginBottom: 14,
  },

  heroTitle: {
    textAlign: "center",
    marginBottom: 8,
  },

  heroSubtitle: {
    textAlign: "center",
    lineHeight: 20,
  },

  sectionCardContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },

  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },

  sectionTitle: {
    flex: 1,
  },

  emptyText: {
    lineHeight: 20,
  },

  archiveList: {
    gap: 10,
  },

  archiveRow: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  archiveRowText: {
    flex: 1,
  },

  archiveRowTitle: {
    marginBottom: 3,
  },

  archiveRowSubtitle: {
    lineHeight: 18,
  },

  archiveRowActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },

  archiveActionButton: {
    minWidth: 124,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 14,
  },

  restoreActionButton: {
    borderColor: "#22C55E",
    backgroundColor: "rgba(34,197,94,0.10)",
  },

  deleteActionButton: {
    borderColor: "#EF4444",
    backgroundColor: "rgba(239,68,68,0.10)",
  },

  restoreButtonText: {
    color: "#22C55E",
    fontWeight: "800",
  },

  deleteButtonText: {
    color: "#EF4444",
    fontWeight: "800",
  },
});
