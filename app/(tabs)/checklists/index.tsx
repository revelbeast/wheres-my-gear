import { BlurView } from "expo-blur";
import { router, useFocusEffect } from "expo-router";
import {
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FilePlus2,
  FolderCog,
  ListChecks,
  SquarePen,
  Archive,
  Trash2,
} from "lucide-react-native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
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
import {
  archiveChecklist,
  archiveChecklistTemplate,
  deleteChecklist,
  deleteChecklistTemplate,
  getChecklistTemplateItems,
  getChecklistTemplates,
  subscribeToChecklists
} from "../../../lib/checklistsService";
import { useDeviceLayout } from "../../../lib/useDeviceLayout";
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
  tone,
  selected = false,
  onPress,
  disabled = false,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  tone: {
    borderColor: string;
    backgroundColor: string;
    textColor: string;
  };
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
}) {
  const theme = useThemedValues();

  const content = (
    <View
      style={[
        styles.statCard,
        {
          borderColor: selected ? tone.borderColor : theme.colors.border,
          backgroundColor: selected
            ? tone.backgroundColor
            : theme.isLight
              ? "#FFFFFF"
              : theme.colors.card,
          shadowColor: selected ? tone.borderColor : "#000",
          shadowOpacity: selected ? 0.52 : 0.12,
          shadowRadius: selected ? 16 : 8,
          shadowOffset: {
            width: 0,
            height: 0,
          },
          elevation: selected ? 8 : 0,
        },
      ]}
    >
      <View
        style={[
          styles.statIconWrap,
          {
            backgroundColor: selected
              ? "rgba(255,255,255,0.12)"
              : theme.colors.iconSurface,
            borderColor: selected ? tone.borderColor : theme.colors.border,
          },
        ]}
      >
        {icon}
      </View>

      <ThemedText
        variant="title"
        style={[
          styles.statValue,
          !selected && theme.isLight && { color: "#000000" },
        ]}
      >
        {value}
      </ThemedText>

      <ThemedText
        style={[
          styles.statLabel,
          {
            color: selected
              ? tone.textColor
              : theme.isLight
                ? "#000000"
                : theme.colors.textSecondary,
          },
        ]}
      >
        {label}
      </ThemedText>
    </View>
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

  const actionCardStyle = {
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
  const userId = user?.uid ?? "";
  const theme = useThemedValues();
  const { isTablet, isLandscape } = useDeviceLayout();
  const {
    isLocked: interactionLocked,
    lock: lockInteraction,
    unlock: unlockInteraction,
  } = useInteractionLock(450);

  const isMountedRef = useRef(true);
  const checklistSubscriptionVersionRef = useRef(0);
  const navigationTransitionLockedRef = useRef(false);
  const navigationUnlockTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [templateRows, setTemplateRows] = useState<Checklist[]>([]);
  const [selectedChecklistStatus, setSelectedChecklistStatus] = useState<
    "active" | "packed" | "toPack"
  >("active");

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      checklistSubscriptionVersionRef.current += 1;

      if (navigationUnlockTimeoutRef.current) {
        clearTimeout(navigationUnlockTimeoutRef.current);
        navigationUnlockTimeoutRef.current = null;
      }
    };
  }, []);


  useFocusEffect(
    React.useCallback(() => {
      navigationTransitionLockedRef.current = false;

      if (userId) {
        void loadTemplateRows(userId);
      }

      if (navigationUnlockTimeoutRef.current) {
        clearTimeout(navigationUnlockTimeoutRef.current);
        navigationUnlockTimeoutRef.current = null;
      }

      return () => {
        navigationTransitionLockedRef.current = false;

        if (navigationUnlockTimeoutRef.current) {
          clearTimeout(navigationUnlockTimeoutRef.current);
          navigationUnlockTimeoutRef.current = null;
        }
      };
    }, [userId])
  );

  useEffect(() => {
    const subscriptionVersion = checklistSubscriptionVersionRef.current + 1;
    checklistSubscriptionVersionRef.current = subscriptionVersion;

    if (initializing) {
      return;
    }

    if (!userId) {
      if (isMountedRef.current) {
        setChecklists([]);
        setTemplateRows([]);
      }

      return;
    }

    void loadTemplateRows(userId);

    const unsubscribe = subscribeToChecklists(userId, (items) => {
      if (
        !isMountedRef.current ||
        checklistSubscriptionVersionRef.current !== subscriptionVersion
      ) {
        return;
      }

      setChecklists(items.filter((item) => !item.isArchived));
    });

    return () => {
      checklistSubscriptionVersionRef.current += 1;
      unsubscribe();
    };
  }, [initializing, userId]);

  async function loadTemplateRows(uid: string) {
    try {
      const templates = await getChecklistTemplates(uid);

      const rows = await Promise.all(
        templates.map(async (template) => {
          const items = await getChecklistTemplateItems(uid, template.id);
          const totalCount = items.length;
          const packedCount = items.filter((item) => item.packed).length;
          const missingCount = totalCount - packedCount;

          return {
            id: `template:${template.id}`,
            name: template.name,
            templateId: template.id,
            category: template.category,
            customCategoryLabel: template.customCategoryLabel ?? "",
            status: "active" as const,
            packedCount,
            totalCount,
            missingCount,
            vehicleId: null,
            tripId: null,
            isArchived: false,
            createdAt: template.createdAt,
            updatedAt: template.updatedAt,
          };
        })
      );

      if (isMountedRef.current) {
        setTemplateRows(rows);
      }
    } catch (err) {
      console.error("Failed to load checklist templates:", err);

      if (isMountedRef.current) {
        setTemplateRows([]);
      }
    }
  }

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
      if (!isMountedRef.current) return;

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
    if (!lockAcquired) return;

    void runWithLock(action);
  }

  const combinedChecklists = useMemo(() => {
    return [
      ...checklists.map(c => ({ ...c, _type: "checklist" })),
      ...templateRows.map(t => ({ ...t, _type: "template" })),
    ];
  }, [checklists, templateRows]);

  const sortedChecklists = useMemo(() => {
    return [...combinedChecklists].sort((a, b) => {
      const aIsPacked =
        (a.totalCount ?? 0) > 0 && (a.missingCount ?? 0) === 0;
      const bIsPacked =
        (b.totalCount ?? 0) > 0 && (b.missingCount ?? 0) === 0;

      if (aIsPacked !== bIsPacked) {
        return aIsPacked ? 1 : -1;
      }

      const aName = String(a.name ?? "").trim().toLowerCase();
      const bName = String(b.name ?? "").trim().toLowerCase();

      return aName.localeCompare(bName);
    });
  }, [combinedChecklists]);

  const activeChecklistCount = useMemo(
    () => combinedChecklists.length,
    [combinedChecklists]
  );

  const packedCount = useMemo(() => {
    return combinedChecklists.filter(
      (checklist) =>
        (checklist.totalCount ?? 0) > 0 && (checklist.missingCount ?? 0) === 0
    ).length;
  }, [combinedChecklists]);

  const toPackCount = useMemo(() => {
    return combinedChecklists.filter(
      (checklist) =>
        (checklist.totalCount ?? 0) === 0 || (checklist.missingCount ?? 0) > 0
    ).length;
  }, [combinedChecklists]);

  function handleOpenChecklist(checklistId: string) {
    runNavigationAction(() => {
      if (checklistId.startsWith("template:")) {
        const templateId = checklistId.replace("template:", "");

        router.push(`/checklists/template-items?templateId=${templateId}`);
        return;
      }

      router.push({
        pathname: "/checklists/[checklistId]",
        params: { checklistId },
      });
    });
  }

  function handleCreateBlankChecklist() {
    runNavigationAction(() => {
      router.push("/checklists/new");
    });
  }

  function handleCreateTemplate() {
    runNavigationAction(() => {
      router.push("/checklists/create-template");
    });
  }

  function handleManageTemplates() {
    runNavigationAction(() => {
      router.push("/checklists/templates");
    });
  }

  const displayedChecklists = useMemo(() => {
    if (selectedChecklistStatus === "packed") {
      return sortedChecklists.filter(
        (checklist) =>
          (checklist.totalCount ?? 0) > 0 && (checklist.missingCount ?? 0) === 0
      );
    }

    if (selectedChecklistStatus === "toPack") {
      return sortedChecklists.filter(
        (checklist) =>
          (checklist.totalCount ?? 0) === 0 || (checklist.missingCount ?? 0) > 0
      );
    }

    return sortedChecklists;
  }, [selectedChecklistStatus, sortedChecklists]);

  function handleSelectChecklistStatus(
    nextStatus: "active" | "packed" | "toPack"
  ) {
    setSelectedChecklistStatus(nextStatus);
  }

  const selectedChecklistTitle =
    selectedChecklistStatus === "packed"
      ? "Packed Checklists"
      : selectedChecklistStatus === "toPack"
        ? "To Pack Checklists"
        : "Active Checklists";

  const navigationDisabled =
    interactionLocked || navigationTransitionLockedRef.current;

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            isTablet && {
              maxWidth: isLandscape ? 1100 : 900,
              width: "100%",
              alignSelf: "center",
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {isTablet && isLandscape ? (
            <>
              <View style={styles.headerWrapCentered}>
                <ThemedText
                  variant="header"
                  style={[styles.headerTitle, styles.whiteLabel]}
                >
                  Checklists
                </ThemedText>
              </View>

              <View style={styles.tabletLandscapeLayout}>
                <View style={styles.tabletLeftColumn}>
                  <View style={styles.heroSection}>
                    <ThemedText style={[styles.heroSubtitle, styles.whiteLabelMuted]}>
                      Start from a blank checklist or template, track progress, and
                      keep your gear organized.
                    </ThemedText>
                  </View>

                  <View style={[styles.statsRow, styles.tabletStatsRow]}>
                    <StatCard
                      icon={<ClipboardList size={18} color={theme.colors.text} />}
                      value={activeChecklistCount}
                      label="Active"
                      tone={{
                        borderColor: "rgba(59,130,246,0.95)",
                        backgroundColor: "rgba(37,99,235,0.28)",
                        textColor: "rgb(59,130,246)",
                      }}
                      selected={selectedChecklistStatus === "active"}
                      onPress={() => handleSelectChecklistStatus("active")}
                      disabled={false}
                    />

                    <StatCard
                      icon={<CheckCircle2 size={18} color={theme.colors.text} />}
                      value={packedCount}
                      label="Packed"
                      tone={{
                        borderColor: "rgba(34,197,94,0.95)",
                        backgroundColor: "rgba(34,197,94,0.24)",
                        textColor: "rgb(34,197,94)",
                      }}
                      selected={selectedChecklistStatus === "packed"}
                      onPress={() => handleSelectChecklistStatus("packed")}
                      disabled={false}
                    />

                    <StatCard
                      icon={<ListChecks size={18} color={theme.colors.text} />}
                      value={toPackCount}
                      label="To Pack"
                      tone={{
                        borderColor: "rgba(255,76,76,0.98)",
                        backgroundColor: "rgba(120,20,32,0.34)",
                        textColor: "rgb(255,110,110)",
                      }}
                      selected={selectedChecklistStatus === "toPack"}
                      onPress={() => handleSelectChecklistStatus("toPack")}
                      disabled={false}
                    />
                  </View>

                  <View style={styles.sectionWrap}>
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
                      disabled={navigationDisabled}
                    />

                    <ActionCard
                      icon={<SquarePen size={22} color={theme.colors.text} />}
                      title="Create Template"
                      subtitle="Build reusable checklist templates"
                      onPress={handleCreateTemplate}
                      disabled={navigationDisabled}
                    />

                    <ActionCard
                      icon={<FolderCog size={22} color={theme.colors.text} />}
                      title="Manage Templates"
                      subtitle="Rename and delete your saved checklist templates"
                      onPress={handleManageTemplates}
                      disabled={navigationDisabled}
                    />
                  </View>
                </View>

                <View style={styles.tabletRightColumn}>
                  <View style={styles.sectionWrap}>
                    <ThemedText
                      variant="title"
                      style={[styles.sectionTitle, styles.whiteLabel]}
                    >
                      {selectedChecklistTitle} ({displayedChecklists.length})
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
                  ) : displayedChecklists.length === 0 ? (
                    <EmptyChecklistCard
                      title="No checklists yet"
                      text="Create your first checklist to track what is packed and what still needs to be packed."
                      showAction
                      onPress={handleCreateBlankChecklist}
                      disabled={navigationDisabled}
                    />
                  ) : (
                    displayedChecklists.map((checklist) => (
                      <ThemedCard
                        key={checklist.id}
                        style={[
                          styles.checklistCard,
                          ...((checklist.totalCount ?? 0) > 0 &&
                            (checklist.missingCount ?? 0) === 0
                            ? [styles.packedChecklistCard]
                            : []),
                        ]}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                          <HapticPressable
                            style={[
                              styles.row,
                              { flex: 1, minWidth: 0 },
                              navigationDisabled && styles.disabledInteraction,
                            ]}
                            onPress={() => handleOpenChecklist(checklist.id)}
                            disabled={navigationDisabled}
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
                                <ThemedText
                                  color="secondary"
                                  style={[
                                    styles.meta,
                                    selectedChecklistStatus === "packed" &&
                                    styles.packedProgressText,
                                  ]}
                                >
                                  {checklist.packedCount ?? 0} / {checklist.totalCount ?? 0} packed
                                </ThemedText>

                                {(checklist.totalCount ?? 0) > 0 && (checklist.missingCount ?? 0) === 0 ? (
                                  <ThemedText style={styles.packedBadge}>
                                    Packed
                                  </ThemedText>
                                ) : (
                                  <ThemedText color="danger" style={styles.toPackBadge}>
                                    {checklist.missingCount ?? 0} to pack
                                  </ThemedText>
                                )}
                              </View>
                            </View>

                            <ChevronRight size={18} color={theme.colors.textSecondary} />
                          </HapticPressable>

                          <HapticPressable
                            onPress={() => {
                              Alert.alert(
                                checklist._type === "template"
                                  ? "Archive Template"
                                  : "Archive Checklist",
                                checklist._type === "template"
                                  ? `Archive "${checklist.name}"? You can restore it later from Archive.`
                                  : `Archive "${checklist.name}"? You can restore it later from Archive.`,
                                [
                                  { text: "Cancel", style: "cancel" },
                                  {
                                    text: "Archive",
                                    style: "default",
                                    onPress: async () => {
                                      console.log("DELETE CLICKED:", checklist.id);

                                      if (checklist._type === "template") {
                                        const templateId = checklist.id.replace("template:", "");

                                        await archiveChecklistTemplate(userId, templateId);

                                        setTemplateRows((prev) =>
                                          prev.filter((t) => t.id !== checklist.id)
                                        );
                                      } else {
                                        await archiveChecklist(userId, checklist.id);

                                        setChecklists((prev) =>
                                          prev.filter((c) => c.id !== checklist.id)
                                        );
                                      }

                                      console.log("DELETE COMPLETE:", checklist.id);
                                    }
                                  },
                                ]
                              );
                            }}
                            style={{
                              width: 44,
                              height: 44,
                              justifyContent: "center",
                              alignItems: "center",
                              flexShrink: 0,
                            }}
                            disabled={navigationDisabled}
                          >
                            <Archive size={18} color="#F59E0B" />
                          </HapticPressable>

                          <HapticPressable
                            onPress={() => {
                              Alert.alert(
                                checklist._type === "template"
                                  ? "Delete Template"
                                  : "Delete Checklist",
                                `Permanently delete "${checklist.name}"? This cannot be undone.`,
                                [
                                  { text: "Cancel", style: "cancel" },
                                  {
                                    text: "Delete",
                                    style: "destructive",
                                    onPress: async () => {
                                      if (checklist._type === "template") {
                                        const templateId = checklist.id.replace("template:", "");
                                        await deleteChecklistTemplate(userId, templateId);

                                        setTemplateRows((prev) =>
                                          prev.filter((t) => t.id !== checklist.id)
                                        );
                                      } else {
                                        await deleteChecklist(userId, checklist.id);

                                        setChecklists((prev) =>
                                          prev.filter((c) => c.id !== checklist.id)
                                        );
                                      }
                                    },
                                  },
                                ]
                              );
                            }}
                            style={{
                              width: 44,
                              height: 44,
                              justifyContent: "center",
                              alignItems: "center",
                              flexShrink: 0,
                            }}
                            disabled={navigationDisabled}
                          >
                            <Trash2 size={18} color="#EF4444" />
                          </HapticPressable>
                        </View>
                      </ThemedCard>
                    ))
                  )}
                </View>
              </View>
            </>
          ) : (
            <>
              <View style={styles.headerWrap}>
                <ThemedText
                  variant="header"
                  style={[styles.headerTitle, styles.whiteLabel]}
                >
                  Checklists
                </ThemedText>
              </View>

              <View style={styles.heroSection}>
                <ThemedText style={[styles.heroSubtitle, styles.whiteLabelMuted]}>
                  Start from a blank checklist or template, track progress, and
                  keep your gear organized.
                </ThemedText>
              </View>

              <View style={styles.statsRow}>
                <StatCard
                  icon={<ClipboardList size={18} color={theme.colors.text} />}
                  value={activeChecklistCount}
                  label="Active"
                  tone={{
                    borderColor: "rgba(59,130,246,0.95)",
                    backgroundColor: "rgba(37,99,235,0.28)",
                    textColor: "rgb(59,130,246)",
                  }}
                  selected={selectedChecklistStatus === "active"}
                  onPress={() => handleSelectChecklistStatus("active")}
                  disabled={false}
                />

                <StatCard
                  icon={<CheckCircle2 size={18} color={theme.colors.text} />}
                  value={packedCount}
                  label="Packed"
                  tone={{
                    borderColor: "rgba(34,197,94,0.95)",
                    backgroundColor: "rgba(34,197,94,0.24)",
                    textColor: "rgb(34,197,94)",
                  }}
                  selected={selectedChecklistStatus === "packed"}
                  onPress={() => handleSelectChecklistStatus("packed")}
                  disabled={false}
                />

                <StatCard
                  icon={<ListChecks size={18} color={theme.colors.text} />}
                  value={toPackCount}
                  label="To Pack"
                  tone={{
                    borderColor: "rgba(255,76,76,0.98)",
                    backgroundColor: "rgba(120,20,32,0.34)",
                    textColor: "rgb(255,110,110)",
                  }}
                  selected={selectedChecklistStatus === "toPack"}
                  onPress={() => handleSelectChecklistStatus("toPack")}
                  disabled={false}
                />
              </View>

              <View style={styles.sectionWrap}>
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
                  disabled={navigationDisabled}
                />

                <ActionCard
                  icon={<SquarePen size={22} color={theme.colors.text} />}
                  title="Create Template"
                  subtitle="Build reusable checklist templates"
                  onPress={handleCreateTemplate}
                  disabled={navigationDisabled}
                />

                <ActionCard
                  icon={<FolderCog size={22} color={theme.colors.text} />}
                  title="Manage Templates"
                  subtitle="Rename and delete your saved checklist templates"
                  onPress={handleManageTemplates}
                  disabled={navigationDisabled}
                />
              </View>

              <View style={styles.sectionWrap}>
                <ThemedText
                  variant="title"
                  style={[styles.sectionTitle, styles.whiteLabel]}
                >
                  {selectedChecklistTitle} ({displayedChecklists.length})
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
              ) : displayedChecklists.length === 0 ? (
                <EmptyChecklistCard
                  title="No checklists yet"
                  text="Create your first checklist to track what is packed and what still needs to be packed."
                  showAction
                  onPress={handleCreateBlankChecklist}
                  disabled={navigationDisabled}
                />
              ) : (
                displayedChecklists.map((checklist) => (
                  <ThemedCard
                    key={checklist.id}
                    style={[
                      styles.checklistCard,
                      ...((checklist.totalCount ?? 0) > 0 &&
                        (checklist.missingCount ?? 0) === 0
                        ? [styles.packedChecklistCard]
                        : []),
                    ]}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>

                      {/* LEFT CONTENT */}
                      <HapticPressable
                        style={[
                          styles.row,
                          { flex: 1, minWidth: 0 },
                          navigationDisabled && styles.disabledInteraction,
                        ]}
                        onPress={() => handleOpenChecklist(checklist.id)}
                        disabled={navigationDisabled}
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
                            <ThemedText
                              color="secondary"
                              style={[
                                styles.meta,
                                selectedChecklistStatus === "packed" &&
                                styles.packedProgressText,
                              ]}
                            >
                              {checklist.packedCount ?? 0} / {checklist.totalCount ?? 0} packed
                            </ThemedText>

                            {(checklist.totalCount ?? 0) > 0 && (checklist.missingCount ?? 0) === 0 ? (
                              <ThemedText style={styles.packedBadge}>
                                Packed
                              </ThemedText>
                            ) : (
                              <ThemedText color="danger" style={styles.toPackBadge}>
                                {checklist.missingCount ?? 0} to pack
                              </ThemedText>
                            )}
                          </View>
                        </View>

                        <ChevronRight size={18} color={theme.colors.textSecondary} />
                      </HapticPressable>

                      {/* DELETE ACTION */}
                      <HapticPressable
                        onPress={() => {
                          Alert.alert(
                            checklist._type === "template"
                              ? "Archive Template"
                              : "Archive Checklist",
                            checklist._type === "template"
                              ? `Archive "${checklist.name}"? You can restore it later from Archive.`
                              : `Archive "${checklist.name}"? You can restore it later from Archive.`,
                            [
                              { text: "Cancel", style: "cancel" },
                              {
                                text: "Archive",
                                style: "default",
                                onPress: async () => {
                                  console.log("DELETE CLICKED:", checklist.id);

                                  if (checklist._type === "template") {
                                    const templateId = checklist.id.replace("template:", "");

                                    await archiveChecklistTemplate(userId, templateId);

                                    setTemplateRows((prev) =>
                                      prev.filter((t) => t.id !== checklist.id)
                                    );
                                  } else {
                                    await archiveChecklist(userId, checklist.id);

                                    setChecklists((prev) =>
                                      prev.filter((c) => c.id !== checklist.id)
                                    );
                                  }

                                  console.log("DELETE COMPLETE:", checklist.id);
                                }
                              },
                            ]
                          );
                        }}
                        style={{
                          width: 44,
                          height: 44,
                          justifyContent: "center",
                          alignItems: "center",
                          flexShrink: 0,
                        }}
                        disabled={navigationDisabled}
                      >
                        <Archive size={18} color="#F59E0B" />
                      </HapticPressable>

                      <HapticPressable
                        onPress={() => {
                          Alert.alert(
                            checklist._type === "template"
                          ? "Delete Template"
                          : "Delete Checklist",
                            `Permanently delete "${checklist.name}"? This cannot be undone.`,
                            [
                          { text: "Cancel", style: "cancel" },
                          {
                            text: "Delete",
                            style: "destructive",
                            onPress: async () => {
                              if (checklist._type === "template") {
                            const templateId = checklist.id.replace("template:", "");
                            await deleteChecklistTemplate(userId, templateId);

                            setTemplateRows((prev) =>
                              prev.filter((t) => t.id !== checklist.id)
                            );
                              } else {
                            await deleteChecklist(userId, checklist.id);

                            setChecklists((prev) =>
                              prev.filter((c) => c.id !== checklist.id)
                            );
                              }
                            },
                          },
                            ]
                          );
                        }}
                        style={{
                          width: 44,
                          height: 44,
                          justifyContent: "center",
                          alignItems: "center",
                          flexShrink: 0,
                        }}
                        disabled={navigationDisabled}
                          >
                        <Trash2 size={18} color="#EF4444" />
                          </HapticPressable>

                    </View>
                  </ThemedCard>
                ))
              )}
            </>
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
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 120,
  },

  tabletLandscapeLayout: {
    flexDirection: "row",
    gap: 16,
    alignItems: "flex-start",
  },

  tabletLeftColumn: {
    flex: 1,
    minWidth: 0,
  },

  tabletRightColumn: {
    flex: 1,
    minWidth: 0,
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
    marginBottom: 6,
  },

  headerWrapCentered: {
    alignItems: "center",
    marginBottom: 18,
  },

  headerTitle: {
    textAlign: "center",
  },

  heroSection: {
    marginBottom: 14,
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

  tabletStatsRow: {
    maxWidth: 520,
  },

  statCardWrap: {
    flex: 1,
    borderRadius: 14,
    overflow: "hidden",
  },

  statCard: {
    minHeight: 78,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 8,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },

  statIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    marginBottom: 6,
  },

  statValue: {
    marginBottom: 0,
    fontSize: 16,
    lineHeight: 18,
    textAlign: "center",
  },

  statLabel: {
    fontWeight: "800",
    fontSize: 12,
    lineHeight: 14,
    textAlign: "center",
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

  packedBadge: {
    color: "rgb(34,197,94)",
    fontWeight: "800",
  },

  packedProgressText: {
    color: "rgb(34,197,94)",
    fontWeight: "800",
  },

  packedChecklistCard: {
    borderColor: "rgba(34,197,94,0.95)",
    borderWidth: 1.5,
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