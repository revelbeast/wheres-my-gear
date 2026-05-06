import { BlurView } from "expo-blur";
import { router } from "expo-router";
import {
  CheckCircle2,
  ChevronRight,
  FilePlus2,
  FolderCog,
  ListChecks,
  SquarePen,
} from "lucide-react-native";
import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../../../components/auth/AuthProvider";
import HapticPressable from "../../../components/ui/HapticPressable";
import ScreenBackground from "../../../components/ui/ScreenBackground";
import {
  ThemedButton,
  ThemedCard,
  ThemedText,
  useThemedValues,
} from "../../../components/ui/Themed";
import { subscribeToChecklists } from "../../../lib/checklistsService";
import { useInteractionLock } from "../../../lib/useInteractionLock";
import type { Checklist, ChecklistCategory } from "../../../types/checklists";

const LABEL_WHITE = "#FFFFFF";

function getCategoryLabel(
  category: ChecklistCategory,
  customCategoryLabel?: string
) {
  if (category === "custom") {
    return customCategoryLabel?.trim() || "Other";
  }

  switch (category) {
    case "trip":
      return "Trip";
    case "camping":
      return "Camping";
    case "hunting":
      return "Hunting";
    case "fishing":
      return "Fishing";
    case "clothing":
      return "Clothing";
    case "electronics":
      return "Electronics";
    case "medical":
      return "Medical";
    case "tools":
      return "Tools";
    case "food":
      return "Food";
    default:
      return "Checklist";
  }
}

function StatCard({
  icon,
  value,
  label,
  onPress,
  disabled = false,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  onPress?: () => void;
  disabled?: boolean;
}) {
  const theme = useThemedValues();

  const content = (
    <BlurView
      intensity={theme.isLight ? 20 : 18}
      tint={theme.isLight ? "light" : "dark"}
      style={[
        styles.statCard,
        {
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.card,
        },
      ]}
    >
      <View
        style={[
          styles.statIconWrap,
          {
            backgroundColor: theme.colors.iconSurface,
            borderColor: theme.colors.border,
          },
        ]}
      >
        {icon}
      </View>

      <ThemedText variant="title" style={styles.statValue}>
        {value}
      </ThemedText>

      <ThemedText color="secondary" style={styles.statLabel}>
        {label}
      </ThemedText>
    </BlurView>
  );

  if (!onPress) {
    return <View style={styles.statCardWrap}>{content}</View>;
  }

  return (
    <HapticPressable
      onPress={onPress}
      style={[styles.statCardWrap, disabled && styles.disabledInteraction]}
      disabled={disabled}
    >
      {content}
    </HapticPressable>
  );
}

function ActionCard({
  icon,
  title,
  subtitle,
  onPress,
  highlight = false,
  disabled = false,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onPress: () => void;
  highlight?: boolean;
  disabled?: boolean;
}) {
  const theme = useThemedValues();

  const actionCardStyle = highlight
    ? {
        borderColor: theme.colors.primary,
        backgroundColor: theme.colors.card,
      }
    : {
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.card,
      };

  return (
    <HapticPressable
      onPress={onPress}
      style={[styles.actionPressable, disabled && styles.disabledInteraction]}
      disabled={disabled}
    >
      <BlurView
        intensity={theme.isLight ? 22 : 24}
        tint={theme.isLight ? "light" : "dark"}
        style={[styles.actionCard, actionCardStyle]}
      >
        <View style={styles.actionLeft}>
          <View
            style={[
              styles.actionIconWrap,
              {
                backgroundColor: theme.colors.iconSurface,
                borderColor: theme.colors.border,
              },
            ]}
          >
            {icon}
          </View>

          <View style={styles.actionTextWrap}>
            <ThemedText variant="title" style={styles.actionTitle}>
              {title}
            </ThemedText>
            <ThemedText color="secondary" style={styles.actionSubtitle}>
              {subtitle}
            </ThemedText>
          </View>
        </View>

        <ChevronRight size={20} color={theme.colors.textSecondary} />
      </BlurView>
    </HapticPressable>
  );
}

function EmptyChecklistCard({
  title,
  text,
  showAction,
  onPress,
  disabled = false,
}: {
  title: string;
  text: string;
  showAction?: boolean;
  onPress?: () => void;
  disabled?: boolean;
}) {
  const theme = useThemedValues();

  return (
    <BlurView
      intensity={theme.isLight ? 22 : 24}
      tint={theme.isLight ? "light" : "dark"}
      style={[
        styles.emptyStateCard,
        {
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.card,
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
        <ListChecks size={24} color={theme.colors.text} />
      </View>

      <ThemedText variant="title" style={styles.emptyTitle}>
        {title}
      </ThemedText>

      <ThemedText color="secondary" style={styles.emptyText}>
        {text}
      </ThemedText>

      {showAction && onPress ? (
        <ThemedButton
          style={{
            ...styles.emptyActionButton,
            ...(disabled ? styles.disabledButton : {}),
          }}
          onPress={onPress}
          disabled={disabled}
        >
          <ThemedText style={styles.emptyActionButtonText}>
            Create Checklist
          </ThemedText>
        </ThemedButton>
      ) : null}
    </BlurView>
  );
}

export default function ChecklistsTabScreen() {
  const { user, initializing } = useAuth();
  const theme = useThemedValues();
  const {
    isLocked: interactionLocked,
    lock: lockInteraction,
    unlock: unlockInteraction,
  } = useInteractionLock(450);

  const [checklists, setChecklists] = useState<Checklist[]>([]);

  useEffect(() => {
    if (initializing) {
      return;
    }

    if (!user) {
      setChecklists([]);
      return;
    }

    const unsubscribe = subscribeToChecklists(user.uid, (items) => {
      setChecklists(items.filter((item) => !item.isArchived));
    });

    return unsubscribe;
  }, [initializing, user]);

  function runWithLock(action: () => void) {
    if (interactionLocked) return;

    lockInteraction();

    try {
      action();
    } finally {
      unlockInteraction();
    }
  }

  const sortedChecklists = useMemo(() => {
    return [...checklists].sort((a, b) => {
      const aName = String(a.name ?? "").trim().toLowerCase();
      const bName = String(b.name ?? "").trim().toLowerCase();

      return aName.localeCompare(bName);
    });
  }, [checklists]);

  const activeChecklistCount = useMemo(() => checklists.length, [checklists]);

  const packedCount = useMemo(() => {
    return checklists.reduce(
      (sum, checklist) => sum + (checklist.packedCount ?? 0),
      0
    );
  }, [checklists]);

  const toPackCount = useMemo(() => {
    return checklists.reduce(
      (sum, checklist) => sum + (checklist.missingCount ?? 0),
      0
    );
  }, [checklists]);

  function handleOpenChecklist(checklistId: string) {
    runWithLock(() => {
      router.push({
        pathname: "/checklists/[checklistId]",
        params: { checklistId },
      });
    });
  }

  function handleCreateBlankChecklist() {
    runWithLock(() => {
      router.push("/checklists/new");
    });
  }

  function handleCreateTemplate() {
    runWithLock(() => {
      router.push("/checklists/create-template");
    });
  }

  function handleManageTemplates() {
    runWithLock(() => {
      router.push("/checklists/templates");
    });
  }

  function handleOpenPackedItems() {
    runWithLock(() => {
      router.push({
        pathname: "/checklists/items",
        params: { status: "packed" },
      });
    });
  }

  function handleOpenToPackItems() {
    runWithLock(() => {
      router.push({
        pathname: "/checklists/items",
        params: { status: "to_pack" },
      });
    });
  }

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerWrap}>
            <ThemedText
              variant="header"
              style={[styles.headerTitle, styles.whiteLabel]}
            >
              Checklists
            </ThemedText>
          </View>

          <View style={styles.heroSection}>
            <ThemedText style={[styles.eyebrow, styles.whiteLabelMuted]}>
              Packing System
            </ThemedText>

            <ThemedText
              variant="header"
              style={[styles.heroTitle, styles.whiteLabel]}
            >
              Build and manage your checklists
            </ThemedText>

            <ThemedText style={[styles.heroSubtitle, styles.whiteLabelMuted]}>
              Start from a blank checklist or a template, track progress, and
              keep your gear organized.
            </ThemedText>
          </View>

          <View style={styles.statsRow}>
            <StatCard
              icon={<ListChecks size={18} color={theme.colors.text} />}
              value={activeChecklistCount}
              label="Active"
            />

            <StatCard
              icon={<CheckCircle2 size={18} color={theme.colors.text} />}
              value={packedCount}
              label="Packed"
              onPress={handleOpenPackedItems}
              disabled={interactionLocked}
            />

            <StatCard
              icon={<ListChecks size={18} color={theme.colors.text} />}
              value={toPackCount}
              label="To Pack"
              onPress={handleOpenToPackItems}
              disabled={interactionLocked}
            />
          </View>

          <View style={styles.sectionWrap}>
            <ThemedText style={[styles.sectionEyebrow, styles.whiteLabelMuted]}>
              Create
            </ThemedText>

            <ThemedText
              variant="title"
              style={[styles.sectionTitle, styles.whiteLabel]}
            >
              Start a Checklist
            </ThemedText>

            <ThemedText style={[styles.sectionSubtitle, styles.whiteLabelMuted]}>
              Create a blank checklist or start from one of your saved templates.
            </ThemedText>
          </View>

          <View style={styles.createGroup}>
            <ActionCard
              icon={<FilePlus2 size={22} color={theme.colors.text} />}
              title="New Blank Checklist"
              subtitle="Start from scratch and add your own items"
              onPress={handleCreateBlankChecklist}
              highlight
              disabled={interactionLocked}
            />

            <ActionCard
              icon={<SquarePen size={22} color={theme.colors.text} />}
              title="Create Template"
              subtitle="Build reusable checklist templates"
              onPress={handleCreateTemplate}
              disabled={interactionLocked}
            />

            <ActionCard
              icon={<FolderCog size={22} color={theme.colors.text} />}
              title="Manage Templates"
              subtitle="Rename and delete your saved checklist templates"
              onPress={handleManageTemplates}
              disabled={interactionLocked}
            />
          </View>

          <View style={styles.sectionWrap}>
            <ThemedText style={[styles.sectionEyebrow, styles.whiteLabelMuted]}>
              Your Checklists
            </ThemedText>

            <ThemedText
              variant="title"
              style={[styles.sectionTitle, styles.whiteLabel]}
            >
              Active Checklists ({activeChecklistCount})
            </ThemedText>
          </View>

          {initializing ? (
            <EmptyChecklistCard
              title="Loading checklists"
              text="Restoring your saved checklist data."
            />
          ) : !user ? (
            <EmptyChecklistCard
              title="Sign in required"
              text="Sign in to create, manage, and track your packing checklists."
            />
          ) : checklists.length === 0 ? (
            <EmptyChecklistCard
              title="No checklists yet"
              text="Create your first checklist to track what is packed and what still needs to be packed."
              showAction
              onPress={handleCreateBlankChecklist}
              disabled={interactionLocked}
            />
          ) : (
            sortedChecklists.map((checklist) => (
              <ThemedCard key={checklist.id} style={styles.checklistCard}>
                <HapticPressable
                  style={[
                    styles.row,
                    interactionLocked && styles.disabledInteraction,
                  ]}
                  onPress={() => handleOpenChecklist(checklist.id)}
                  disabled={interactionLocked}
                >
                  <View style={styles.left}>
                    <ThemedText variant="title" style={styles.title}>
                      {checklist.name}
                    </ThemedText>

                    <ThemedText variant="small" style={styles.categoryText}>
                      {getCategoryLabel(
                        checklist.category,
                        checklist.customCategoryLabel
                      )}
                    </ThemedText>

                    <View style={styles.progressRow}>
                      <ThemedText color="secondary" style={styles.meta}>
                        {checklist.packedCount ?? 0} /{" "}
                        {checklist.totalCount ?? 0} packed
                      </ThemedText>

                      <ThemedText color="danger" style={styles.toPackBadge}>
                        {checklist.missingCount ?? 0} to pack
                      </ThemedText>
                    </View>
                  </View>

                  <ChevronRight size={18} color={theme.colors.textSecondary} />
                </HapticPressable>
              </ThemedCard>
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
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 120,
  },

  whiteLabel: {
    color: LABEL_WHITE,
  },

  whiteLabelMuted: {
    color: LABEL_WHITE,
    opacity: 0.82,
  },

  headerWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },

  headerTitle: {},

  heroSection: {
    marginBottom: 16,
  },

  eyebrow: {
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 6,
  },

  heroTitle: {
    lineHeight: 30,
    marginBottom: 8,
  },

  heroSubtitle: {
    lineHeight: 20,
  },

  statsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 20,
  },

  statCardWrap: {
    flex: 1,
    borderRadius: 18,
    overflow: "hidden",
  },

  statCard: {
    minHeight: 106,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    justifyContent: "center",
  },

  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    marginBottom: 10,
  },

  statValue: {
    marginBottom: 2,
  },

  statLabel: {
    fontWeight: "600",
  },

  sectionWrap: {
    marginBottom: 12,
  },

  sectionEyebrow: {
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 6,
  },

  sectionTitle: {
    lineHeight: 24,
    marginBottom: 4,
  },

  sectionSubtitle: {
    lineHeight: 20,
  },

  createGroup: {
    marginBottom: 16,
  },

  actionPressable: {
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 14,
  },

  actionCard: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  actionLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    paddingRight: 10,
  },

  actionIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    marginRight: 14,
  },

  actionTextWrap: {
    flex: 1,
  },

  actionTitle: {
    marginBottom: 4,
    lineHeight: 22,
  },

  actionSubtitle: {
    lineHeight: 20,
  },

  checklistCard: {
    marginBottom: 10,
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
    marginBottom: 4,
    lineHeight: 22,
  },

  categoryText: {
    fontWeight: "600",
    marginBottom: 6,
    opacity: 0.9,
  },

  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },

  meta: {},

  toPackBadge: {
    fontWeight: "700",
  },

  emptyStateCard: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 20,
    alignItems: "center",
    overflow: "hidden",
  },

  emptyIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    marginBottom: 12,
  },

  emptyTitle: {
    marginBottom: 6,
    textAlign: "center",
  },

  emptyText: {
    lineHeight: 20,
    textAlign: "center",
  },

  emptyActionButton: {
    alignSelf: "stretch",
    marginTop: 14,
  },

  emptyActionButtonText: {
    color: "#fff",
    fontWeight: "700",
    textAlign: "center",
  },

  disabledInteraction: {
    opacity: 0.6,
  },

  disabledButton: {
    opacity: 0.6,
  },
});