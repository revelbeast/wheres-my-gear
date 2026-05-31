import { Document, Packer, Paragraph, TextRun } from "docx";
import { BlurView } from "expo-blur";
import * as FileSystem from "expo-file-system/legacy";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import { router, useFocusEffect } from "expo-router";
import { collection, getDocs } from "firebase/firestore";
import {
  Archive,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileText,
  FolderPlus,
  ListChecks,
  Mic,
  Plus,
  Search,
  Share,
  UserCircle2
} from "lucide-react-native";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Image,
  Modal,
  Share as NativeShare,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const DASHBOARD_SEARCH_KEYBOARD_ACCESSORY_ID =
  "dashboard-search-keyboard-accessory";

import { useAuth } from "../../components/auth/AuthProvider";
import HapticPressable from "../../components/ui/HapticPressable";
import KeyboardDismissAccessory from "../../components/ui/KeyboardDismissAccessory";
import ScreenBackground from "../../components/ui/ScreenBackground";
import {
  ThemedButton,
  ThemedCard,
  ThemedText,
  useThemedValues,
} from "../../components/ui/Themed";
import { db } from "../../firebaseConfig";
import {
  getAssignedChecklistItems,
  getChecklistTemplateItems,
  getChecklistTemplates,
  type AssignedChecklistItemSummary,
} from "../../lib/checklistsService";
import {
  Compartment,
  createItem,
  getAllItems,
  getCompartments,
  getStorageSpaces,
  Item,
  StorageSpace,
} from "../../lib/gearService";
import { getTrips } from "../../lib/tripsService";
import { triggerSuccessHaptic } from "../../lib/haptics";
import { isPremiumPlusUser, isPremiumUser } from "../../lib/revenuecat";
import { getProfileSettings } from "../../lib/settingsService";
import { useDeviceLayout } from "../../lib/useDeviceLayout";
import { useInteractionLock } from "../../lib/useInteractionLock";
import type {
  Checklist,
  ChecklistTemplate,
  ChecklistTemplateItem,
} from "../../types/checklists";

type TemplateSearchItem = ChecklistTemplateItem & {
  templateId: string;
  templateName: string;
};

type SearchResultItem =
  | {
    type: "item";
    id: string;
    name: string;
    subtitle: string;
    statusLabel: "Packed" | "To Pack";
    compartmentId: string;
    vehicleId: string;
  }
  | {
    type: "checklistItem";
    id: string;
    name: string;
    subtitle: string;
    checklistId: string;
    statusLabel: "Packed" | "To Pack";
  }
  | {
    type: "templateItem";
    id: string;
    name: string;
    subtitle: string;
    templateId: string;
  }
  | {
    type: "storage";
    id: string;
    name: string;
    subtitle: string;
    vehicleId: string;
  }
  | {
    type: "compartment";
    id: string;
    name: string;
    subtitle: string;
    compartmentId: string;
    vehicleId: string;
  }
  | {
    type: "checklist";
    id: string;
    name: string;
    subtitle: string;
    checklistId: string;
    statusLabel: "Packed" | "To Pack";
  };

type VoiceDetectedItem = {
  id: string;
  name: string;
  quantity: number;
};

type VoiceAddReview = {
  items: VoiceDetectedItem[];
  destinationName: string;
};

type VoiceAddLocationOption = {
  id: string;
  type: "storage" | "compartment";
  name: string;
  storageId: string;
  storageName: string;
  compartmentId?: string;
  compartmentName?: string;
};

type QuickCompartment = {
  id: string;
  name: string;
  itemCount: number;
};

type UpcomingTrip = {
  id: string;
  name: string;
  date: Date;
};

type StatTone = "default" | "success" | "danger";

const LABEL_WHITE = "#FFFFFF";

function FrostedCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: any;
}) {
  return (
    <ThemedCard
      style={[styles.frostedCard, style]}
      contentStyle={styles.frostedCardContent}
    >
      {children}
    </ThemedCard>
  );
}

function NoteCard({
  icon,
  title,
  onPress,
  disabled = false,
}: {
  icon: React.ReactNode;
  title: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <HapticPressable
      style={[styles.statPressable, disabled && styles.disabledInteraction]}
      onPress={onPress}
      disabled={disabled}
    >
      <BlurView
        intensity={20}
        tint="dark"
        style={[
          styles.statCard,
          {
            borderColor: "rgba(250,204,21,0.95)",
            backgroundColor: "rgba(250,204,21,0.24)",
            shadowColor: "rgba(250,204,21,0.95)",
            shadowOpacity: 0.48,
            shadowRadius: 16,
            shadowOffset: {
              width: 0,
              height: 0,
            },
            elevation: 8,
          },
        ]}
      >
        <View style={styles.statInner}>
          <View style={[styles.statIconWrap, styles.noteIconWrap]}>{icon}</View>

          <View style={styles.statTextWrap}>
            <ThemedText
              variant="small"
              style={[styles.noteTitle, styles.statTextWhite]}
            >
              {title}
            </ThemedText>
          </View>
        </View>
      </BlurView>
    </HapticPressable>
  );
}

function StatCard({
  icon,
  value,
  label,
  tone = "default",
  onPress,
  disabled = false,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  tone?: StatTone;
  onPress: () => void;
  disabled?: boolean;
}) {
  const toneStyles =
    tone === "success"
      ? {
        card: styles.statCardSuccess,
        iconWrap: styles.statIconWrapSuccess,
      }
      : tone === "danger"
        ? {
          card: styles.statCardDanger,
          iconWrap: styles.statIconWrapDanger,
        }
        : {
          card: styles.statCardDefault,
          iconWrap: styles.statIconWrapDefault,
        };

  const cardOverride =
    tone === "success"
      ? {
        borderColor: "rgba(34,197,94,0.95)",
        backgroundColor: "rgba(34,197,94,0.24)",
        shadowColor: "rgba(34,197,94,0.95)",
        shadowOpacity: 0.48,
        shadowRadius: 16,
        shadowOffset: {
          width: 0,
          height: 0,
        },
        elevation: 8,
      }
      : tone === "danger"
        ? {
          borderColor: "rgba(239,68,68,0.95)",
          backgroundColor: "rgba(239,68,68,0.24)",
          shadowColor: "rgba(239,68,68,0.95)",
          shadowOpacity: 0.48,
          shadowRadius: 16,
          shadowOffset: {
            width: 0,
            height: 0,
          },
          elevation: 8,
        }
        : null;

  return (
    <HapticPressable
      style={[styles.statPressable, disabled && styles.disabledInteraction]}
      onPress={onPress}
      disabled={disabled}
    >
      <BlurView
        intensity={20}
        tint="dark"
        style={[styles.statCard, toneStyles.card, cardOverride]}
      >
        <View style={styles.statInner}>
          <View style={[styles.statIconWrap, toneStyles.iconWrap]}>{icon}</View>

          <View style={styles.statTextWrap}>
            <ThemedText
              variant="header"
              style={[styles.statValue, styles.statTextWhite]}
            >
              {value}
            </ThemedText>

            <ThemedText
              variant="small"
              style={[styles.statLabel, styles.statTextWhite]}
            >
              {label}
            </ThemedText>
          </View>
        </View>
      </BlurView>
    </HapticPressable>
  );
}

function getItemQuantity(item: Item) {
  const qty = Number(item.quantity ?? 1);
  return Number.isFinite(qty) && qty > 0 ? qty : 1;
}

function isPackedItem(item: Item) {
  return item.status === "packed";
}

function escapeCsvValue(value: string | number) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function buildDashboardStorageCsv(
  selectedStorageSpaces: StorageSpace[],
  compartments: Compartment[],
  items: Item[]
) {
  const rows = [
    [
      "Storage Space",
      "Compartment",
      "Item Name",
      "Quantity",
      "Status",
      "Notes",
    ],
  ];

  selectedStorageSpaces.forEach((storage) => {
    const storageCompartments = compartments.filter(
      (compartment) => compartment.vehicleId === storage.id
    );

    storageCompartments.forEach((compartment) => {
      const compartmentItems = items.filter(
        (item) => item.compartmentId === compartment.id
      );

      if (compartmentItems.length === 0) {
        rows.push([
          storage.name,
          compartment.name,
          "",
          "",
          "",
          "",
        ]);
        return;
      }

      compartmentItems.forEach((item) => {
        rows.push([
          storage.name,
          compartment.name,
          item.name,
          String(getItemQuantity(item)),
          item.status,
          item.notes ?? "",
        ]);
      });
    });
  });

  return rows
    .map((row) => row.map((value) => escapeCsvValue(value)).join(","))
    .join("\n");
}

function buildDashboardChecklistCsv(
  selectedChecklists: Checklist[],
  checklistItems: AssignedChecklistItemSummary[]
) {
  const rows = [
    [
      "Checklist",
      "Item Name",
      "Quantity",
      "Packed",
      "Assigned Compartment",
      "Notes",
    ],
  ];

  selectedChecklists.forEach((checklist) => {
    const items = checklistItems.filter(
      (item) => item.checklistId === checklist.id
    );

    items.forEach((item) => {
      rows.push([
        checklist.name,
        item.name,
        String(item.quantity),
        item.packed ? "Yes" : "No",
        item.compartmentName ?? "",
        item.notes ?? "",
      ]);
    });
  });

  return rows
    .map((row) => row.map((value) => escapeCsvValue(value)).join(","))
    .join("\n");
}

function normalizeSearchValue(value: string) {
  return value.trim().toLowerCase();
}

function searchIncludes(query: string, values: Array<string | undefined | null>) {
  return values.some((value) =>
    normalizeSearchValue(String(value ?? "")).includes(query)
  );
}

function parseTripDate(value: unknown): Date | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    const parsed = (value as { toDate: () => Date }).toDate();
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

function getStartOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getTripCountdownText(date: Date) {
  const today = getStartOfDay(new Date());
  const tripDay = getStartOfDay(date);
  const diffMs = tripDay.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / 86400000);

  if (diffDays === 0) {
    return "Today";
  }

  if (diffDays === 1) {
    return "Tomorrow";
  }

  return `In ${diffDays} days`;
}

function formatTripDate(date: Date) {
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function DashboardScreen() {
  const { user, initializing } = useAuth();
  const theme = useThemedValues();
  const { isTablet, isLandscape } = useDeviceLayout();
  const shouldUseDashboardSearchAccessory = Platform.OS === "ios" && !isTablet;
  const isTabletLandscape = isTablet && isLandscape;
  const {
    isLocked: interactionLocked,
    lock: lockInteraction,
    unlock: unlockInteraction,
  } = useInteractionLock(450);

  const navigationTransitionLockedRef = useRef(false);
  const navigationUnlockTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const [, forceNavigationStateRefresh] = useState(0);
  const isMountedRef = useRef(true);
  const quickActionColors = {
    scan: "#3B82F6",
    addItem: "#22C55E",
    compartment: "#A855F7",
    storage: "#06B6D4",
    trip: "#F59E0B",
    export: "#94A3B8",
  };
  const dashboardLoadVersionRef = useRef(0);
  const storageSelectionVersionRef = useRef(0);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [isPremiumPlus, setIsPremiumPlus] = useState(false);
  const [isPremiumLoading, setIsPremiumLoading] = useState(true);

  const [storageSpaces, setStorageSpaces] = useState<StorageSpace[]>([]);
  const [selectedStorageId, setSelectedStorageId] = useState<string | null>(null);
  const [showStorageDropdown, setShowStorageDropdown] = useState(false);

  const [allItems, setAllItems] = useState<Item[]>([]);
  const [allCompartments, setAllCompartments] = useState<Compartment[]>([]);
  const [allChecklists, setAllChecklists] = useState<Checklist[]>([]);
  const [allChecklistItems, setAllChecklistItems] = useState<
    AssignedChecklistItemSummary[]
  >([]);
  const [allTemplates, setAllTemplates] = useState<ChecklistTemplate[]>([]);
  const [allTemplateItems, setAllTemplateItems] = useState<TemplateSearchItem[]>(
    []
  );
  const [selectedCompartments, setSelectedCompartments] = useState<Compartment[]>(
    []
  );
  const [quickCompartments, setQuickCompartments] = useState<QuickCompartment[]>(
    []
  );
  const [upcomingTrips, setUpcomingTrips] = useState<UpcomingTrip[]>([]);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [voiceAddModalVisible, setVoiceAddModalVisible] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [voiceAddReview, setVoiceAddReview] = useState<VoiceAddReview | null>(
    null
  );
  const [selectedVoiceLocationId, setSelectedVoiceLocationId] = useState<
    string | null
  >(null);
  const [showAllVoiceLocations, setShowAllVoiceLocations] = useState(false);
  const [isSavingVoiceItems, setIsSavingVoiceItems] = useState(false);
  const [isVoiceListening, setIsVoiceListening] = useState(false);

  const [exportStep, setExportStep] = useState<
    "category" | "selection" | "compartments" | "format"
  >("category");
  const [exportCategory, setExportCategory] = useState<
    "storageSpaces" | "checklists" | null
  >(null);

  const [selectedExportStorageIds, setSelectedExportStorageIds] = useState<
    string[]
  >([]);
  const [selectedExportChecklistIds, setSelectedExportChecklistIds] = useState<
    string[]
  >([]);
  const [selectedExportCompartmentIds, setSelectedExportCompartmentIds] = useState<
    string[]
  >([]);

  const [profilePhotoUri, setProfilePhotoUri] = useState("");
  const [profilePhotoFailed, setProfilePhotoFailed] = useState(false);

  const nextUpcomingTrip = upcomingTrips[0] ?? null;

  const selectedStorage = useMemo(
    () => storageSpaces.find((space) => space.id === selectedStorageId) ?? null,
    [storageSpaces, selectedStorageId]
  );

  const sortedStorageSpaces = useMemo(
    () => [...storageSpaces].sort((a, b) => a.name.localeCompare(b.name)),
    [storageSpaces]
  );

  const storageDropdownHeight = Math.min(
    sortedStorageSpaces.length * 58,
    260
  );

  const storageNameById = useMemo(() => {
    return new Map(storageSpaces.map((space) => [space.id, space.name]));
  }, [storageSpaces]);

  const compartmentNameById = useMemo(() => {
    return new Map(allCompartments.map((compartment) => [compartment.id, compartment.name]));
  }, [allCompartments]);

  const selectedStorageItems = useMemo(
    () =>
      selectedStorageId
        ? allItems.filter((item) => item.vehicleId === selectedStorageId)
        : [],
    [allItems, selectedStorageId]
  );

  const packedCount = useMemo(
    () =>
      selectedStorageItems
        .filter((item) => isPackedItem(item))
        .reduce((total, item) => total + getItemQuantity(item), 0),
    [selectedStorageItems]
  );

  const toPackCount = useMemo(
    () =>
      selectedStorageItems
        .filter((item) => !isPackedItem(item))
        .reduce((total, item) => total + getItemQuantity(item), 0),
    [selectedStorageItems]
  );

  const hasStorageSpaces = storageSpaces.length > 0;

  const voiceLocationOptions = useMemo<VoiceAddLocationOption[]>(() => {
    const storageOptions = sortedStorageSpaces.map((space) => ({
      id: `storage-${space.id}`,
      type: "storage" as const,
      name: `Storage Space: ${space.name}`,
      storageId: space.id,
      storageName: space.name,
    }));

    const compartmentOptions = allCompartments
      .map((compartment) => {
        const storageName = storageNameById.get(compartment.vehicleId) ?? "";

        return {
          id: `compartment-${compartment.id}`,
          type: "compartment" as const,
          name: storageName
            ? `Compartment: ${compartment.name} (${storageName})`
            : `Compartment: ${compartment.name}`,
          storageId: compartment.vehicleId,
          storageName,
          compartmentId: compartment.id,
          compartmentName: compartment.name,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    return [...storageOptions, ...compartmentOptions];
  }, [allCompartments, sortedStorageSpaces, storageNameById]);

  const suggestedVoiceLocationOptions = useMemo(() => {
    const normalizeLocationText = (value: string) =>
      value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const destination = normalizeLocationText(
      voiceAddReview?.destinationName ?? ""
    );

    if (!destination || destination === "not detected") {
      return [];
    }

    const destinationWords = destination
      .split(/\s+/)
      .filter((word) => word.length >= 2);

    const scored = voiceLocationOptions.map((option, index) => {
      const normalizedStorageName = normalizeLocationText(option.storageName);
      const normalizedCompartmentName = normalizeLocationText(
        option.compartmentName ?? ""
      );
      const searchable = normalizeLocationText(
        [option.storageName, option.compartmentName ?? "", option.name].join(" ")
      );

      const exactScore =
        normalizedStorageName === destination ||
        normalizedCompartmentName === destination
          ? 20
          : 0;

      const phraseScore =
        searchable.includes(destination) || destination.includes(searchable)
          ? 8
          : 0;

      const wordScore = destinationWords.reduce((score, word) => {
        return searchable.split(/\s+/).includes(word) ? score + 3 : score;
      }, 0);

      const startsWithScore = destinationWords.reduce((score, word) => {
        return searchable
          .split(/\s+/)
          .some((candidate) => candidate.startsWith(word))
          ? score + 1
          : score;
      }, 0);

      return {
        option,
        score: exactScore + phraseScore + wordScore + startsWithScore,
        index,
      };
    });

    return scored
      .filter((entry) => entry.score >= 3)
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .slice(0, 5)
      .map((entry) => entry.option);
  }, [voiceAddReview?.destinationName, voiceLocationOptions]);

  useSpeechRecognitionEvent("start", () => {
    console.log("VOICE ADD LISTENING STARTED");
    setIsVoiceListening(true);
  });

  useSpeechRecognitionEvent("end", () => {
    console.log("VOICE ADD LISTENING ENDED");
    setIsVoiceListening(false);
  });

  function buildVoiceAddReview(
    transcript: string
  ): VoiceAddReview | null {
    const normalized = transcript.toLowerCase().trim();

    if (!normalized) {
      return null;
    }

    const quantityWords: Record<string, number> = {
      a: 1,
      an: 1,
      one: 1,
      two: 2,
      three: 3,
      four: 4,
      five: 5,
      six: 6,
      seven: 7,
      eight: 8,
      nine: 9,
      ten: 10,
    };

    const normalizeVoiceItemName = (value: string) => {
      const cleaned = value
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();

      const replacements: Array<[RegExp, string]> = [
        [/\bband[-\s]?aid(s)?\b/g, "band-aid$1"],
        [/\bhead\s*lamp(s)?\b/g, "headlamp$1"],
        [/\bflash\s*light(s)?\b/g, "flashlight$1"],
        [/\bfirst aid (eight|ate|kid)\b/g, "first aid kit"],
        [/\bmed kit\b/g, "first aid kit"],
        [/\bmedical kit\b/g, "first aid kit"],
      ];

      const normalizedItem = replacements.reduce(
        (current, [pattern, replacement]) =>
          current.replace(pattern, replacement),
        cleaned
      );

      return normalizedItem.replace(/\b\w/g, (c) => c.toUpperCase());
    };

    const destinationMatch = normalized.match(
      /\b(?:to|in|into|inside)(?: my)?\s+(.+)$/i
    );
    const itemText = normalized
      .replace(/\bband[-\s]?aid(s)?\b/g, "bandaid$1")
      .replace(/^add\s+/i, "")
      .replace(/\b(?:to|in|into|inside)(?: my)?\s+.+$/i, "")
      .trim();

    const itemMatches = [
      ...itemText.matchAll(
        /(?:(one|two|three|four|five|six|seven|eight|nine|ten|a|an|\d+)\s+)?([a-z\s-]+?)(?:,|\band\b|$)/gi
      ),
    ];

    const items: VoiceDetectedItem[] = itemMatches
      .map((match, index) => {
        const quantityRaw = match[1]?.toLowerCase()?.trim() ?? "1";

        const quantity =
          quantityWords[quantityRaw] ??
          Number(quantityRaw) ??
          1;

        const itemName = match[2]
          ?.trim()
          .replace(/\bbandaid(s)?\b/gi, "band-aid$1")
          .replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten|a|an|\d+)\b/gi, "")
          .replace(/\b(bin|bag|box|container)\b/gi, "")
          .trim();

        if (!itemName) {
          return null;
        }

        return {
          id: `voice-item-${index}`,
          name: normalizeVoiceItemName(itemName),
          quantity,
        };
      })
      .filter(Boolean) as VoiceDetectedItem[];

    return {
      items,
      destinationName: destinationMatch
        ? destinationMatch[1]
            .replace(/\b\w/g, (c) => c.toUpperCase())
        : "Not Detected",
    };
  }

  useSpeechRecognitionEvent("result", (event) => {
    const transcript = event.results
      .map((result) => result.transcript?.trim() ?? "")
      .filter(Boolean)
      .sort((a, b) => b.length - a.length)[0] ?? "";

    console.log("VOICE ADD TRANSCRIPT:", transcript);

    const nextReview = buildVoiceAddReview(transcript);
    const normalizedDestination = nextReview?.destinationName
      .toLowerCase()
      .trim();

    const shouldMatchDestination =
      Boolean(normalizedDestination) &&
      normalizedDestination !== "not detected";

    const matchedLocation = shouldMatchDestination
      ? voiceLocationOptions.find((option) => {
          const storageName = option.storageName.toLowerCase().trim();
          const compartmentName = option.compartmentName?.toLowerCase().trim();

          return (
            storageName === normalizedDestination ||
            compartmentName === normalizedDestination
          );
        })
      : null;

    setVoiceTranscript(transcript);
    setVoiceAddReview(nextReview);
    setSelectedVoiceLocationId(matchedLocation?.id ?? null);
  });

  useSpeechRecognitionEvent("error", (event) => {
    console.log("VOICE ADD ERROR:", event.error, event.message);
    setIsVoiceListening(false);
  });

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      dashboardLoadVersionRef.current += 1;
      storageSelectionVersionRef.current += 1;

      if (navigationUnlockTimeoutRef.current) {
        clearTimeout(navigationUnlockTimeoutRef.current);
        navigationUnlockTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!initializing && !user) {
      router.replace("/sign-in");
    }
  }, [initializing, user]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function checkPremiumAccess() {
        if (initializing) {
          return;
        }

        if (!user) {
          setIsPremium(false);
          setIsPremiumPlus(false);
          setIsPremiumLoading(false);
          return;
        }

        try {
          setIsPremiumLoading(true);

          const [premium, premiumPlus] = await Promise.all([
            isPremiumUser(),
            isPremiumPlusUser(),
          ]);

          if (!isActive) {
            return;
          }

          setIsPremium(premium || premiumPlus);
          setIsPremiumPlus(premiumPlus);
        } catch (error) {
          console.error("RevenueCat premium gate failed:", error);

          if (!isActive) {
            return;
          }

          setIsPremium(false);
          setIsPremiumPlus(false);
        } finally {
          if (isActive) {
            setIsPremiumLoading(false);
          }
        }
      }

      checkPremiumAccess();

      return () => {
        isActive = false;
      };
    }, [initializing, user])
  );

  useFocusEffect(
    useCallback(() => {
      if (initializing || !user || isPremiumLoading) {
        return;
      }

      let isActive = true;
      const activeUserId = user.uid;
      const loadVersion = dashboardLoadVersionRef.current + 1;
      dashboardLoadVersionRef.current = loadVersion;

      loadDashboardData(activeUserId, loadVersion, () => isActive);
      loadProfilePhoto(activeUserId, loadVersion, () => isActive);

      return () => {
        isActive = false;
        dashboardLoadVersionRef.current += 1;
      };
    }, [initializing, user, isPremiumLoading, isPremium])
  );

  async function runWithLock(action: () => Promise<void> | void) {
    if (interactionLocked) return;

    lockInteraction();

    try {
      await action();
    } finally {
      unlockInteraction();
    }
  }

  function isNavigationBusy() {
    return interactionLocked || navigationTransitionLockedRef.current;
  }

  function lockNavigationTransition() {
    if (navigationTransitionLockedRef.current) {
      return false;
    }

    navigationTransitionLockedRef.current = true;
    forceNavigationStateRefresh((value) => value + 1);

    if (navigationUnlockTimeoutRef.current) {
      clearTimeout(navigationUnlockTimeoutRef.current);
      navigationUnlockTimeoutRef.current = null;
    }

    navigationUnlockTimeoutRef.current = setTimeout(() => {
      if (!isMountedRef.current) return;

      navigationTransitionLockedRef.current = false;
      navigationUnlockTimeoutRef.current = null;
      forceNavigationStateRefresh((value) => value + 1);
    }, 1500);

    return true;
  }

  function pushWithNavigationLock(action: () => void) {
    if (isNavigationBusy()) {
      return;
    }

    const lockAcquired = lockNavigationTransition();

    if (!lockAcquired) {
      return;
    }

    action();
  }

  useEffect(() => {
    let isActive = true;

    const runSearch = async () => {
      const trimmed = normalizeSearchValue(searchQuery);

      if (initializing || !user || isPremiumLoading || !isPremium) {
        if (!isActive || !isMountedRef.current) {
          return;
        }

        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      if (!trimmed) {
        if (!isActive || !isMountedRef.current) {
          return;
        }

        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      try {
        if (!isActive || !isMountedRef.current) {
          return;
        }

        setIsSearching(true);

        const itemResults: SearchResultItem[] = allItems
          .filter((item) => {
            const hasOrphanedOfflineCompartment =
              String(item.compartmentId ?? "").startsWith("offline-compartment-") &&
              !item.compartmentName &&
              !compartmentNameById.get(item.compartmentId ?? "");

            if (hasOrphanedOfflineCompartment) {
              return false;
            }

            return searchIncludes(trimmed, [
              item.name,
              item.status === "packed" ? "packed items packed" : "to pack missing",
              item.compartmentName,
              compartmentNameById.get(item.compartmentId ?? ""),
              item.vehicleName,
              storageNameById.get(item.vehicleId ?? ""),
            ]);
          })
          .map((item) => ({
            type: "item",
            id: item.id,
            name: item.name,
            subtitle: `${item.compartmentName ||
              compartmentNameById.get(item.compartmentId ?? "") ||
              "Unassigned compartment"} • ${item.vehicleName ||
              storageNameById.get(item.vehicleId ?? "") ||
              "Unknown storage space"
              }`,
            statusLabel: item.status === "packed" ? "Packed" : "To Pack",
            compartmentId:
              item.compartmentId && !String(item.compartmentId).startsWith("offline-compartment-")
                ? item.compartmentId
                : "",
            vehicleId: item.vehicleId ?? "",
          }));

        const checklistItemResults: SearchResultItem[] = allChecklistItems
          .filter((item) =>
            searchIncludes(trimmed, [
              item.name,
              item.notes,
              item.checklistName,
              item.packed ? "packed checklist item" : "to pack missing checklist item",
              "checklist item",
            ])
          )
          .map((item) => ({
            type: "checklistItem",
            id: item.id,
            name: item.name,
            subtitle: `${item.checklistName} • Checklist item`,
            checklistId: item.checklistId,
            statusLabel: item.packed ? "Packed" : "To Pack",
          }));

        const templateItemResults: SearchResultItem[] = allTemplateItems
          .filter((item) =>
            searchIncludes(trimmed, [
              item.name,
              item.notes,
              item.templateName,
              "template item checklist template",
            ])
          )
          .map((item) => ({
            type: "templateItem",
            id: item.id,
            name: item.name,
            subtitle: `${item.templateName} • Template item`,
            templateId: item.templateId,
          }));

        const storageResults: SearchResultItem[] = storageSpaces
          .filter((space) =>
            searchIncludes(trimmed, [
              space.name,
              space.category,
              space.category === "vehicle" ? "vehicle" : "storage",
              space.subtype,
            ])
          )
          .map((space) => ({
            type: "storage",
            id: space.id,
            name: space.name,
            subtitle: `${space.category === "vehicle"
  ? "Vehicle"
  : space.category === "office"
    ? "Office"
    : "Storage"}${space.subtype ? ` • ${space.subtype}` : ""
              }`,
            vehicleId: space.id,
          }));

        const compartmentResults: SearchResultItem[] = allCompartments
          .filter((compartment) =>
            searchIncludes(trimmed, [
              compartment.name,
              storageNameById.get(compartment.vehicleId),
              "compartment",
            ])
          )
          .map((compartment) => ({
            type: "compartment",
            id: compartment.id,
            name: compartment.name,
            subtitle:
              storageNameById.get(compartment.vehicleId) || "Unknown storage space",
            compartmentId: compartment.id,
            vehicleId: compartment.vehicleId,
          }));

        const checklistResults: SearchResultItem[] = allChecklists
          .filter(
            (checklist) =>
              !checklist.isArchived &&
              searchIncludes(trimmed, [
                checklist.name,
                "checklist",
                (checklist.missingCount ?? 0) > 0 ? "to pack missing" : "packed",
              ])
          )
          .map((checklist) => ({
            type: "checklist",
            id: checklist.id,
            name: checklist.name,
            subtitle: `${checklist.packedCount ?? 0} packed • ${checklist.missingCount ?? 0
              } to pack`,
            checklistId: checklist.id,
            statusLabel: (checklist.missingCount ?? 0) > 0 ? "To Pack" : "Packed",
          }));

        if (!isActive || !isMountedRef.current) {
          return;
        }

        setSearchResults([
          ...itemResults,
          ...checklistItemResults,
          ...templateItemResults,
          ...storageResults,
          ...compartmentResults,
          ...checklistResults,
        ]);
      } catch (error) {
        if (!isActive || !isMountedRef.current) {
          return;
        }

        console.error("Search failed:", error);
        setSearchResults([]);
      } finally {
        if (isActive && isMountedRef.current) {
          setIsSearching(false);
        }
      }
    };

    const timeout = setTimeout(runSearch, 250);

    return () => {
      isActive = false;
      clearTimeout(timeout);
    };
  }, [
    searchQuery,
    initializing,
    user,
    isPremiumLoading,
    isPremium,
    allItems,
    allChecklistItems,
    allTemplateItems,
    storageSpaces,
    allCompartments,
    allChecklists,
    storageNameById,
  ]);

  useEffect(() => {
    if (initializing) {
      return;
    }

    if (!user) {
      if (!isMountedRef.current) return;

      setSearchResults([]);
      setIsSearching(false);
      setIsPremium(false);
      setIsPremiumLoading(false);
      setStorageSpaces([]);
      setSelectedStorageId(null);
      setShowStorageDropdown(false);
      setAllItems([]);
      setAllCompartments([]);
      setAllChecklists([]);
      setAllChecklistItems([]);
      setAllTemplates([]);
      setAllTemplateItems([]);
      setSelectedCompartments([]);
      setQuickCompartments([]);
      setUpcomingTrips([]);
      setProfilePhotoUri("");
      setProfilePhotoFailed(false);
    }
  }, [initializing, user]);

  async function loadProfilePhoto(
    activeUserId: string,
    loadVersion: number,
    isActive: () => boolean
  ) {
    try {
      const profile = await getProfileSettings(activeUserId);

      if (
        !isMountedRef.current ||
        !isActive() ||
        dashboardLoadVersionRef.current !== loadVersion
      ) {
        return;
      }

      setProfilePhotoUri(profile.profilePhotoUri ?? "");
      setProfilePhotoFailed(false);
    } catch (err) {
      if (
        !isMountedRef.current ||
        !isActive() ||
        dashboardLoadVersionRef.current !== loadVersion
      ) {
        return;
      }

      console.error("Failed to load profile photo:", err);
      setProfilePhotoUri("");
      setProfilePhotoFailed(false);
    }
  }

  async function loadDashboardData(
    activeUserId: string,
    loadVersion: number,
    isActive: () => boolean
  ) {
    try {
      const spaces = await getStorageSpaces();
      if (
        !isMountedRef.current ||
        !isActive() ||
        dashboardLoadVersionRef.current !== loadVersion
      ) {
        return;
      }
      setStorageSpaces(spaces);

      const chosenId =
        selectedStorageId && spaces.some((space) => space.id === selectedStorageId)
          ? selectedStorageId
          : spaces[0]?.id ?? null;

      setSelectedStorageId(chosenId);

      const all = await getAllItems();
      if (
        !isMountedRef.current ||
        !isActive() ||
        dashboardLoadVersionRef.current !== loadVersion
      ) {
        return;
      }
      setAllItems(all);

      const loadedTrips = await getTrips(activeUserId);
      if (
        !isMountedRef.current ||
        !isActive() ||
        dashboardLoadVersionRef.current !== loadVersion
      ) {
        return;
      }
      const today = getStartOfDay(new Date());

      const trips = loadedTrips
        .map((trip) => ({
          id: trip.id,
          name: trip.name,
          date: trip.startDate,
        }))
        .filter((trip): trip is UpcomingTrip => {
          return getStartOfDay(trip.date).getTime() >= today.getTime();
        })
        .sort((a, b) => a.date.getTime() - b.date.getTime());

      setUpcomingTrips(trips);

      const compartmentsSnapshot = await getDocs(
        collection(db, "users", activeUserId, "compartments")
      );
      const compartments = compartmentsSnapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as Compartment[];

      if (
        !isMountedRef.current ||
        !isActive() ||
        dashboardLoadVersionRef.current !== loadVersion
      ) {
        return;
      }

      setAllCompartments(compartments);

      const checklistsSnapshot = await getDocs(
        collection(db, "users", activeUserId, "checklists")
      );
      const checklists = checklistsSnapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as Checklist[];

      if (
        !isMountedRef.current ||
        !isActive() ||
        dashboardLoadVersionRef.current !== loadVersion
      ) {
        return;
      }

      setAllChecklists(checklists);

      const assignedChecklistItems = await getAssignedChecklistItems(activeUserId);
      if (
        !isMountedRef.current ||
        !isActive() ||
        dashboardLoadVersionRef.current !== loadVersion
      ) {
        return;
      }
      setAllChecklistItems(assignedChecklistItems);

      const templates = await getChecklistTemplates(activeUserId);
      if (
        !isMountedRef.current ||
        !isActive() ||
        dashboardLoadVersionRef.current !== loadVersion
      ) {
        return;
      }
      setAllTemplates(templates);

      const templateItemsNested = await Promise.all(
        templates.map(async (template) => {
          const items = await getChecklistTemplateItems(activeUserId, template.id);

          return items.map((item) => ({
            ...item,
            templateId: template.id,
            templateName: template.name,
          }));
        })
      );

      if (
        !isMountedRef.current ||
        !isActive() ||
        dashboardLoadVersionRef.current !== loadVersion
      ) {
        return;
      }

      setAllTemplateItems(templateItemsNested.flat());

      if (!chosenId) {
        setSelectedCompartments([]);
        setQuickCompartments([]);
        return;
      }

      const scopedItems = all.filter((item) => item.vehicleId === chosenId);

      const scopedCompartments = await getCompartments(chosenId);
      if (
        !isMountedRef.current ||
        !isActive() ||
        dashboardLoadVersionRef.current !== loadVersion
      ) {
        return;
      }
      setSelectedCompartments(scopedCompartments);

      const quickData = scopedCompartments
        .map((compartment) => ({
          id: compartment.id,
          name: compartment.name,
          itemCount: scopedItems
            .filter((item) => item.compartmentId === compartment.id)
            .reduce((total, item) => total + getItemQuantity(item), 0),
        }))
        .sort((a, b) => b.itemCount - a.itemCount || a.name.localeCompare(b.name))
        .slice(0, 4);

      setQuickCompartments(quickData);
    } catch (err) {
      if (
        !isMountedRef.current ||
        !isActive() ||
        dashboardLoadVersionRef.current !== loadVersion
      ) {
        return;
      }

      console.error("Failed to load dashboard data:", err);

      setStorageSpaces([]);
      setSelectedStorageId(null);
      setAllItems([]);
      setAllCompartments([]);
      setAllChecklists([]);
      setAllChecklistItems([]);
      setAllTemplates([]);
      setAllTemplateItems([]);
      setSelectedCompartments([]);
      setQuickCompartments([]);
      setUpcomingTrips([]);
    }
  }

  async function handleSelectStorage(space: StorageSpace) {
    if (!user || !isPremium || interactionLocked) {
      return;
    }

    const selectionVersion = storageSelectionVersionRef.current + 1;
    storageSelectionVersionRef.current = selectionVersion;

    await runWithLock(async () => {
      try {
        if (!isMountedRef.current) return;

        setSelectedStorageId(space.id);
        setShowStorageDropdown(false);

        const compartments = await getCompartments(space.id);

        if (
          !isMountedRef.current ||
          storageSelectionVersionRef.current !== selectionVersion
        ) {
          return;
        }

        setSelectedCompartments(compartments);

        const scopedItems = allItems.filter((item) => item.vehicleId === space.id);

        const quickData = compartments
          .map((compartment) => ({
            id: compartment.id,
            name: compartment.name,
            itemCount: scopedItems
              .filter((item) => item.compartmentId === compartment.id)
              .reduce((total, item) => total + getItemQuantity(item), 0),
          }))
          .sort((a, b) => b.itemCount - a.itemCount || a.name.localeCompare(b.name))
          .slice(0, 4);

        setQuickCompartments(quickData);
      } catch (err) {
        if (!isMountedRef.current) return;

        console.error("Failed to switch storage space:", err);
      }
    });
  }

  function handleSearchResultPress(item: SearchResultItem) {
    if (!isPremium) {
      router.replace("/paywall");
      return;
    }

    pushWithNavigationLock(() => {
      if (item.type === "item") {
        if (!item.vehicleId || !item.compartmentId) {
          return;
        }

        router.push({
          pathname: "/vehicles/[vehicleId]/compartments/[compartmentId]",
          params: {
            vehicleId: item.vehicleId,
            compartmentId: item.compartmentId,
          },
        });
        return;
      }

      if (item.type === "checklistItem") {
        router.push({
          pathname: "/checklists/[checklistId]",
          params: {
            checklistId: item.checklistId,
          },
        });
        return;
      }

      if (item.type === "templateItem") {
        router.push({
          pathname: "/checklists/template-items",
          params: {
            templateId: item.templateId,
          },
        });
        return;
      }

      if (item.type === "storage") {
        router.push({
          pathname: "/vehicles/[vehicleId]/compartments",
          params: {
            vehicleId: item.vehicleId,
          },
        });
        return;
      }

      if (item.type === "compartment") {
        router.push({
          pathname: "/vehicles/[vehicleId]/compartments/[compartmentId]",
          params: {
            vehicleId: item.vehicleId,
            compartmentId: item.compartmentId,
          },
        });
        return;
      }

      if (item.type === "checklist") {
        router.push({
          pathname: "/checklists/[checklistId]",
          params: {
            checklistId: item.checklistId,
          },
        });
      }
    });
  }

  function handleOpenPackedItems() {
    pushWithNavigationLock(() => {
      router.push({
        pathname: "/(tabs)/inventory",
        params: { status: "packed" },
      });
    });
  }

  function handleOpenToPack() {
    pushWithNavigationLock(() => {
      router.push({
        pathname: "/(tabs)/inventory",
        params: { status: "missing" },
      });
    });
  }

  function handleOpenCompartment(compartmentId: string) {
    if (!selectedStorageId) return;

    pushWithNavigationLock(() => {
      router.push({
        pathname: "/vehicles/[vehicleId]/compartments/[compartmentId]",
        params: {
          vehicleId: selectedStorageId,
          compartmentId,
        },
      });
    });
  }

  function handleOpenAllCompartments() {
    if (!selectedStorageId) return;

    pushWithNavigationLock(() => {
      router.push({
        pathname: "/vehicles/[vehicleId]/compartments",
        params: {
          vehicleId: selectedStorageId,
        },
      });
    });
  }

  function handleAddCompartment() {
    if (!selectedStorageId) return;

    pushWithNavigationLock(() => {
      router.push({
        pathname: "/vehicles/[vehicleId]/compartments/create",
        params: {
          vehicleId: selectedStorageId,
        },
      });
    });
  }

  function handleOpenNotes() {
    pushWithNavigationLock(() => {
      router.push({
        pathname: "/notes",
        params: {
          storageId: selectedStorageId ?? "",
          storageName: selectedStorage?.name ?? "",
        },
      });
    });
  }

  function handleOpenArchive() {
    if (isPremiumPlus) {
      pushWithNavigationLock(() => {
        router.push("/(tabs)/archive");
      });
      return;
    }

    Alert.alert(
      "Unlock Premium +",
      "Archive is a Premium + add-on feature for organizing hidden or completed gear records.",
      [
        {
          text: "Maybe Later",
          style: "cancel",
        },
        {
          text: "Upgrade to Premium +",
          onPress: () => {
            pushWithNavigationLock(() => {
              router.push({
                pathname: "/paywall",
                params: { plan: "premium_plus" },
              });
            });
          },
        },
      ]
    );
  }

  function handleOpenAiScanQuickAction() {
    if (isPremiumPlus) {
      pushWithNavigationLock(() => {
        router.push({
          pathname: "/scan-item",
          params: { mode: "ai" },
        });
      });
      return;
    }

    Alert.alert(
      "Unlock Premium +",
      "AI scanning is a Premium + add-on feature for smart gear recognition and faster item setup.",
      [
        {
          text: "Not Now",
          style: "cancel",
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

  function handleOpenScanQuickAction() {
    if (isPremiumPlus) {
      pushWithNavigationLock(() => {
        router.push("/scan-item");
      });
      return;
    }

    Alert.alert(
      "Unlock Premium +",
      "QR and Barcode scanning is an Add-on feature to unlock smart gear scanning and faster item setup.",
      [
        {
          text: "Maybe Later",
          style: "cancel",
        },
        {
          text: "Upgrade to Premium +",
          onPress: () => {
            pushWithNavigationLock(() => {
              router.push({
                pathname: "/paywall",
                params: { plan: "premium_plus" },
              });
            });
          },
        },
      ]
    );
  }

  function handleOpenVoiceAddQuickAction() {
    if (isPremiumPlus) {
      setVoiceAddModalVisible(true);
      return;
    }

    Alert.alert(
      "Unlock Premium +",
      "Gear Assistant is a Premium + add-on feature for quickly adding gear with voice commands.",
      [
        {
          text: "Not Now",
          style: "cancel",
        },
        {
          text: "Upgrade to Premium +",
          onPress: () => {
            pushWithNavigationLock(() => {
              router.push({
                pathname: "/paywall",
                params: { plan: "premium_plus" },
              });
            });
          },
        },
      ]
    );
  }

  function handleCloseVoiceAddModal() {
    setVoiceAddModalVisible(false);
    setVoiceTranscript("");
    setVoiceAddReview(null);
    setSelectedVoiceLocationId(null);
    setShowAllVoiceLocations(false);
    setIsVoiceListening(false);
  }

  async function handleSaveVoiceItems() {
    if (!voiceAddReview || voiceAddReview.items.length === 0) {
      Alert.alert("Nothing to Save", "Gear Assistant did not detect any items yet.");
      return;
    }

    const selectedLocation = voiceLocationOptions.find(
      (option) => option.id === selectedVoiceLocationId
    );

    if (!selectedLocation) {
      Alert.alert(
        "Choose Save Location",
        "Please choose a storage space or compartment before saving."
      );
      return;
    }

    try {
      setIsSavingVoiceItems(true);

      for (const item of voiceAddReview.items) {
        await createItem({
          name: item.name,
          quantity: item.quantity,
          status: "missing",
          vehicleId: selectedLocation.storageId,
          vehicleName: selectedLocation.storageName,
          compartmentId: selectedLocation.compartmentId ?? "",
          compartmentName: selectedLocation.compartmentName ?? "",
          source: "voice",
        });
      }

      const refreshedItems = await getAllItems();
      setAllItems(refreshedItems);

      const savedLocationName =
        selectedLocation.compartmentName ?? selectedLocation.storageName;

      setVoiceAddModalVisible(false);
      setVoiceTranscript("");
      setVoiceAddReview(null);
      setSelectedVoiceLocationId(null);
      setShowAllVoiceLocations(false);

      const itemSummary = voiceAddReview.items
        .map((item) => `${item.quantity} ${item.name}${
          item.quantity === 1 ? "" : "s"
        }`)
        .join(" and ");

      Alert.alert(
        "Items Added",
        `Added ${itemSummary} to ${savedLocationName}.`,
        [
          {
            text: "View Items",
            onPress: () => {
              pushWithNavigationLock(() => {
                if (selectedLocation.type === "compartment" && selectedLocation.compartmentId) {
                  router.push({
                    pathname: "/vehicles/[vehicleId]/compartments/[compartmentId]",
                    params: {
                      vehicleId: selectedLocation.storageId,
                      compartmentId: selectedLocation.compartmentId,
                    },
                  });
                  return;
                }

                router.push({
                  pathname: "/vehicles/[vehicleId]/compartments",
                  params: {
                    vehicleId: selectedLocation.storageId,
                  },
                });
              });
            },
          },
        ]
      );
    } catch (error) {
      console.log("VOICE ADD SAVE ERROR:", error);
      Alert.alert(
        "Save Failed",
        "Unable to save Gear Assistant items. Please try again."
      );
    } finally {
      setIsSavingVoiceItems(false);
    }
  }

  async function handleVoiceMicPress() {
    try {
      console.log("VOICE ADD MIC PRESSED");

      const result =
        await ExpoSpeechRecognitionModule.requestPermissionsAsync();

      console.log("VOICE PERMISSION RESULT:", result);

      if (!result.granted) {
        Alert.alert(
          "Microphone Permission Needed",
          "Please allow microphone and speech recognition access for Gear Assistant."
        );
        return;
      }

      setVoiceTranscript("");
      setVoiceAddReview(null);
      setSelectedVoiceLocationId(null);
      setShowAllVoiceLocations(false);

      await ExpoSpeechRecognitionModule.start({
        lang: "en-US",
        interimResults: true,
        continuous: false,
      });

      console.log("VOICE ADD START REQUESTED");
    } catch (error) {
      console.log("VOICE ADD START ERROR:", error);

      Alert.alert(
        "Gear Assistant Error",
        "Unable to start voice recognition."
      );

      setIsVoiceListening(false);
    }
  }

  function handleOpenDashboardExport() {
    setExportCategory(null);
    setExportStep("category");
    setExportModalVisible(true);
  }

  function handleCloseDashboardExport() {
    setExportModalVisible(false);
    setExportCategory(null);
    setExportStep("category");
    setSelectedExportStorageIds([]);
    setSelectedExportChecklistIds([]);
    setSelectedExportCompartmentIds([]);
  }

  function toggleExportStorageSelection(storageId: string) {
    setSelectedExportStorageIds((current) =>
      current.includes(storageId)
        ? current.filter((id) => id !== storageId)
        : [...current, storageId]
    );
  }

  function toggleExportChecklistSelection(checklistId: string) {
    setSelectedExportChecklistIds((current) =>
      current.includes(checklistId)
        ? current.filter((id) => id !== checklistId)
        : [...current, checklistId]
    );
  }

  function toggleExportCompartmentSelection(compartmentId: string) {
    setSelectedExportCompartmentIds((current) =>
      current.includes(compartmentId)
        ? current.filter((id) => id !== compartmentId)
        : [...current, compartmentId]
    );
  }

  function handleSelectAllExportItems() {
    if (exportCategory === "storageSpaces") {
      const allStorageIds = storageSpaces.map((space) => space.id);
      const allSelected =
        selectedExportStorageIds.length === allStorageIds.length;

      setSelectedExportStorageIds(
        allSelected ? [] : allStorageIds
      );
      return;
    }

    if (exportCategory === "checklists") {
      const allChecklistIds = allChecklists.map(
        (checklist) => checklist.id
      );
      const allSelected =
        selectedExportChecklistIds.length ===
        allChecklistIds.length;

      setSelectedExportChecklistIds(
        allSelected ? [] : allChecklistIds
      );
    }
  }

  async function handleExportDashboardCsv() {
    await runWithLock(async () => {
      try {
        const selectedStorageSpaces = storageSpaces.filter((space) =>
          selectedExportStorageIds.includes(space.id)
        );

        const selectedChecklists = allChecklists.filter((checklist) =>
          selectedExportChecklistIds.includes(checklist.id)
        );

        const selectedCompartmentsForExport = allCompartments.filter((compartment) =>
          selectedExportCompartmentIds.includes(compartment.id)
        );

        const csv =
          exportCategory === "storageSpaces"
            ? buildDashboardStorageCsv(
              selectedStorageSpaces,
              selectedCompartmentsForExport,
              allItems
            )
            : buildDashboardChecklistCsv(
              selectedChecklists,
              allChecklistItems
            );

        const exportLabel =
          exportCategory === "storageSpaces"
            ? "storage_spaces"
            : "checklists";

        const fileName = `wheres_my_gear_${exportLabel}_export.csv`;
        const fileUri = `${FileSystem.cacheDirectory}${fileName}`;

        await FileSystem.writeAsStringAsync(fileUri, csv, {
          encoding: FileSystem.EncodingType.UTF8,
        });

        await NativeShare.share({
          title: "Where's My Gear Export",
          message: csv,
          url: fileUri,
        });

        handleCloseDashboardExport();
      } catch (error) {
        console.error("Dashboard CSV export failed:", error);

        Alert.alert(
          "Export failed",
          "Something went wrong while exporting your file."
        );
      }
    });
  }

  async function handleExportDashboardDocx() {
    await runWithLock(async () => {
      try {
        const selectedStorageSpaces = storageSpaces.filter((space) =>
          selectedExportStorageIds.includes(space.id)
        );

        const selectedChecklists = allChecklists.filter((checklist) =>
          selectedExportChecklistIds.includes(checklist.id)
        );

        const docChildren: Paragraph[] = [
          new Paragraph({
            children: [
              new TextRun({
                text: "Where's My Gear Export",
                bold: true,
                size: 32,
              }),
            ],
          }),
          new Paragraph({ text: "" }),
        ];

        if (exportCategory === "storageSpaces") {
          selectedStorageSpaces.forEach((storage) => {
            docChildren.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: storage.name,
                    bold: true,
                    size: 28,
                  }),
                ],
              })
            );

            const storageCompartments = allCompartments.filter(
              (compartment) =>
                compartment.vehicleId === storage.id &&
                selectedExportCompartmentIds.includes(compartment.id)
            );

            storageCompartments.forEach((compartment) => {
              docChildren.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `Compartment: ${compartment.name}`,
                      bold: true,
                    }),
                  ],
                })
              );

              const compartmentItems = allItems.filter(
                (item) => item.compartmentId === compartment.id
              );

              if (compartmentItems.length === 0) {
                docChildren.push(new Paragraph({ text: "- No items" }));
                return;
              }

              compartmentItems.forEach((item) => {
                docChildren.push(
                  new Paragraph({
                    text: `- ${item.name} | Qty: ${getItemQuantity(item)} | Status: ${item.status}`,
                  })
                );
              });
            });

            docChildren.push(new Paragraph({ text: "" }));
          });
        }

        if (exportCategory === "checklists") {
          selectedChecklists.forEach((checklist) => {
            docChildren.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: checklist.name,
                    bold: true,
                    size: 28,
                  }),
                ],
              })
            );

            const checklistItems = allChecklistItems.filter(
              (item) => item.checklistId === checklist.id
            );

            if (checklistItems.length === 0) {
              docChildren.push(new Paragraph({ text: "- No checklist items" }));
              return;
            }

            checklistItems.forEach((item) => {
              docChildren.push(
                new Paragraph({
                  text: `- ${item.name} | Qty: ${item.quantity} | Packed: ${item.packed ? "Yes" : "No"
                    }`,
                })
              );
            });

            docChildren.push(new Paragraph({ text: "" }));
          });
        }

        const doc = new Document({
          sections: [
            {
              children: docChildren,
            },
          ],
        });

        const base64 = await Packer.toBase64String(doc);
        const exportLabel =
          exportCategory === "storageSpaces"
            ? "storage_spaces"
            : "checklists";
        const fileName = `wheres_my_gear_${exportLabel}_export.docx`;
        const fileUri = `${FileSystem.cacheDirectory}${fileName}`;

        await FileSystem.writeAsStringAsync(fileUri, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });

        await NativeShare.share({
          title: "Where's My Gear Export",
          url: fileUri,
        });

        handleCloseDashboardExport();
      } catch (error) {
        console.error("Dashboard Word export failed:", error);

        Alert.alert(
          "Export failed",
          "Something went wrong while exporting your Word file."
        );
      }
    });
  }

  async function handleExportDashboardPdf() {
    await runWithLock(async () => {
      try {
        const selectedStorageSpaces = storageSpaces.filter((space) =>
          selectedExportStorageIds.includes(space.id)
        );

        const selectedChecklists = allChecklists.filter((checklist) =>
          selectedExportChecklistIds.includes(checklist.id)
        );

        const pdfDoc = await PDFDocument.create();
        const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        let page = pdfDoc.addPage([612, 792]);
        const margin = 48;
        const lineHeight = 16;
        let y = 744;

        function addPageIfNeeded() {
          if (y < 64) {
            page = pdfDoc.addPage([612, 792]);
            y = 744;
          }
        }

        function drawLine(
          text: string,
          options?: {
            bold?: boolean;
            size?: number;
            indent?: number;
          }
        ) {
          addPageIfNeeded();

          page.drawText(text, {
            x: margin + (options?.indent ?? 0),
            y,
            size: options?.size ?? 11,
            font: options?.bold ? boldFont : regularFont,
            color: rgb(0, 0, 0),
            maxWidth: 516 - (options?.indent ?? 0),
          });

          y -= lineHeight;
        }

        drawLine("Where's My Gear Export", { bold: true, size: 18 });
        y -= 8;

        if (exportCategory === "storageSpaces") {
          selectedStorageSpaces.forEach((storage) => {
            drawLine(storage.name, { bold: true, size: 15 });

            const storageCompartments = allCompartments.filter(
              (compartment) =>
                compartment.vehicleId === storage.id &&
                selectedExportCompartmentIds.includes(compartment.id)
            );

            if (storageCompartments.length === 0) {
              drawLine("- No compartments", { indent: 16 });
              y -= 6;
              return;
            }

            storageCompartments.forEach((compartment) => {
              drawLine(`Compartment: ${compartment.name}`, {
                bold: true,
                indent: 16,
              });

              const compartmentItems = allItems.filter(
                (item) => item.compartmentId === compartment.id
              );

              if (compartmentItems.length === 0) {
                drawLine("- No items", { indent: 32 });
                return;
              }

              compartmentItems.forEach((item) => {
                drawLine(
                  `- ${item.name} | Qty: ${getItemQuantity(item)} | Status: ${item.status}`,
                  { indent: 32 }
                );
              });
            });

            y -= 8;
          });
        }

        if (exportCategory === "checklists") {
          selectedChecklists.forEach((checklist) => {
            drawLine(checklist.name, { bold: true, size: 15 });

            const checklistItems = allChecklistItems.filter(
              (item) => item.checklistId === checklist.id
            );

            if (checklistItems.length === 0) {
              drawLine("- No checklist items", { indent: 16 });
              y -= 6;
              return;
            }

            checklistItems.forEach((item) => {
              drawLine(
                `- ${item.name} | Qty: ${item.quantity} | Packed: ${item.packed ? "Yes" : "No"
                }`,
                { indent: 16 }
              );
            });

            y -= 8;
          });
        }

        const base64 = await pdfDoc.saveAsBase64();
        const exportLabel =
          exportCategory === "storageSpaces"
            ? "storage_spaces"
            : "checklists";
        const fileName = `wheres_my_gear_${exportLabel}_export.pdf`;
        const fileUri = `${FileSystem.cacheDirectory}${fileName}`;

        await FileSystem.writeAsStringAsync(fileUri, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });

        await NativeShare.share({
          title: "Where's My Gear Export",
          url: fileUri,
        });

        handleCloseDashboardExport();
      } catch (error) {
        console.error("Dashboard PDF export failed:", error);

        Alert.alert(
          "Export failed",
          "Something went wrong while exporting your PDF file."
        );
      }
    });
  }


  function handleAddStorageSpace() {
    pushWithNavigationLock(() => {
      router.push({
        pathname: "/(tabs)/storage/create",
        params: {
          returnTo: "dashboard",
        },
      });
    });
  }

  function handleOpenTrips() {
    pushWithNavigationLock(() => {
      router.push("/trips");
    });
  }

  function handleOpenTrip(tripId: string) {
    pushWithNavigationLock(() => {
      router.push(`/trips/${tripId}`);
    });
  }

  function handleAddTrip() {
    pushWithNavigationLock(() => {
      router.push({
        pathname: "/(tabs)/trips/create",
        params: {
          returnTo: "dashboard",
          createSession: String(Date.now()),
        },
      });
    });
  }

  function handleOpenProfile() {
    pushWithNavigationLock(() => {
      router.push("/(tabs)/profile");
    });
  }

  function handleToggleStorageDropdown() {
    if (interactionLocked || navigationTransitionLockedRef.current) return;

    setShowStorageDropdown((prev) => !prev);
  }

  function handleDismissStorageDropdown() {
    if (interactionLocked || navigationTransitionLockedRef.current) return;

    setShowStorageDropdown(false);
  }

  function handleClearSearch() {
    if (interactionLocked) return;

    setSearchQuery("");
  }

  function handleFirstRunAddStorageSpace() {
    if (navigationDisabled) return;

    void triggerSuccessHaptic();
    handleAddStorageSpace();
  }

  const navigationDisabled = isNavigationBusy();

  useEffect(() => {
    console.log("INDEX SCREEN ACTIVE");
  }, []);

  if (!initializing && !user) {
    return null;
  }

  if (!initializing && user && isPremiumLoading) {
    return (
      <ScreenBackground>
        <SafeAreaView style={styles.safe}>
          <View style={styles.loadingGateWrap}>
            <ThemedCard style={styles.emptyCard}>
              <ThemedText variant="bodyStrong" style={styles.emptyTitle}>
                Checking Premium access
              </ThemedText>
              <ThemedText color="secondary" style={styles.emptyText}>
                Verifying your trial or subscription.
              </ThemedText>
            </ThemedCard>
          </View>
        </SafeAreaView>
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe}>
        <ScrollView
          key={`dashboard-${isLandscape ? "landscape" : "portrait"}`}
          contentContainerStyle={[
            styles.content,
            isTablet && {
              maxWidth: isLandscape ? 1100 : 900,
              width: "100%",
              alignSelf: "center",
            },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={handleDismissStorageDropdown}
          scrollEnabled={!showStorageDropdown}
        >
          <View
            style={[
              styles.headerRow,
              isTablet && {
                justifyContent: "space-between",
                alignItems: "flex-start",
              },
            ]}
          >
            <View style={styles.brandRow}>
              <View style={styles.brandIconGlow}>
                <Image
                  source={require("../../assets/images/logo.png")}
                  style={styles.brandLogo}
                  resizeMode="contain"
                />
              </View>

              <View style={styles.brandTitleWrap}>
                <ThemedText variant="header">
                  Where&apos;s My Gear
                </ThemedText>
              </View>
            </View>

            {/* RIGHT SIDE (profile button or future iPad spacing anchor) */}

            <HapticPressable
              style={[
                styles.profileButton,
                navigationDisabled && styles.disabledInteraction,
              ]}
              onPress={handleOpenProfile}
              disabled={navigationDisabled}
            >
              {profilePhotoUri.trim().length > 0 && !profilePhotoFailed ? (
                <Image
                  source={{ uri: profilePhotoUri }}
                  style={styles.profileAvatar}
                  onError={() => {
                    if (isMountedRef.current) {
                      setProfilePhotoFailed(true);
                    }
                  }}
                />
              ) : (
                <UserCircle2 size={44} color={LABEL_WHITE} />
              )}
            </HapticPressable>
          </View>

          <FrostedCard style={styles.searchCard}>
            <View style={styles.searchInputWrap}>
              <Search size={20} color={theme.colors.textMuted} />

              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search gear, checklist items, templates..."
                placeholderTextColor={theme.colors.textMuted}
                selectionColor={theme.isLight ? "#2563EB" : "#93C5FD"}
                style={[
                  styles.searchInput,
                  {
                    color: theme.colors.text,
                    fontSize: theme.fontSizes.body,
                  },
                ]}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                inputAccessoryViewID={
                  shouldUseDashboardSearchAccessory
                    ? DASHBOARD_SEARCH_KEYBOARD_ACCESSORY_ID
                    : undefined
                }
                editable={
                  !initializing &&
                  !!user &&
                  isPremium &&
                  !navigationDisabled
                }
              />

              {searchQuery.length > 0 && (
                <HapticPressable
                  onPress={handleClearSearch}
                  style={styles.clearSearchButton}
                  hitSlop={10}
                  disabled={interactionLocked}
                >
                  <ThemedText color="secondary" style={styles.clearSearchButtonText}>
                    ✕
                  </ThemedText>
                </HapticPressable>
              )}
            </View>
          </FrostedCard>

          {initializing ? (
            <ThemedCard style={styles.emptyCard}>
              <ThemedText variant="bodyStrong" style={styles.emptyTitle}>
                Loading account
              </ThemedText>
              <ThemedText color="secondary" style={styles.emptyText}>
                Restoring your signed-in session.
              </ThemedText>
            </ThemedCard>
          ) : (
            <>
              {searchQuery.trim().length > 0 && (
                <View style={styles.searchResultsWrap}>
                  <ThemedText style={[styles.sectionTitle, styles.whiteLabel]}>
                    {isSearching ? "Searching..." : "Results"}
                  </ThemedText>

                  {!isSearching && searchResults.length === 0 ? (
                    <ThemedCard style={styles.emptyCard}>
                      <ThemedText variant="bodyStrong" style={styles.emptyTitle}>
                        No results found
                      </ThemedText>
                      <ThemedText color="secondary" style={styles.emptyText}>
                        Try searching by item name, storage space, compartment,
                        checklist, or template.
                      </ThemedText>
                    </ThemedCard>
                  ) : (
                    searchResults.map((item) => (
                      <ThemedCard
                        key={`${item.type}:${item.id}`}
                        style={styles.searchResultCard}
                      >
                        <HapticPressable
                          onPress={() => handleSearchResultPress(item)}
                          disabled={navigationDisabled}
                          style={navigationDisabled && styles.disabledInteraction}
                        >
                          <ThemedText variant="bodyStrong" style={styles.searchTitle}>
                            {item.name}
                          </ThemedText>
                          <ThemedText color="muted" style={styles.searchLocation}>
                            {item.subtitle}
                          </ThemedText>

                          {"statusLabel" in item && (
                            <ThemedText
                              color={
                                item.statusLabel === "To Pack"
                                  ? "danger"
                                  : "primary"
                              }
                              style={[
                                styles.searchStatus,
                                item.statusLabel !== "To Pack" && {
                                  color: theme.colors.success,
                                },
                              ]}
                            >
                              {item.statusLabel}
                            </ThemedText>
                          )}
                        </HapticPressable>
                      </ThemedCard>
                    ))
                  )}
                </View>
              )}

              {!hasStorageSpaces ? (
                <ThemedCard style={styles.firstRunCard}>
                  <ThemedText variant="title" style={styles.firstRunTitle}>
                    Start by adding a storage space
                  </ThemedText>
                  <ThemedText color="secondary" style={styles.firstRunText}>
                    Add your van, truck, garage, shed, trailer, or other storage
                    space. Then create compartments and add the gear you want to
                    track.
                  </ThemedText>

                  <View style={styles.firstRunSteps}>
                    <View style={styles.firstRunStep}>
                      <ThemedText style={styles.firstRunStepNumber}>1</ThemedText>
                      <ThemedText color="secondary" style={styles.firstRunStepText}>
                        Add a storage space
                      </ThemedText>
                    </View>

                    <View style={styles.firstRunStep}>
                      <ThemedText style={styles.firstRunStepNumber}>2</ThemedText>
                      <ThemedText color="secondary" style={styles.firstRunStepText}>
                        Create compartments
                      </ThemedText>
                    </View>

                    <View style={styles.firstRunStep}>
                      <ThemedText style={styles.firstRunStepNumber}>3</ThemedText>
                      <ThemedText color="secondary" style={styles.firstRunStepText}>
                        Add items and photos
                      </ThemedText>
                    </View>
                  </View>

                  <ThemedButton
                    style={styles.firstRunButton}
                    onPress={handleFirstRunAddStorageSpace}
                    disabled={navigationDisabled}
                  >
                    <ThemedText style={styles.signInButtonText}>
                      Add Storage Space
                    </ThemedText>
                  </ThemedButton>
                </ThemedCard>
              ) : (
                <View style={isTabletLandscape ? styles.tabletLandscapeLayout : undefined}>
                  <View style={isTabletLandscape ? styles.tabletLeftColumn : undefined}>
                    <View style={styles.selectorWrap}>
                      <View style={styles.selectorHeaderRow}>
                        <HapticPressable
                          style={[
                            styles.selectorAddButton,
                            navigationDisabled && styles.disabledInteraction,
                          ]}
                          onPress={handleAddStorageSpace}
                          disabled={navigationDisabled}
                        >
                          <Plus size={18} color="#111827" />
                        </HapticPressable>

                        <ThemedText
                          variant="bodyStrong"
                          style={[styles.selectorLabel, styles.whiteLabel]}
                        >
                          Selected Storage Space
                        </ThemedText>
                      </View>

                      <HapticPressable
                        style={[
                          styles.selectorPressable,
                          navigationDisabled && styles.disabledInteraction,
                        ]}
                        onPress={handleToggleStorageDropdown}
                        disabled={navigationDisabled}
                      >
                        <BlurView
                          intensity={theme.isLight ? 18 : 35}
                          tint={theme.isLight ? "light" : "dark"}
                          style={[
                            styles.selectorButton,
                            {
                              borderColor: theme.colors.border,
                              backgroundColor: theme.colors.card,
                            },
                          ]}
                        >
                          <ThemedText
                            variant="bodyStrong"
                            style={styles.selectorButtonText}
                            numberOfLines={1}
                          >
                            {selectedStorage?.name ?? "Select a storage space"}
                          </ThemedText>
                          <ChevronDown
                            size={18}
                            color={theme.colors.textSecondary}
                          />
                        </BlurView>
                      </HapticPressable>

                      {showStorageDropdown && (
                        <BlurView
                          intensity={theme.isLight ? 18 : 35}
                          tint={theme.isLight ? "light" : "dark"}
                          style={[
                            styles.dropdownCard,
                            {
                              borderColor: theme.colors.border,
                              backgroundColor: theme.colors.card,
                              height: sortedStorageSpaces.length > 0
                                ? storageDropdownHeight
                                : undefined,
                            },
                          ]}
                        >
                          {sortedStorageSpaces.length === 0 ? (
                            <ThemedText color="secondary" style={styles.dropdownEmpty}>
                              No storage spaces found.
                            </ThemedText>
                          ) : (
                            <ScrollView
                              style={styles.dropdownScroll}
                              showsVerticalScrollIndicator
                              nestedScrollEnabled
                              keyboardShouldPersistTaps="handled"
                            >
                              {sortedStorageSpaces.map((space, index) => (
                                <HapticPressable
                                  key={space.id}
                                  style={[
                                    styles.dropdownRow,
                                    {
                                      borderBottomColor: theme.colors.border,
                                    },
                                    index === sortedStorageSpaces.length - 1 &&
                                    styles.dropdownRowLast,
                                    interactionLocked && styles.disabledInteraction,
                                  ]}
                                  onPress={() => handleSelectStorage(space)}
                                  disabled={interactionLocked}
                                >
                                  <View style={styles.dropdownRowLeft}>
                                    <ThemedText
                                      variant="bodyStrong"
                                      style={styles.dropdownRowTitle}
                                    >
                                      {space.name}
                                    </ThemedText>
                                    <ThemedText
                                      color="secondary"
                                      style={styles.dropdownRowMeta}
                                    >
                                      {space.category === "vehicle"
                                        ? "Vehicle"
                                        : "Storage"}
                                      {space.subtype ? ` • ${space.subtype}` : ""}
                                    </ThemedText>
                                  </View>
                                </HapticPressable>
                              ))}
                            </ScrollView>
                          )}
                        </BlurView>
                      )}
                    </View>

                    <View style={styles.statsRow}>
                      <NoteCard
                        icon={<FileText size={20} color={LABEL_WHITE} />}
                        title="Notes"
                        onPress={handleOpenNotes}
                        disabled={navigationDisabled}
                      />

                      <StatCard
                        icon={<CheckCircle2 size={22} color={LABEL_WHITE} />}
                        value={packedCount}
                        label="Items Packed"
                        tone="success"
                        onPress={handleOpenPackedItems}
                        disabled={navigationDisabled}
                      />

                      <StatCard
                        icon={<ListChecks size={22} color={LABEL_WHITE} />}
                        value={toPackCount}
                        label="To Pack"
                        tone="danger"
                        onPress={handleOpenToPack}
                        disabled={navigationDisabled}
                      />
                    </View>

                    <View style={styles.sectionHeaderRow}>
                      <View style={styles.sectionHeaderLeft}>
                        <HapticPressable
                          style={[
                            styles.compartmentAddButton,
                            !selectedStorageId && styles.compartmentAddButtonDisabled,
                            navigationDisabled && styles.disabledInteraction,
                          ]}
                          onPress={handleAddCompartment}
                          disabled={!selectedStorageId || navigationDisabled}
                        >
                          <Plus size={18} color="#111827" />

                        </HapticPressable>

                        <ThemedText
                          variant="title"
                          style={[styles.sectionHeaderTitle, styles.whiteLabel]}
                        >
                          Compartment Quick View
                        </ThemedText>
                      </View>

                      <HapticPressable
                        onPress={handleOpenAllCompartments}
                        disabled={!selectedStorageId || navigationDisabled}
                      >
                        <ThemedText
                          style={[
                            styles.viewAllText,
                            styles.whiteLabelMuted,
                            (!selectedStorageId || navigationDisabled) &&
                            styles.disabledText,
                          ]}
                        >
                          View All
                        </ThemedText>
                      </HapticPressable>
                    </View>

                    {selectedStorageId == null ? (
                      <ThemedCard style={styles.emptyCard}>
                        <ThemedText variant="bodyStrong" style={styles.emptyTitle}>
                          Select a storage space
                        </ThemedText>
                        <ThemedText color="secondary" style={styles.emptyText}>
                          Choose a storage space above to view compartments and gear.
                        </ThemedText>
                      </ThemedCard>
                    ) : quickCompartments.length === 0 ? (
                      <ThemedCard style={styles.emptyCard}>
                        <ThemedText variant="bodyStrong" style={styles.emptyTitle}>
                          No compartments yet
                        </ThemedText>
                        <ThemedText color="secondary" style={styles.emptyText}>
                          Create compartments such as rear drawer, side cabinet,
                          garage shelf, or under-seat storage to organize your gear.
                        </ThemedText>

                        <ThemedButton
                          style={styles.emptyActionButton}
                          onPress={handleAddCompartment}
                          disabled={navigationDisabled}
                        >
                          <ThemedText style={styles.signInButtonText}>
                            Add Compartment
                          </ThemedText>
                        </ThemedButton>
                      </ThemedCard>
                    ) : (
                      <View style={styles.quickGrid}>
                        {quickCompartments.map((compartment) => (
                          <ThemedCard
                            key={compartment.id}
                            style={styles.quickGridCard}
                            contentStyle={styles.quickGridCardContent}
                          >
                            <HapticPressable
                              style={[
                                styles.quickGridRow,
                                navigationDisabled && styles.disabledInteraction,
                              ]}
                              onPress={() => handleOpenCompartment(compartment.id)}
                              disabled={navigationDisabled}
                            >
                              <View style={styles.quickGridLeft}>
                                <ThemedText
                                  variant="bodyStrong"
                                  style={styles.quickGridTitle}
                                  numberOfLines={2}
                                >
                                  {compartment.name}
                                </ThemedText>
                                <ThemedText
                                  color="secondary"
                                  style={styles.quickGridMeta}
                                >
                                  {compartment.itemCount}{" "}
                                  {compartment.itemCount === 1 ? "item" : "items"}
                                </ThemedText>
                              </View>
                              <ChevronRight
                                size={16}
                                color={theme.colors.textSecondary}
                              />
                            </HapticPressable>
                          </ThemedCard>
                        ))}
                      </View>
                    )}

                    <View style={styles.upcomingTripsSection}>
                      <View style={styles.upcomingTripsHeaderRow}>
                        <View style={styles.sectionHeaderLeft}>
                          <HapticPressable
                            style={[
                              styles.upcomingTripsAddButton,
                              navigationDisabled && styles.disabledInteraction,
                            ]}
                            onPress={handleAddTrip}
                            disabled={navigationDisabled}
                          >
                            <Plus size={18} color="#111827" />
                          </HapticPressable>

                          <ThemedText
                            variant="title"
                            style={[styles.sectionHeaderTitle, styles.whiteLabel]}
                          >
                            Upcoming Trips
                          </ThemedText>
                        </View>

                        <HapticPressable
                          onPress={handleOpenTrips}
                          disabled={navigationDisabled}
                        >
                          <ThemedText
                            style={[
                              styles.viewAllText,
                              styles.whiteLabelMuted,
                              navigationDisabled && styles.disabledText,
                            ]}
                          >
                            View All
                          </ThemedText>
                        </HapticPressable>
                      </View>

                      {!nextUpcomingTrip ? (
                        <FrostedCard style={styles.upcomingTripEmptyCard}>
                          <ThemedText
                            variant="bodyStrong"
                            style={styles.upcomingTripTitle}
                          >
                            No upcoming trips
                          </ThemedText>
                          <ThemedText
                            color="secondary"
                            style={styles.upcomingTripEmptyText}
                          >
                            Create a trip later to see countdowns and packing reminders
                            here.
                          </ThemedText>
                        </FrostedCard>
                      ) : (
                        <HapticPressable
                          onPress={() => handleOpenTrip(nextUpcomingTrip.id)}
                          disabled={navigationDisabled}
                          style={navigationDisabled && styles.disabledInteraction}
                        >
                          <FrostedCard style={styles.upcomingTripCard}>
                            <View style={styles.upcomingTripRow}>
                              <View style={styles.upcomingTripLeft}>
                                <ThemedText
                                  variant="bodyStrong"
                                  style={styles.upcomingTripTitle}
                                  numberOfLines={1}
                                >
                                  {nextUpcomingTrip.name}
                                </ThemedText>
                                <ThemedText
                                  color="secondary"
                                  style={styles.upcomingTripDate}
                                >
                                  {formatTripDate(nextUpcomingTrip.date)}
                                </ThemedText>
                              </View>

                              <View
                                style={[
                                  styles.upcomingTripCountdownPill,
                                  {
                                    backgroundColor: theme.isLight
                                      ? "rgba(255,255,255,0.88)"
                                      : "rgba(255,255,255,0.14)",
                                    borderColor: theme.isLight
                                      ? "rgba(0,0,0,0.10)"
                                      : "rgba(255,255,255,0.16)",
                                  },
                                ]}
                              >
                                <ThemedText
                                  style={[
                                    styles.upcomingTripCountdownText,
                                    { color: theme.isLight ? "#000" : LABEL_WHITE },
                                  ]}
                                >
                                  {getTripCountdownText(nextUpcomingTrip.date)}
                                </ThemedText>
                              </View>
                            </View>
                          </FrostedCard>
                        </HapticPressable>
                      )}
                    </View>

                    {!isTabletLandscape && (
                      <ThemedCard style={styles.stackedQuickActionsCard}>
                        <ThemedText variant="bodyStrong" style={styles.emptyTitle}>
                          Quick Actions
                        </ThemedText>

                        <View style={styles.stackedQuickActionsGrid}>
                          <HapticPressable
                            style={[
                              styles.selectorButton,
                              styles.stackedQuickActionButton,
                              { borderWidth: 2, borderColor: quickActionColors.export },
                            ]}
                            onPress={handleOpenVoiceAddQuickAction}
                          >
                            <Mic size={18} color={quickActionColors.export} />
                            <ThemedText>Gear Assistant</ThemedText>
                          </HapticPressable>

                          <HapticPressable style={[styles.selectorButton, styles.stackedQuickActionButton, { borderWidth: 2, borderColor: quickActionColors.trip }]} onPress={handleOpenAiScanQuickAction}>
                            <Camera size={18} color={quickActionColors.trip} />
                            <ThemedText>Scan w/AI</ThemedText>
                          </HapticPressable>

                          <HapticPressable style={[styles.selectorButton, styles.stackedQuickActionButton, { borderWidth: 2, borderColor: quickActionColors.scan }]} onPress={handleOpenScanQuickAction}>
                            <Camera size={18} color={quickActionColors.scan} />
                            <ThemedText>QR / Barcode Scanner</ThemedText>
                          </HapticPressable>

                          <HapticPressable
                            style={[
                              styles.selectorButton,
                              styles.stackedQuickActionButton,
                              { borderWidth: 2, borderColor: quickActionColors.addItem },
                            ]}
                            onPress={handleOpenArchive}
                          >
                            <Archive size={18} color={quickActionColors.addItem} />
                            <ThemedText>Archive</ThemedText>
                          </HapticPressable>

                          <HapticPressable style={[styles.selectorButton, styles.stackedQuickActionButton, { borderWidth: 2, borderColor: quickActionColors.compartment }]} onPress={handleAddCompartment}>
                            <FolderPlus size={18} color={quickActionColors.compartment} />
                            <ThemedText>Add Compartment</ThemedText>
                          </HapticPressable>

                          <HapticPressable style={[styles.selectorButton, styles.stackedQuickActionButton, { borderWidth: 2, borderColor: quickActionColors.storage }]} onPress={handleAddStorageSpace}>
                            <Plus size={18} color={quickActionColors.storage} />
                            <ThemedText>Add Storage Space</ThemedText>
                          </HapticPressable>

                          <HapticPressable style={[styles.selectorButton, styles.stackedQuickActionButton, { borderWidth: 2, borderColor: quickActionColors.export }]} onPress={handleOpenDashboardExport}>
                            <Share size={18} color={quickActionColors.export} />
                            <ThemedText>Export To...</ThemedText>
                          </HapticPressable>

                          <View style={styles.stackedQuickActionButton} />
                        </View>
                      </ThemedCard>
                    )}
                  </View>

                  {isTabletLandscape && (
                    <View style={styles.tabletRightColumn}>
                      <ThemedCard style={styles.tabletPanelSpacing}>
                        <ThemedText
                          variant="bodyStrong"
                          style={styles.emptyTitle}
                        >
                          Quick Actions
                        </ThemedText>

                        <View style={styles.tabletQuickActionsGrid}>

                          <View style={styles.tabletQuickActionsRow}>
                            <HapticPressable
                              style={[
                                styles.selectorButton,
                                styles.tabletQuickActionButton,
                                { borderWidth: 2, borderColor: quickActionColors.export },
                              ]}
                              onPress={handleOpenVoiceAddQuickAction}
                            >
                              <Mic size={18} color={quickActionColors.export} />
                              <ThemedText>Gear Assistant</ThemedText>
                            </HapticPressable>

                            <HapticPressable style={[styles.selectorButton, styles.tabletQuickActionButton, { borderWidth: 2, borderColor: quickActionColors.trip }]} onPress={handleOpenAiScanQuickAction}>
                              <Camera size={18} color={quickActionColors.trip} />
                              <ThemedText>Scan w/AI</ThemedText>
                            </HapticPressable>
                          </View>

                          <View style={styles.tabletQuickActionsRow}>
                            <HapticPressable
                              style={[
                                styles.selectorButton,
                                styles.tabletQuickActionButton,
                                { borderWidth: 2, borderColor: quickActionColors.scan }
                              ]}
                              onPress={handleOpenScanQuickAction}
                            >
                              <Camera size={18} color={quickActionColors.scan} />
                              <ThemedText>QR / Barcode Scanner</ThemedText>
                            </HapticPressable>

                            <HapticPressable
                              style={[
                                styles.selectorButton,
                                styles.tabletQuickActionButton,
                                { borderWidth: 2, borderColor: quickActionColors.addItem }
                              ]}
                              onPress={handleOpenArchive}
                            >
                              <Archive size={18} color={quickActionColors.addItem} />
                              <ThemedText>Archive</ThemedText>
                            </HapticPressable>
                          </View>

                          <View style={styles.tabletQuickActionsRow}>
                            <HapticPressable style={[styles.selectorButton, styles.tabletQuickActionButton, { borderWidth: 2, borderColor: quickActionColors.compartment }]} onPress={handleAddCompartment}>
                              <FolderPlus size={18} color={quickActionColors.compartment} />
                              <ThemedText>Add Compartment</ThemedText>
                            </HapticPressable>

                            <HapticPressable style={[styles.selectorButton, styles.tabletQuickActionButton, { borderWidth: 2, borderColor: quickActionColors.storage }]} onPress={handleAddStorageSpace}>
                              <Plus size={18} color={quickActionColors.storage} />
                              <ThemedText>Add Storage Space</ThemedText>
                            </HapticPressable>
                          </View>

                          <View style={styles.tabletQuickActionsRow}>
                            <HapticPressable
                              style={[
                                styles.selectorButton,
                                styles.tabletQuickActionButton,
                                {
                                  borderWidth: 2,
                                  borderColor: quickActionColors.export,
                                },
                              ]}
                              onPress={handleOpenDashboardExport}
                            >
                              <Share size={18} color={quickActionColors.export} />
                              <ThemedText>Export To...</ThemedText>
                            </HapticPressable>

                            <View style={styles.tabletQuickActionButton} />
                          </View>

                        </View>
                      </ThemedCard>


                    </View>
                  )}
                </View>
              )}
            </>
          )}
        </ScrollView>

        <Modal
          visible={exportModalVisible}
          transparent
          animationType="fade"
          onRequestClose={handleCloseDashboardExport}
        >
          <View style={styles.exportModalOverlay}>
            <View
              style={[
                styles.exportModalCard,
                {
                  backgroundColor: theme.colors.cardStrong,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              {exportStep === "category" ? (
                <>
                  <ThemedText variant="title">Export To...</ThemedText>
                  <ThemedText color="secondary">
                    Choose what you want to export.
                  </ThemedText>

                  <View style={styles.exportModalOptions}>
                    <HapticPressable
                      style={[
                        styles.exportModalOptionButton,
                        {
                          backgroundColor: theme.colors.iconSurface,
                          borderColor: theme.colors.border,
                        },
                      ]}
                      onPress={() => {
                        setExportCategory("storageSpaces");
                        setExportStep("selection");
                      }}
                    >
                      <ThemedText>Storage Spaces</ThemedText>
                    </HapticPressable>

                    <HapticPressable
                      style={[
                        styles.exportModalOptionButton,
                        {
                          backgroundColor: theme.colors.iconSurface,
                          borderColor: theme.colors.border,
                        },
                      ]}
                      onPress={() => {
                        setExportCategory("checklists");
                        setExportStep("selection");
                      }}
                    >
                      <ThemedText>Checklists</ThemedText>
                    </HapticPressable>
                  </View>
                </>
              ) : exportStep === "selection" ? (
                <>
                  <ThemedText variant="title">
                    {exportCategory === "storageSpaces"
                      ? "Select Storage Spaces"
                      : "Select Checklists"}
                  </ThemedText>
                  <ThemedText color="secondary">
                    Select one or more items to export.
                  </ThemedText>

                  <ThemedText color="secondary">
                    {exportCategory === "storageSpaces"
                      ? `${selectedExportStorageIds.length} selected`
                      : `${selectedExportChecklistIds.length} selected`}
                  </ThemedText>

                  <View style={styles.exportModalOptions}>
                    {(exportCategory === "storageSpaces"
                      ? storageSpaces
                      : allChecklists
                    ).map((item) => {
                      const selected =
                        exportCategory === "storageSpaces"
                          ? selectedExportStorageIds.includes(item.id)
                          : selectedExportChecklistIds.includes(item.id);

                      return (
                        <HapticPressable
                          key={item.id}
                          style={[
                            styles.exportModalOptionButton,
                            {
                              backgroundColor: selected
                                ? "rgba(55,130,245,0.22)"
                                : theme.colors.iconSurface,
                              borderColor: selected
                                ? "rgba(55,130,245,0.95)"
                                : theme.colors.border,
                            },
                          ]}
                          onPress={() => {
                            if (exportCategory === "storageSpaces") {
                              toggleExportStorageSelection(item.id);
                              return;
                            }

                            toggleExportChecklistSelection(item.id);
                          }}
                        >
                          <ThemedText>{item.name}</ThemedText>
                        </HapticPressable>
                      );
                    })}

                    <HapticPressable
                      style={[
                        styles.exportModalOptionButton,
                        {
                          backgroundColor: theme.colors.iconSurface,
                          borderColor: theme.colors.border,
                        },
                      ]}
                      onPress={handleSelectAllExportItems}
                    >
                      <ThemedText>
                        {exportCategory === "storageSpaces"
                          ? selectedExportStorageIds.length === storageSpaces.length
                            ? "Clear All Storage Spaces"
                            : "Select All Storage Spaces"
                          : selectedExportChecklistIds.length === allChecklists.length
                            ? "Clear All Checklists"
                            : "Select All Checklists"}
                      </ThemedText>
                    </HapticPressable>
                  </View>
                </>
              ) : exportStep === "compartments" ? (
                <>
                  <ThemedText variant="title">Select Compartments</ThemedText>
                  <ThemedText color="secondary">
                    Select one or more compartments to export.
                  </ThemedText>

                  <ThemedText color="secondary">
                    {`${selectedExportCompartmentIds.length} selected`}
                  </ThemedText>

                  <View style={styles.exportModalOptions}>
                    {allCompartments
                      .filter((compartment) =>
                        selectedExportStorageIds.includes(compartment.vehicleId)
                      )
                      .map((compartment) => {
                        const selected = selectedExportCompartmentIds.includes(
                          compartment.id
                        );

                        return (
                          <HapticPressable
                            key={compartment.id}
                            style={[
                              styles.exportModalOptionButton,
                              {
                                backgroundColor: selected
                                  ? "rgba(55,130,245,0.22)"
                                  : theme.colors.iconSurface,
                                borderColor: selected
                                  ? "rgba(55,130,245,0.95)"
                                  : theme.colors.border,
                              },
                            ]}
                            onPress={() =>
                              toggleExportCompartmentSelection(compartment.id)
                            }
                          >
                            <ThemedText>{compartment.name}</ThemedText>
                          </HapticPressable>
                        );
                      })}

                    <HapticPressable
                      style={[
                        styles.exportModalOptionButton,
                        {
                          backgroundColor: theme.colors.iconSurface,
                          borderColor: theme.colors.border,
                        },
                      ]}
                      onPress={() => {
                        const selectedStorageCompartments = allCompartments
                          .filter((compartment) =>
                            selectedExportStorageIds.includes(
                              compartment.vehicleId
                            )
                          )
                          .map((compartment) => compartment.id);

                        const allSelected =
                          selectedExportCompartmentIds.length ===
                          selectedStorageCompartments.length;

                        setSelectedExportCompartmentIds(
                          allSelected ? [] : selectedStorageCompartments
                        );
                      }}
                    >
                      <ThemedText>
                        {selectedExportCompartmentIds.length ===
                          allCompartments.filter((compartment) =>
                            selectedExportStorageIds.includes(
                              compartment.vehicleId
                            )
                          ).length
                          ? "Clear All Compartments"
                          : "Select All Compartments"}
                      </ThemedText>
                    </HapticPressable>
                  </View>
                </>
              ) : (
                <>
                  <ThemedText variant="title">Export Format</ThemedText>
                  <ThemedText color="secondary">
                    Choose a file format for this export.
                  </ThemedText>

                  <View style={styles.exportModalOptions}>
                    <HapticPressable
                      style={[
                        styles.exportModalOptionButton,
                        {
                          backgroundColor: theme.colors.iconSurface,
                          borderColor: theme.colors.border,
                        },
                      ]}
                      onPress={handleExportDashboardDocx}
                    >
                      <ThemedText>Word (.docx)</ThemedText>
                    </HapticPressable>

                    <HapticPressable
                      style={[
                        styles.exportModalOptionButton,
                        {
                          backgroundColor: theme.colors.iconSurface,
                          borderColor: theme.colors.border,
                        },
                      ]}
                      onPress={handleExportDashboardPdf}
                    >
                      <ThemedText>PDF (.pdf)</ThemedText>
                    </HapticPressable>

                    <HapticPressable
                      style={[
                        styles.exportModalOptionButton,
                        {
                          backgroundColor: theme.colors.iconSurface,
                          borderColor: theme.colors.border,
                        },
                      ]}
                      onPress={handleExportDashboardCsv}
                    >
                      <ThemedText>Excel/CSV</ThemedText>
                    </HapticPressable>
                  </View>
                </>
              )}

              {exportStep === "selection" ||
                exportStep === "compartments" ? (
                <HapticPressable
                  style={[
                    styles.exportModalPrimaryButton,
                    (
                      exportStep === "compartments"
                        ? selectedExportCompartmentIds.length === 0
                        : exportCategory === "storageSpaces"
                          ? selectedExportStorageIds.length === 0
                          : selectedExportChecklistIds.length === 0
                    ) && { opacity: 0.5 },
                  ]}
                  onPress={() => {
                    if (exportStep === "compartments") {
                      setExportStep("format");
                      return;
                    }

                    if (exportCategory === "storageSpaces") {
                      setExportStep("compartments");
                      return;
                    }

                    setExportStep("format");
                  }}
                  disabled={
                    exportStep === "compartments"
                      ? selectedExportCompartmentIds.length === 0
                      : exportCategory === "storageSpaces"
                        ? selectedExportStorageIds.length === 0
                        : selectedExportChecklistIds.length === 0
                  }
                >
                  <ThemedText style={styles.exportModalPrimaryButtonText}>
                    Continue
                  </ThemedText>
                </HapticPressable>
              ) : null}

              {exportStep !== "category" ? (
                <HapticPressable
                  onPress={() => {
                    if (exportStep === "format") {
                      if (exportCategory === "storageSpaces") {
                        setExportStep("compartments");
                        return;
                      }

                      setExportStep("selection");
                      return;
                    }

                    if (exportStep === "compartments") {
                      setExportStep("selection");
                      return;
                    }

                    setExportStep("category");

                    setExportStep("category");
                  }}
                >
                  <ThemedText color="secondary" style={styles.exportModalCancelText}>
                    Back
                  </ThemedText>
                </HapticPressable>
              ) : null}

              <HapticPressable onPress={handleCloseDashboardExport}>
                <ThemedText color="secondary" style={styles.exportModalCancelText}>
                  Cancel
                </ThemedText>
              </HapticPressable>
            </View>
          </View>
        </Modal>

        <Modal
          visible={voiceAddModalVisible}
          transparent
          animationType="fade"
          onRequestClose={handleCloseVoiceAddModal}
        >
          <View style={styles.exportModalOverlay} pointerEvents="auto">
            <View
              style={[
                styles.exportModalCard,
                {
                  backgroundColor: theme.colors.cardStrong,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Pressable
                style={[
                  styles.voiceAddIconWrap,
                  isVoiceListening ? styles.voiceAddIconWrapListening : null,
                ]}
                onPress={handleVoiceMicPress}
              >
                <Mic size={34} color="#FFFFFF" />
              </Pressable>

              <ThemedText variant="title">Gear Assistant</ThemedText>

              <ThemedText color="secondary">
                Tap the mic, speak your items, then review and choose where to save them.
              </ThemedText>

              <ThemedText color="secondary">
                {isVoiceListening ? "Listening..." : "Tap the mic to start listening."}
              </ThemedText>

              {voiceTranscript ? (
                <View
                  style={[
                    styles.voiceTranscriptCard,
                    {
                      backgroundColor: theme.colors.card,
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  <ThemedText>{voiceTranscript}</ThemedText>
                </View>
              ) : null}

              {voiceAddReview ? (
                <View
                  style={[
                    styles.voiceReviewCard,
                    {
                      backgroundColor: theme.colors.card,
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  <ThemedText variant="bodyStrong">Detected Items</ThemedText>

                  {voiceAddReview.items.length > 0 ? (
                    voiceAddReview.items.map((item) => (
                      <View key={item.id} style={styles.voiceReviewRow}>
                        <ThemedText>{item.name}</ThemedText>
                        <ThemedText color="secondary">x{item.quantity}</ThemedText>
                      </View>
                    ))
                  ) : (
                    <ThemedText color="secondary">
                      No items detected yet.
                    </ThemedText>
                  )}

                  <View style={styles.voiceReviewDivider} />

                  <ThemedText variant="bodyStrong">Destination</ThemedText>
                  <ThemedText color="secondary">
                    {voiceAddReview.destinationName}
                  </ThemedText>

                  <View style={styles.voiceReviewDivider} />

                  <ThemedText variant="bodyStrong">Save Location</ThemedText>

                  {!selectedVoiceLocationId &&
                  voiceAddReview.destinationName !== "Not Detected" ? (
                    <ThemedText color="secondary">
                      No matching location found for "{voiceAddReview.destinationName}".
                      Choose where to save the items:
                    </ThemedText>
                  ) : null}

                  {voiceLocationOptions.length > 0 ? (
                    <ScrollView
                      style={styles.voiceLocationList}
                      nestedScrollEnabled
                      showsVerticalScrollIndicator
                    >
                      {!showAllVoiceLocations &&
                      suggestedVoiceLocationOptions.length === 0 ? (
                        <ThemedText color="secondary" style={styles.voiceNoSuggestionsText}>
                          No close matches found. Tap Choose Another Location to browse all saved locations.
                        </ThemedText>
                      ) : null}

                      {(showAllVoiceLocations
                        ? voiceLocationOptions
                        : suggestedVoiceLocationOptions
                      ).map((option) => {
                        const isSelected = selectedVoiceLocationId === option.id;

                        return (
                          <HapticPressable
                            key={option.id}
                            style={[
                              styles.voiceLocationOption,
                              {
                                borderColor: isSelected
                                  ? theme.colors.primary
                                  : theme.colors.border,
                                backgroundColor: isSelected
                                  ? "rgba(37, 99, 235, 0.14)"
                                  : theme.colors.card,
                              },
                            ]}
                            onPress={() => setSelectedVoiceLocationId(option.id)}
                          >
                            <ThemedText>{option.name}</ThemedText>
                            <ThemedText color="secondary">
                              {isSelected ? "Selected" : "Tap to select"}
                            </ThemedText>
                          </HapticPressable>
                        );
                      })}

                      {!showAllVoiceLocations &&
                      voiceLocationOptions.length >
                        suggestedVoiceLocationOptions.length ? (
                        <HapticPressable
                          style={styles.voiceChooseAnotherButton}
                          onPress={() => setShowAllVoiceLocations(true)}
                        >
                          <ThemedText color="secondary">
                            Choose Another Location
                          </ThemedText>
                        </HapticPressable>
                      ) : null}
                    </ScrollView>
                  ) : (
                    <ThemedText color="secondary">
                      Add a storage space or compartment before saving Gear Assistant items.
                    </ThemedText>
                  )}
                </View>
              ) : null}

              <HapticPressable
                style={[
                  styles.exportModalPrimaryButton,
                  {
                    backgroundColor:
                      voiceAddReview?.items.length && selectedVoiceLocationId
                        ? theme.colors.primary
                        : theme.colors.primary,
                    opacity: isSavingVoiceItems ? 0.7 : 1,
                  },
                ]}
                onPress={
                  voiceAddReview?.items.length && selectedVoiceLocationId
                    ? handleSaveVoiceItems
                    : handleVoiceMicPress
                }
                disabled={isSavingVoiceItems}
              >
                <ThemedText style={styles.exportModalPrimaryButtonText}>
                  {isSavingVoiceItems
                    ? "Saving..."
                    : voiceAddReview?.items.length && selectedVoiceLocationId
                      ? `Save ${voiceAddReview.items.length} Item${
                          voiceAddReview.items.length === 1 ? "" : "s"
                        }`
                      : voiceAddReview?.items.length
                        ? "Choose Save Location"
                        : isVoiceListening
                          ? "Listening..."
                          : "Start Gear Assistant"}
                </ThemedText>
              </HapticPressable>

              <HapticPressable onPress={handleCloseVoiceAddModal}>
                <ThemedText color="secondary" style={styles.exportModalCancelText}>
                  Cancel
                </ThemedText>
              </HapticPressable>
            </View>
          </View>
        </Modal>

      </SafeAreaView>

      {shouldUseDashboardSearchAccessory ? (
        <KeyboardDismissAccessory
          nativeID={DASHBOARD_SEARCH_KEYBOARD_ACCESSORY_ID}
        />
      ) : null}
    </ScreenBackground >
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "transparent",
  },

  loadingGateWrap: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 16,
  },

  content: {
    paddingHorizontal: 16,
    paddingTop: -4,
    paddingBottom: 260,
  },

  bottomAdWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 110,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 200,
  },

  whiteLabel: {
    color: LABEL_WHITE,
  },

  whiteLabelMuted: {
    color: LABEL_WHITE,
    opacity: 0.82,
  },

  disabledText: {
    opacity: 0.45,
  },

  disabledInteraction: {
    opacity: 0.6,
  },

  frostedCard: {
    overflow: "hidden",
    borderRadius: 14,
    borderWidth: 2,
  },

  frostedCardContent: {
    padding: 0,
  },

  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    paddingLeft: 6,
    paddingRight: 6,
  },

  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: -10,
    flex: 1,
    paddingRight: 12,
    marginLeft: -12,
  },

  brandIconGlow: {
    width: 80,
    height: 80,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },

  brandLogo: {
    width: 80,
    height: 80,
  },

  brandTitleWrap: {
    marginLeft: -2,
  },

  brandText: {
    fontWeight: "800",
    fontSize: 22,
    color: "#FFFFFF",
    textShadowColor: "rgba(59,130,246,0.5)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },

  profileButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    borderWidth: 0,
  },

  profileAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },

  searchCard: {
    marginBottom: 10,
  },

  searchInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },

  searchInput: {
    flex: 1,
    marginLeft: 10,
  },

  clearSearchButton: {
    marginLeft: 8,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 8,
  },

  clearSearchButtonText: {
    fontSize: 16,
    fontWeight: "700",
  },


  searchResultsWrap: {
    marginBottom: 16,
  },

  sectionTitle: {
    fontWeight: "600",
    marginBottom: 8,
  },

  searchResultCard: {
    marginBottom: 8,
  },

  searchTitle: {
    marginBottom: 3,
  },

  searchLocation: {
    marginBottom: 6,
  },

  searchStatus: {
    fontWeight: "700",
  },

  selectorWrap: {
    marginBottom: 12,
    alignItems: "flex-start",
    position: "relative",
    zIndex: 50,
  },

  selectorHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },

  selectorAddButton: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },

  selectorLabel: {},

  selectorPressable: {
    alignSelf: "flex-start",
    borderRadius: 14,
    zIndex: 60,
  },

  selectorButton: {
    alignSelf: "flex-start",
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  selectorButtonText: {},

  dropdownCard: {
    marginTop: 8,
    minWidth: 280,
    maxHeight: 260,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    alignSelf: "flex-start",
    zIndex: 100,
  },

  dropdownEmpty: {
    padding: 12,
  },

  dropdownScroll: {
    maxHeight: 260,
  },

  dropdownRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    minHeight: 58,
    justifyContent: "center",
  },

  dropdownRowLast: {
    borderBottomWidth: 0,
  },

  dropdownRowLeft: {
    justifyContent: "center",
  },

  dropdownRowTitle: {
    marginBottom: 2,
  },

  dropdownRowMeta: {},

  statsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },

  statPressable: {
    flex: 1,
    minWidth: 0,
    borderRadius: 14,
    overflow: "hidden",
  },

  statCard: {
    height: 72,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1.5,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },

  statCardDefault: {
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(20,28,48,0.12)",
  },

  statCardSuccess: {
    borderColor: "rgba(120,255,190,0.14)",
    backgroundColor: "rgba(40,120,80,0.18)",
  },

  statCardDanger: {
    borderColor: "rgba(255,140,140,0.14)",
    backgroundColor: "rgba(140,40,50,0.18)",
  },

  statInner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 2,
  },

  statTextWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  statTextWhite: {
    color: LABEL_WHITE,
  },

  statIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    marginBottom: 4,
  },

  noteIconWrap: {
    backgroundColor: "rgba(255,255,255,0.14)",
    borderColor: "rgba(255,255,255,0.18)",
  },

  statIconWrapDefault: {
    backgroundColor: "rgba(255,255,255,0.07)",
    borderColor: "rgba(255,255,255,0.05)",
  },

  statIconWrapSuccess: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderColor: "rgba(220,255,235,0.16)",
  },

  statIconWrapDanger: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderColor: "rgba(255,220,220,0.16)",
  },

  noteTitle: {
    lineHeight: 13,
    textAlign: "center",
    fontSize: 11,
    fontWeight: "700",
  },

  statValue: {
    marginBottom: 1,
    lineHeight: 18,
    fontSize: 16,
    fontWeight: "800",
  },

  statLabel: {
    lineHeight: 13,
    textAlign: "center",
    fontSize: 11,
    fontWeight: "700",
  },

  upcomingTripsSection: {
    marginBottom: 14,
  },

  upcomingTripsHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },

  upcomingTripsAddButton: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },

  upcomingTripCard: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },

  upcomingTripEmptyCard: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },

  upcomingTripRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  upcomingTripLeft: {
    flex: 1,
  },

  upcomingTripTitle: {
    marginBottom: 3,
  },

  upcomingTripDate: {
    lineHeight: 18,
  },

  upcomingTripEmptyText: {
    lineHeight: 19,
  },

  upcomingTripCountdownPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },

  upcomingTripCountdownText: {
    fontWeight: "700",
    fontSize: 12,
  },

  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },

  sectionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    paddingRight: 12,
  },

  compartmentAddButton: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },

  compartmentAddButtonDisabled: {
    opacity: 0.45,
  },

  sectionHeaderTitle: {
    flex: 1,
  },

  viewAllText: {
    fontWeight: "600",
  },

  emptyCard: {
    marginBottom: 14,
  },

  emptyTitle: {
    marginBottom: 4,
  },

  emptyText: {
    lineHeight: 19,
  },

  emptyActionButton: {
    marginTop: 12,
  },

  signInButton: {
    marginTop: 12,
  },

  signInButtonText: {
    color: "#fff",
    fontWeight: "700",
  },

  firstRunCard: {
    marginTop: 4,
    marginBottom: 16,
  },

  firstRunTitle: {
    marginBottom: 8,
  },

  firstRunText: {
    lineHeight: 20,
    marginBottom: 14,
  },

  firstRunSteps: {
    gap: 10,
    marginBottom: 16,
  },

  firstRunStep: {
    flexDirection: "row",
    alignItems: "center",
  },

  firstRunStepNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    textAlign: "center",
    lineHeight: 26,
    overflow: "hidden",
    marginRight: 10,
    color: "#fff",
    fontWeight: "700",
    backgroundColor: "rgba(55,130,245,0.95)",
  },

  firstRunStepText: {
    flex: 1,
  },

  firstRunButton: {
    marginTop: 2,
  },

  tabletLandscapeLayout: {
    flexDirection: "row",
    gap: 16,
    alignItems: "flex-start",
  },

  tabletLeftColumn: {
    flex: 1.2,
    minWidth: 0,
  },

  tabletCenterColumn: {
    flex: 1,
    minWidth: 0,
  },

  tabletRightColumn: {
    width: 360,
    flexShrink: 0,
  },

  tabletPanelSpacing: {
    marginBottom: 16,
  },

  tabletQuickActionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 12,
  },

  tabletQuickActionButton: {
    width: "48%",
    minHeight: 72,
    marginBottom: 10,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },

  stackedQuickActionsCard: {
    marginBottom: 16,
  },

  stackedQuickActionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 12,
  },

  stackedQuickActionButton: {
    width: "48%",
    minHeight: 64,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },

  tabletRecentActivityGrid: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
  },

  tabletRecentColumn: {
    flex: 1,
  },

  tabletRecentTitle: {
    marginBottom: 8,
  },

  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 14,
  },

  quickGridCard: {
    width: "48.5%",
    marginBottom: 8,
  },

  quickGridCardContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  quickGridRow: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  quickGridLeft: {
    flex: 1,
    paddingRight: 8,
  },

  quickGridTitle: {
    marginBottom: 3,
    lineHeight: 17,
  },

  quickGridMeta: {},

  tabletQuickActionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    flexWrap: "wrap",
    marginBottom: 10,
  },

  voiceAddIconWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563EB",
    alignSelf: "center",
    marginBottom: 10,
  },

  voiceAddIconWrapListening: {
    backgroundColor: "#DC2626",
  },

  voiceTranscriptCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },

  voiceReviewCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },

  voiceReviewRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  voiceReviewDivider: {
    height: 1,
    backgroundColor: "rgba(148, 163, 184, 0.35)",
    marginVertical: 4,
  },

  voiceLocationList: {
    maxHeight: 260,
  },

  voiceLocationOption: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    gap: 3,
    marginBottom: 8,
  },

  voiceChooseAnotherButton: {
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    borderColor: "rgba(148, 163, 184, 0.45)",
    marginBottom: 8,
  },

  voiceNoSuggestionsText: {
    marginBottom: 8,
    lineHeight: 19,
  },



  exportModalOverlay: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 24,
  },

  exportModalCard: {
    padding: 20,
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
  },

  exportModalOptions: {
    gap: 10,
    marginTop: 8,
  },

  exportModalOptionButton: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },

  exportModalPrimaryButton: {
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "rgba(55,130,245,0.95)",
    alignItems: "center",
  },

  exportModalPrimaryButtonText: {
    color: "#fff",
    fontWeight: "700",
  },

  exportModalCancelText: {
    textAlign: "center",
    marginTop: 8,
  },

});