import * as ImagePicker from "expo-image-picker";
import { BlurView } from "expo-blur";
import { router } from "expo-router";
import {
  Backpack,
  Check,
  CheckCircle2,
  Camera,
  ChevronDown,
  Edit3,
  HeartPulse,
  Minus,
  Plus,
  Sailboat,
  Shirt,
  Tent,
  Trash2,
  Wrench,
  Utensils,
  Zap,
  Fish,
  Crosshair,
} from "lucide-react-native";
import React, { useRef, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../../../components/auth/AuthProvider";
import AppHeader from "../../../components/ui/AppHeader";
import HapticPressable from "../../../components/ui/HapticPressable";
import ScreenBackground from "../../../components/ui/ScreenBackground";
import {
  ThemedButton,
  ThemedText,
  useThemedValues,
} from "../../../components/ui/Themed";
import { createChecklistTemplateWithItems } from "../../../lib/checklistsService";
import type { ChecklistCategory } from "../../../types/checklists";

type EditableTemplateItem = {
  id: string;
  name: string;
  quantity: number;
  packed: boolean;
  itemPhotoUri?: string;
};

const CATEGORY_OPTIONS: {
  key: ChecklistCategory;
  label: string;
}[] = [
    { key: "trip", label: "Trip" },
    { key: "camping", label: "Camping" },
    { key: "hunting", label: "Hunting" },
    { key: "fishing", label: "Fishing" },
    { key: "boating", label: "Boating" },
    { key: "clothing", label: "Clothing" },
    { key: "electronics", label: "Electronics" },
    { key: "medical", label: "Medical" },
    { key: "tools", label: "Tools" },
    { key: "food", label: "Food" },
    { key: "custom", label: "Other" },
  ];

const STARTER_TEMPLATE_OPTIONS: {
  id: string;
  name: string;
  category: ChecklistCategory;
  categoryLabel: string;
  items: { name: string; quantity: number; packed?: boolean }[];
}[] = [
    {
      id: "trip-essentials",
      name: "Trip Essentials",
      category: "trip",
      categoryLabel: "Trip",
      items: [
        { name: "Driver’s license", quantity: 1 },
        { name: "Wallet", quantity: 1 },
        { name: "Phone charger", quantity: 1 },
        { name: "Sunglasses", quantity: 1 },
        { name: "Water bottle", quantity: 1 },
        { name: "First aid kit", quantity: 1 },
        { name: "Flashlight", quantity: 1 },
        { name: "Snacks", quantity: 1 },
        { name: "Jacket", quantity: 1 },
        { name: "Toiletries", quantity: 1 },
      ],
    },
    {
      id: "camping-gear",
      name: "Camping Gear",
      category: "camping",
      categoryLabel: "Camping",
      items: [
        { name: "Tent", quantity: 1 },
        { name: "Sleeping bag", quantity: 1 },
        { name: "Sleeping pad", quantity: 1 },
        { name: "Camp stove", quantity: 1 },
        { name: "Fuel", quantity: 1 },
        { name: "Cookware", quantity: 1 },
        { name: "Headlamp", quantity: 1 },
        { name: "Camp chair", quantity: 1 },
        { name: "Fire starter", quantity: 1 },
        { name: "Cooler", quantity: 1 },
      ],
    },
    {
      id: "hunting-gear",
      name: "Hunting Gear",
      category: "hunting",
      categoryLabel: "Hunting",
      items: [
        { name: "Hunting license", quantity: 1 },
        { name: "Tags", quantity: 1 },
        { name: "Binoculars", quantity: 1 },
        { name: "Rangefinder", quantity: 1 },
        { name: "Knife", quantity: 1 },
        { name: "Game bags", quantity: 1 },
        { name: "Headlamp", quantity: 1 },
        { name: "Gloves", quantity: 1 },
        { name: "Weather layers", quantity: 1 },
        { name: "First aid kit", quantity: 1 },
      ],
    },
    {
      id: "fishing-gear",
      name: "Fishing Gear",
      category: "fishing",
      categoryLabel: "Fishing",
      items: [
        { name: "Fishing license", quantity: 1 },
        { name: "Rod", quantity: 1 },
        { name: "Reel", quantity: 1 },
        { name: "Tackle box", quantity: 1 },
        { name: "Bait", quantity: 1 },
        { name: "Pliers", quantity: 1 },
        { name: "Net", quantity: 1 },
        { name: "Cooler", quantity: 1 },
        { name: "Sunscreen", quantity: 1 },
        { name: "Rain jacket", quantity: 1 },
      ],
    },
    {
      id: "boating-gear",
      name: "Boating Gear",
      category: "boating",
      categoryLabel: "Boating",
      items: [
        { name: "Life jackets", quantity: 1 },
        { name: "Boat registration", quantity: 1 },
        { name: "Whistle", quantity: 1 },
        { name: "Throwable flotation device", quantity: 1 },
        { name: "Anchor", quantity: 1 },
        { name: "Dock lines", quantity: 1 },
        { name: "Dry bag", quantity: 1 },
        { name: "Sunscreen", quantity: 1 },
        { name: "Towels", quantity: 2 },
        { name: "First aid kit", quantity: 1 },
      ],
    },
    {
      id: "clothing-3-day",
      name: "Clothing - 3 Day Trip",
      category: "clothing",
      categoryLabel: "Clothing",
      items: [
        { name: "Shirts", quantity: 3 },
        { name: "Pants/Shorts", quantity: 2 },
        { name: "Underwear", quantity: 3 },
        { name: "Socks", quantity: 3 },
        { name: "Sleepwear", quantity: 1 },
        { name: "Light jacket", quantity: 1 },
        { name: "Rain jacket", quantity: 1 },
        { name: "Shoes", quantity: 1 },
        { name: "Hat", quantity: 1 },
        { name: "Belt", quantity: 1 },
      ],
    },
    {
      id: "clothing-7-day",
      name: "Clothing - 7 Day Trip",
      category: "clothing",
      categoryLabel: "Clothing",
      items: [
        { name: "Shirts", quantity: 7 },
        { name: "Pants/Shorts", quantity: 4 },
        { name: "Underwear", quantity: 7 },
        { name: "Socks", quantity: 7 },
        { name: "Sleepwear", quantity: 2 },
        { name: "Light jacket", quantity: 1 },
        { name: "Rain jacket", quantity: 1 },
        { name: "Shoes", quantity: 2 },
        { name: "Hat", quantity: 1 },
        { name: "Belt", quantity: 1 },
      ],
    },
    {
      id: "electronics",
      name: "Electronics",
      category: "electronics",
      categoryLabel: "Electronics",
      items: [
        { name: "Phone charger", quantity: 1 },
        { name: "Power bank", quantity: 1 },
        { name: "Camera", quantity: 1 },
        { name: "Camera batteries", quantity: 2 },
        { name: "Memory cards", quantity: 2 },
        { name: "Headphones", quantity: 1 },
        { name: "Tablet", quantity: 1 },
        { name: "Laptop", quantity: 1 },
        { name: "Charging cables", quantity: 2 },
        { name: "Adapter", quantity: 1 },
      ],
    },
    {
      id: "medical",
      name: "Medical",
      category: "medical",
      categoryLabel: "Medical",
      items: [
        { name: "First aid kit", quantity: 1 },
        { name: "Prescription medication", quantity: 1 },
        { name: "Pain reliever", quantity: 1 },
        { name: "Allergy medication", quantity: 1 },
        { name: "Bandages", quantity: 1 },
        { name: "Antiseptic wipes", quantity: 1 },
        { name: "Tweezers", quantity: 1 },
        { name: "Medical tape", quantity: 1 },
        { name: "Sunscreen", quantity: 1 },
        { name: "Insect repellent", quantity: 1 },
      ],
    },
    {
      id: "tools",
      name: "Tools",
      category: "tools",
      categoryLabel: "Tools",
      items: [
        { name: "Multi-tool", quantity: 1 },
        { name: "Screwdriver", quantity: 1 },
        { name: "Wrench", quantity: 1 },
        { name: "Pliers", quantity: 1 },
        { name: "Duct tape", quantity: 1 },
        { name: "Zip ties", quantity: 1 },
        { name: "Work gloves", quantity: 1 },
        { name: "Flashlight", quantity: 1 },
        { name: "Batteries", quantity: 1 },
        { name: "Tire pressure gauge", quantity: 1 },
      ],
    },
    {
      id: "food",
      name: "Food",
      category: "food",
      categoryLabel: "Food",
      items: [
        { name: "Water", quantity: 1 },
        { name: "Snacks", quantity: 1 },
        { name: "Breakfast items", quantity: 1 },
        { name: "Lunch items", quantity: 1 },
        { name: "Dinner items", quantity: 1 },
        { name: "Coffee", quantity: 1 },
        { name: "Cooking oil", quantity: 1 },
        { name: "Seasoning", quantity: 1 },
        { name: "Utensils", quantity: 1 },
        { name: "Trash bags", quantity: 1 },
      ],
    },
  ];

function FrostedCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: any;
}) {
  const theme = useThemedValues();

  return (
    <BlurView
      intensity={theme.isLight ? 22 : 35}
      tint={theme.isLight ? "light" : "dark"}
      style={[
        styles.card,
        {
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.card,
        },
        style,
      ]}
    >
      {children}
    </BlurView>
  );
}

function createEditableItems(
  sourceItems: { name: string; quantity: number; packed?: boolean }[]
): EditableTemplateItem[] {
  return sourceItems.map((item, index) => ({
    id: `${Date.now()}-${index}`,
    name: item.name,
    quantity: Math.max(1, Number(item.quantity ?? 1)),
    packed: Boolean(item.packed ?? false),
    itemPhotoUri: "",
  }));
}

function renderStarterTemplateIcon(
  category: ChecklistCategory,
  color: string
) {
  switch (category) {
    case "trip":
      return <Backpack size={24} color={color} />;
    case "camping":
      return <Tent size={24} color={color} />;
    case "hunting":
      return <Crosshair size={24} color={color} />;
    case "fishing":
      return <Fish size={24} color={color} />;
    case "boating":
      return <Sailboat size={24} color={color} />;
    case "clothing":
      return <Shirt size={24} color={color} />;
    case "electronics":
      return <Zap size={24} color={color} />;
    case "medical":
      return <HeartPulse size={24} color={color} />;
    case "tools":
      return <Wrench size={24} color={color} />;
    case "food":
      return <Utensils size={24} color={color} />;
    default:
      return <Backpack size={24} color={color} />;
  }
}

export default function CreateTemplateScreen() {
  const { user } = useAuth();
  const theme = useThemedValues();

  const [name, setName] = useState("");
  const [category, setCategory] = useState<ChecklistCategory>("trip");
  const [customCategory, setCustomCategory] = useState("");
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [starterModalVisible, setStarterModalVisible] = useState(false);
  const [items, setItems] = useState<EditableTemplateItem[]>([
    { id: "1", name: "", quantity: 1, packed: false },
  ]);
  const [saving, setSaving] = useState(false);
  const itemInputRefs = useRef<Record<string, TextInput | null>>({});

  const selectedCategoryLabel =
    CATEGORY_OPTIONS.find((option) => option.key === category)?.label ??
    "Select Category";

  function addItem() {
    setItems((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        name: "",
        quantity: 1,
        packed: false,
        itemPhotoUri: "",
      },
    ]);
  }

  function updateItem(id: string, value: string) {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, name: value } : item))
    );
  }

  function updateItemQuantity(id: string, quantity: number) {
    const safeQuantity = Math.max(1, Number(quantity) || 1);

    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, quantity: safeQuantity } : item
      )
    );
  }

  function toggleItemPacked(id: string) {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, packed: !item.packed } : item
      )
    );
  }

  function removeItem(id: string) {
    setItems((prev) => {
      if (prev.length === 1) {
        return [
          { id: "1", name: "", quantity: 1, packed: false, itemPhotoUri: "" },
        ];
      }

      return prev.filter((item) => item.id !== id);
    });
  }

  function updateItemPhoto(id: string, itemPhotoUri: string) {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, itemPhotoUri: itemPhotoUri ?? "" } : item
      )
    );
  }

  function focusItemName(id: string) {
    itemInputRefs.current[id]?.focus();
  }

  function handleItemPhotoAction(item: EditableTemplateItem) {
    Alert.alert("Item Photo", item.name.trim() || "Checklist item", [
      {
        text: "Take Photo",
        onPress: () => void handleTakeItemPhoto(item),
      },
      {
        text: "Choose Photo",
        onPress: () => void handlePickItemPhoto(item),
      },
      ...(item.itemPhotoUri
        ? [
          {
            text: "Remove Photo",
            style: "destructive" as const,
            onPress: () => updateItemPhoto(item.id, ""),
          },
        ]
        : []),
      {
        text: "Cancel",
        style: "cancel",
      },
    ]);
  }

  async function handleTakeItemPhoto(item: EditableTemplateItem) {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();

      if (!permission.granted) {
        Alert.alert("Camera access needed", "Please allow camera access first.");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.8,
      });

      if (result.canceled) return;

      const asset = result.assets?.[0];

      if (!asset?.uri) {
        Alert.alert("Photo not captured", "No valid image was returned.");
        return;
      }

      updateItemPhoto(item.id, asset.uri);
    } catch (err: any) {
      const message = String(err?.message ?? err ?? "");

      if (message.toLowerCase().includes("camera not available on simulator")) {
        Alert.alert(
          "Simulator Limitation",
          "Take Photo is not available on the iPhone Simulator. Use Choose Photo here, or test Take Photo on a real iPhone."
        );
      } else {
        console.error("Failed to take template item photo:", err);
        Alert.alert("Error", "Failed to save item photo.");
      }
    }
  }

  async function handlePickItemPhoto(item: EditableTemplateItem) {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.8,
      });

      if (result.canceled) return;

      const asset = result.assets?.[0];

      if (!asset?.uri) {
        Alert.alert("Photo not selected", "No valid image was returned.");
        return;
      }

      updateItemPhoto(item.id, asset.uri);
    } catch (err) {
      console.error("Failed to choose template item photo:", err);
      Alert.alert("Error", "Failed to save item photo.");
    }
  }

  function handleSelectCategory(nextCategory: ChecklistCategory) {
    setCategory(nextCategory);
    setCategoryModalVisible(false);

    if (nextCategory !== "custom") {
      setCustomCategory("");
    }
  }

  function handleUseStarterTemplate(starterId: string) {
    const starter = STARTER_TEMPLATE_OPTIONS.find(
      (template) => template.id === starterId
    );

    if (!starter) {
      return;
    }

    const applyStarter = () => {
      setName(starter.name);
      setCategory(starter.category);
      setCustomCategory("");
      setItems(createEditableItems(starter.items));
      setStarterModalVisible(false);
    };

    const hasExistingData =
      name.trim().length > 0 ||
      customCategory.trim().length > 0 ||
      items.some((item) => item.name.trim().length > 0);

    if (hasExistingData) {
      Alert.alert(
        "Replace current template?",
        "This will replace the current name and item list with the starter template. You can still edit everything before saving.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Replace",
            style: "destructive",
            onPress: applyStarter,
          },
        ]
      );
      return;
    }

    applyStarter();
  }

  function handleDiscardDraft() {
    const hasDraft =
      name.trim().length > 0 ||
      customCategory.trim().length > 0 ||
      items.some((item) => item.name.trim().length > 0);

    if (!hasDraft) {
      router.back();
      return;
    }

    Alert.alert(
      "Discard template?",
      "This will discard your current template draft. Nothing will be saved.",
      [
        { text: "Keep Editing", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: () => router.back(),
        },
      ]
    );
  }

  async function handleSave() {
    if (!user) {
      Alert.alert("Sign in required", "Please sign in to create a template.");
      return;
    }

    const trimmedName = name.trim();
    const trimmedCustomCategory = customCategory.trim();
    console.log("CREATE TEMPLATE: save attempt", {
      name: trimmedName,
      category,
      rawItems: items.map((item) => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
      })),
    });

    const validItems = items
      .map((item) => ({
        name: item.name.trim(),
        quantity: Math.max(1, Number(item.quantity ?? 1)),
        packed: Boolean(item.packed ?? false),
        itemPhotoUri: item.itemPhotoUri ?? "",
      }))
      .filter((item) => item.name.length > 0);

    console.log("CREATE TEMPLATE: valid items", validItems);

    if (!trimmedName) {
      Alert.alert("Required name", "Please enter a template name.");
      return;
    }

    if (category === "custom" && !trimmedCustomCategory) {
      Alert.alert("Required category", "Please enter a custom category.");
      return;
    }

    try {
      setSaving(true);

      await createChecklistTemplateWithItems(user.uid, {
        name: trimmedName,
        category,
        customCategoryLabel:
          category === "custom" ? trimmedCustomCategory : "",
        items: validItems,
      });

      router.back();
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Failed to create template.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
          style={styles.keyboardAvoidingView}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
          >
            <AppHeader title="" showBackButton />

            <View style={styles.heroHeader}>
              <ThemedText variant="header" style={[styles.heroTitle, { color: "#FFFFFF" }]}>
                Create Template
              </ThemedText>
              <ThemedText color="secondary" style={[styles.heroText, { color: "#E5E7EB" }]}>
                Build a reusable checklist with starter items, quantities, and default pack status.
              </ThemedText>
            </View>

            <FrostedCard>
              <ThemedText variant="title" style={styles.sectionTitle}>
                Choose a generic list
              </ThemedText>

              <ThemedText color="secondary" style={styles.helperText}>
                Select a starter template across any category. The category,
                template name, items, and quantities will be filled in for you.
              </ThemedText>

              <HapticPressable
                style={[
                  styles.starterButton,
                  {
                    backgroundColor: theme.colors.inputSurface,
                    borderColor: theme.colors.border,
                  },
                ]}
                onPress={() => setStarterModalVisible((prev) => !prev)}
              >
                <ThemedText style={styles.starterButtonText}>
                  Choose Starter Template
                </ThemedText>
                <ChevronDown size={18} color={theme.colors.textSecondary} />
              </HapticPressable>

              {starterModalVisible ? (
                <BlurView
                  intensity={theme.isLight ? 35 : 48}
                  tint={theme.isLight ? "light" : "dark"}
                  style={[
                    styles.inlineDropdown,
                    {
                      borderColor: theme.colors.border,
                      backgroundColor: theme.isLight
                        ? "rgba(255,255,255,0.52)"
                        : "rgba(255,255,255,0.08)",
                    },
                  ]}
                >
                  <ScrollView
                    nestedScrollEnabled
                    showsVerticalScrollIndicator={false}
                    style={styles.inlineDropdownScroll}
                    contentContainerStyle={styles.inlineDropdownScrollContent}
                  >
                    {STARTER_TEMPLATE_OPTIONS.map((starter) => {
                      const selected =
                        name.trim() === starter.name &&
                        category === starter.category;

                      return (
                        <HapticPressable
                          key={starter.id}
                          style={[
                            styles.inlineDropdownOption,
                            selected ? styles.inlineDropdownOptionSelected : {},
                          ]}
                          onPress={() => handleUseStarterTemplate(starter.id)}
                        >
                          <View
                            style={[
                              styles.inlineDropdownIconWrap,
                              {
                                backgroundColor: theme.isLight
                                  ? "rgba(255,255,255,0.48)"
                                  : "rgba(255,255,255,0.10)",
                                borderColor: theme.colors.border,
                              },
                            ]}
                          >
                            {renderStarterTemplateIcon(
                              starter.category,
                              theme.colors.textSecondary
                            )}
                          </View>

                          <View style={styles.inlineDropdownTextWrap}>
                            <ThemedText style={styles.inlineDropdownOptionText}>
                              {starter.name}
                            </ThemedText>
                            <ThemedText
                              color="secondary"
                              style={styles.starterItemCount}
                            >
                              {starter.categoryLabel} • {starter.items.length} items
                            </ThemedText>
                          </View>

                          {selected ? (
                            <View style={styles.inlineDropdownCheck}>
                              <Check size={18} color="#fff" />
                            </View>
                          ) : null}
                        </HapticPressable>
                      );
                    })}
                  </ScrollView>
                </BlurView>
              ) : null}
            </FrostedCard>

            <FrostedCard>
              <ThemedText variant="title" style={styles.sectionTitle}>
                Template Name
              </ThemedText>

              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Enter template name"
                placeholderTextColor={theme.colors.textMuted}
                style={[
                  styles.input,
                  {
                    color: theme.colors.text,
                    backgroundColor: theme.colors.inputSurface,
                    borderColor: theme.colors.border,
                  },
                ]}
                returnKeyType="done"
              />

              <ThemedText variant="title" style={styles.sectionTitle}>
                Category
              </ThemedText>

              <HapticPressable
                style={[
                  styles.dropdownButton,
                  {
                    backgroundColor: theme.colors.inputSurface,
                    borderColor: theme.colors.border,
                  },
                ]}
                onPress={() => setCategoryModalVisible((prev) => !prev)}
              >
                <ThemedText style={styles.dropdownButtonText}>
                  {selectedCategoryLabel}
                </ThemedText>
                <ChevronDown size={18} color={theme.colors.textSecondary} />
              </HapticPressable>

              {categoryModalVisible ? (
                <BlurView
                  intensity={theme.isLight ? 35 : 48}
                  tint={theme.isLight ? "light" : "dark"}
                  style={[
                    styles.inlineDropdown,
                    {
                      borderColor: theme.colors.border,
                      backgroundColor: theme.isLight
                        ? "rgba(255,255,255,0.52)"
                        : "rgba(255,255,255,0.08)",
                    },
                  ]}
                >
                  <ScrollView
                    key={`category-dropdown-${categoryModalVisible}`}
                    nestedScrollEnabled
                    showsVerticalScrollIndicator={false}
                    style={styles.inlineDropdownScroll}
                    contentContainerStyle={styles.inlineDropdownScrollContent}
                    keyboardShouldPersistTaps="handled"
                  >
                    {CATEGORY_OPTIONS.map((option, index) => {
                      const selected = category === option.key;

                      return (
                        <HapticPressable
                          key={option.key}
                          style={[
                            styles.inlineDropdownOption,
                            selected ? styles.inlineDropdownOptionSelected : {},
                          ]}
                          onPress={() => handleSelectCategory(option.key)}
                        >
                          <View
                            style={[
                              styles.inlineDropdownIconWrap,
                              {
                                backgroundColor: theme.isLight
                                  ? "rgba(255,255,255,0.48)"
                                  : "rgba(255,255,255,0.10)",
                                borderColor: theme.colors.border,
                              },
                            ]}
                          >
                            {renderStarterTemplateIcon(
                              option.key,
                              theme.colors.textSecondary
                            )}
                          </View>

                          <View style={styles.inlineDropdownTextWrap}>
                            <ThemedText style={styles.inlineDropdownOptionText}>
                              {option.label}
                            </ThemedText>
                            <ThemedText
                              color="secondary"
                              style={styles.starterItemCount}
                            >
                              Checklist category
                            </ThemedText>
                          </View>

                          {selected ? (
                            <View style={styles.inlineDropdownCheck}>
                              <Check size={18} color="#fff" />
                            </View>
                          ) : null}
                        </HapticPressable>
                      );
                    })}
                  </ScrollView>
                </BlurView>
              ) : null}

              {category === "custom" ? (
                <View style={styles.customCategoryWrap}>
                  <ThemedText variant="title" style={styles.sectionTitle}>
                    Custom Category
                  </ThemedText>

                  <TextInput
                    value={customCategory}
                    onChangeText={setCustomCategory}
                    placeholder="Enter custom category"
                    placeholderTextColor={theme.colors.textMuted}
                    style={[
                      styles.input,
                      {
                        color: theme.colors.text,
                        backgroundColor: theme.colors.inputSurface,
                        borderColor: theme.colors.border,
                      },
                    ]}
                    returnKeyType="done"
                  />
                </View>
              ) : null}
            </FrostedCard>

            <FrostedCard>
              <View style={styles.itemsHeaderRow}>
                <View style={styles.itemsHeaderTextWrap}>
                  <ThemedText variant="title" style={styles.sectionTitle}>
                    Items
                  </ThemedText>
                </View>

                <HapticPressable
                  style={[
                    styles.addIconButton,
                    {
                      backgroundColor: theme.colors.iconSurface,
                      borderColor: theme.colors.border,
                    },
                  ]}
                  onPress={addItem}
                >
                  <Plus size={18} color={theme.colors.text} />
                </HapticPressable>
              </View>

              {items.map((item, index) => {
                const packed = Boolean(item.packed);

                return (
                  <View
                    key={item.id}
                    style={[
                      styles.itemBlock,
                      packed ? styles.packedItemCard : styles.unpackedItemCard,
                      {
                        borderColor: packed
                          ? "rgba(34,197,94,0.88)"
                          : theme.colors.border,
                        backgroundColor: theme.colors.card,
                      },
                    ]}
                  >
                    <View style={styles.itemContentRow}>
                      <HapticPressable
                        style={styles.itemPhotoWrap}
                        onPress={() => handleItemPhotoAction(item)}
                      >
                        {item.itemPhotoUri ? (
                          <Image
                            source={{ uri: item.itemPhotoUri }}
                            style={styles.itemPhoto}
                          />
                        ) : (
                          <View
                            style={[
                              styles.itemPhotoPlaceholder,
                              {
                                backgroundColor: theme.colors.iconSurface,
                                borderColor: theme.colors.border,
                              },
                            ]}
                          >
                            <Camera
                              size={18}
                              color={theme.colors.textSecondary}
                            />
                            <ThemedText
                              style={[
                                styles.itemPhotoPlaceholderText,
                                { color: theme.colors.textSecondary },
                              ]}
                            >
                              Photo
                            </ThemedText>
                          </View>
                        )}
                      </HapticPressable>

                      <View style={styles.itemMainContent}>
                        <View style={styles.itemTopRow}>
                          <View style={styles.itemTitleWrap}>
                            <TextInput
                              ref={(ref) => {
                                itemInputRefs.current[item.id] = ref;
                              }}
                              value={item.name}
                              onChangeText={(text) => updateItem(item.id, text)}
                              placeholder={`Item ${index + 1}`}
                              placeholderTextColor={theme.colors.textMuted}
                              style={[
                                styles.itemNameInput,
                                {
                                  color: packed
                                    ? theme.colors.textSecondary
                                    : theme.colors.text,
                                },
                              ]}
                              returnKeyType="done"
                            />

                            <ThemedText
                              style={[
                                styles.itemCategoryText,
                                { color: theme.colors.textSecondary },
                              ]}
                            >
                              {selectedCategoryLabel}
                            </ThemedText>

                            {packed ? (
                              <ThemedText style={styles.packedBadge}>
                                Packed
                              </ThemedText>
                            ) : null}
                          </View>

                          <View style={styles.itemActions}>
                            <HapticPressable
                              style={[
                                styles.iconButton,
                                {
                                  backgroundColor: theme.colors.iconSurface,
                                  borderColor: theme.colors.border,
                                },
                              ]}
                              onPress={() => handleItemPhotoAction(item)}
                            >
                              <Camera
                                size={16}
                                color={theme.colors.textSecondary}
                              />
                            </HapticPressable>

                            <HapticPressable
                              style={[
                                styles.iconButton,
                                {
                                  backgroundColor: theme.colors.iconSurface,
                                  borderColor: theme.colors.border,
                                },
                              ]}
                              onPress={() => focusItemName(item.id)}
                            >
                              <Edit3
                                size={16}
                                color={theme.colors.textSecondary}
                              />
                            </HapticPressable>

                            <HapticPressable
                              style={[
                                styles.iconButton,
                                {
                                  backgroundColor: theme.colors.iconSurface,
                                  borderColor: theme.colors.border,
                                },
                              ]}
                              onPress={() => removeItem(item.id)}
                            >
                              <Trash2 size={16} color={theme.colors.danger} />
                            </HapticPressable>
                          </View>
                        </View>

                        <View style={styles.metricsWrap}>
                          <ThemedText
                            style={[
                              styles.metricText,
                              {
                                color: packed
                                  ? theme.colors.textMuted
                                  : theme.colors.textSecondary,
                              },
                            ]}
                          >
                            Needed: {item.quantity}
                          </ThemedText>

                          <ThemedText
                            style={[
                              styles.metricText,
                              {
                                color: packed
                                  ? theme.colors.textMuted
                                  : theme.colors.textSecondary,
                              },
                            ]}
                          >
                            Packed: {packed ? item.quantity : 0}
                          </ThemedText>

                          <ThemedText
                            style={[
                              styles.metricText,
                              {
                                color: packed
                                  ? theme.colors.textMuted
                                  : theme.colors.danger,
                              },
                            ]}
                          >
                            Still To Pack: {packed ? 0 : item.quantity}
                          </ThemedText>
                        </View>

                        <View style={styles.controlsRow}>
                          <View style={styles.quantityControls}>
                            <HapticPressable
                              style={[
                                styles.quantityButton,
                                {
                                  backgroundColor: theme.colors.iconSurface,
                                  borderColor: theme.colors.border,
                                },
                              ]}
                              onPress={() =>
                                updateItemQuantity(item.id, item.quantity - 1)
                              }
                            >
                              <Minus size={16} color={theme.colors.text} />
                            </HapticPressable>

                            <View style={styles.quantityValueWrap}>
                              <ThemedText style={styles.quantityValue}>
                                {item.quantity}
                              </ThemedText>
                            </View>

                            <HapticPressable
                              style={[
                                styles.quantityButton,
                                {
                                  backgroundColor: theme.colors.iconSurface,
                                  borderColor: theme.colors.border,
                                },
                              ]}
                              onPress={() =>
                                updateItemQuantity(item.id, item.quantity + 1)
                              }
                            >
                              <Plus size={16} color={theme.colors.text} />
                            </HapticPressable>
                          </View>

                          <HapticPressable
                            style={[
                              styles.packedToggleButton,
                              packed
                                ? styles.packedToggleButtonPacked
                                : styles.packedToggleButtonToPack,
                              !packed && {
                                backgroundColor: theme.colors.iconSurface,
                                borderColor: theme.colors.border,
                              },
                            ]}
                            onPress={() => toggleItemPacked(item.id)}
                          >
                            <CheckCircle2
                              size={13}
                              color={packed ? "#fff" : theme.colors.text}
                            />
                            <ThemedText
                              style={[
                                styles.packedToggleButtonText,
                                { color: theme.colors.text },
                                packed ? styles.packedToggleButtonTextOn : {},
                              ]}
                            >
                              {packed ? "Packed" : "Mark Packed"}
                            </ThemedText>
                          </HapticPressable>
                        </View>
                      </View>
                    </View>
                  </View>
                );
              })}

              <HapticPressable
                style={[
                  styles.addItemButton,
                  {
                    backgroundColor: theme.colors.iconSurface,
                    borderColor: theme.colors.border,
                  },
                ]}
                onPress={addItem}
              >
                <Plus size={18} color={theme.colors.text} />
                <ThemedText style={styles.addItemButtonText}>
                  Add Item
                </ThemedText>
              </HapticPressable>
            </FrostedCard>

            <ThemedButton
              style={[
                styles.primaryButton,
                saving ? styles.primaryButtonDisabled : {},
              ]}
              onPress={handleSave}
              disabled={saving}
            >
              <ThemedText style={styles.primaryButtonText}>
                {saving ? "Creating..." : "Create Template"}
              </ThemedText>
            </ThemedButton>

            <HapticPressable
              style={styles.discardButton}
              onPress={handleDiscardDraft}
              disabled={saving}
            >
              <ThemedText style={styles.discardButtonText}>
                Discard
              </ThemedText>
            </HapticPressable>
          </ScrollView>
        </KeyboardAvoidingView>

      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "transparent",
  },

  keyboardAvoidingView: {
    flex: 1,
  },

  content: {
    flexGrow: 1,
    padding: 16,
    paddingBottom: 180,
  },

  card: {
    marginBottom: 14,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    overflow: "hidden",
  },

  heroCard: {
    paddingVertical: 18,
  },

  heroHeader: {
    marginBottom: 18,
  },

  heroTitle: {
    marginBottom: 6,
    lineHeight: 24,
  },

  heroText: {
    fontSize: 14,
    lineHeight: 20,
  },

  helperText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },

  sectionEyebrow: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 6,
    opacity: 0.82,
  },

  sectionTitle: {
    marginBottom: 10,
    lineHeight: 22,
  },

  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 14,
  },

  dropdownButton: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  dropdownButtonText: {
    fontSize: 15,
    fontWeight: "700",
  },

  customCategoryWrap: {
    marginTop: 4,
  },

  inlineDropdown: {
    marginTop: 8,
    marginBottom: 14,
    maxHeight: 300,
    borderRadius: 18,
    borderWidth: 1,
    padding: 8,
    overflow: "hidden",
  },

  inlineDropdownScroll: {
    maxHeight: 284,
  },

  inlineDropdownScrollContent: {
    paddingBottom: 2,
  },

  inlineDropdownOption: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  inlineDropdownOptionSelected: {
    borderColor: "rgba(59,130,246,0.95)",
    backgroundColor: "rgba(255,255,255,0.12)",
  },

  inlineDropdownIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },

  inlineDropdownTextWrap: {
    flex: 1,
  },

  inlineDropdownCheck: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(59,130,246,0.95)",
  },

  inlineDropdownOptionText: {
    fontSize: 15,
    fontWeight: "700",
  },

  inlineDropdownOptionTextSelected: {
    color: "rgb(59,130,246)",
  },

  starterButton: {
    marginTop: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },

  starterButtonText: {
    fontSize: 14,
    fontWeight: "700",
  },

  itemsHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 4,
  },

  itemsHeaderTextWrap: {
    flex: 1,
    paddingRight: 12,
  },

  addIconButton: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },

  itemBlock: {
    marginBottom: 14,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
  },

  packedItemCard: {
    opacity: 1,
    backgroundColor: "rgba(255,255,255,0.03)",
  },

  unpackedItemCard: {
    opacity: 1,
  },

  itemContentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  itemPhotoWrap: {
    width: 82,
    height: 82,
    borderRadius: 14,
    marginRight: 14,
    overflow: "hidden",
  },

  itemPhoto: {
    width: "100%",
    height: "100%",
    borderRadius: 14,
  },

  itemPhotoPlaceholder: {
    width: 82,
    height: 82,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    paddingHorizontal: 6,
    marginRight: 14,
  },

  itemPhotoPlaceholderText: {
    fontSize: 11,
    fontWeight: "700",
    marginTop: 6,
  },

  itemMainContent: {
    flex: 1,
  },

  itemTitleWrap: {
    flex: 1,
    paddingRight: 12,
  },

  itemCategoryText: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
    marginTop: 2,
  },

  packedBadge: {
    alignSelf: "flex-start",
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(34,197,94,0.10)",
    color: "#22C55E",
    fontSize: 11,
    fontWeight: "700",
  },

  itemActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },

  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },

  metricsWrap: {
    marginBottom: 12,
    gap: 5,
  },

  metricText: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },

  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  quantityValueWrap: {
    minWidth: 36,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 8,
  },

  itemTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  itemCategoryBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
  },

  itemCategoryBadgeText: {
    fontSize: 12,
    fontWeight: "800",
  },

  itemStatsRow: {
    marginTop: 10,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 10,
    backgroundColor: "rgba(255,255,255,0.07)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  itemStatBlock: {
    flex: 1,
    alignItems: "center",
  },

  itemStatLabel: {
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 4,
  },

  itemStatValue: {
    fontSize: 18,
    fontWeight: "800",
  },

  itemStatDivider: {
    width: 1,
    height: 34,
    backgroundColor: "rgba(255,255,255,0.14)",
  },

  itemActionsRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  itemIconActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  itemActionIconButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },

  itemHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },

  itemNameWrap: {
    flex: 1,
  },

  itemNameInput: {
    fontSize: 16,
    fontWeight: "700",
    paddingVertical: 4,
    marginBottom: 8,
  },

  statusPill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },

  statusPillPacked: {
    backgroundColor: "rgba(59,130,246,0.18)",
  },

  statusPillToPack: {
    backgroundColor: "rgba(148,163,184,0.18)",
  },

  statusPillText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },

  deleteButton: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },

  quantityRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  quantityLabel: {
    fontSize: 13,
    fontWeight: "700",
  },

  quantityControls: {
    flexDirection: "row",
    alignItems: "center",
  },

  quantityButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },

  quantityValue: {
    fontSize: 16,
    fontWeight: "700",
  },

  packedToggleButton: {
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 5,
    borderWidth: 1,
    flexShrink: 1,
  },

  packedToggleButtonPacked: {
    backgroundColor: "rgba(59,130,246,0.96)",
    borderColor: "rgba(59,130,246,1)",
  },

  packedToggleButtonToPack: {
    backgroundColor: "rgba(59,130,246,0.92)",
  },

  packedToggleButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },

  packedToggleButtonTextOn: {
    color: "#fff",
  },

  addItemButton: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
  },

  addItemButtonText: {
    fontSize: 14,
    fontWeight: "700",
  },

  primaryButton: {
    marginTop: 6,
    paddingVertical: 15,
    borderRadius: 14,
  },

  primaryButtonDisabled: {
    opacity: 0.6,
  },

  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },

  discardButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    marginTop: 4,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },

  discardButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#000000",
  },

  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: 16,
    paddingBottom: 24,
    backgroundColor: "rgba(0,0,0,0.42)",
  },

  modalCard: {
    borderRadius: 24,
    padding: 18,
    overflow: "hidden",
    borderWidth: 1,
  },

  starterModalCard: {
    maxHeight: "72%",
  },

  modalTitle: {
    marginBottom: 12,
  },

  modalHelperText: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },

  modalOption: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 10,
  },

  modalOptionSelected: {
    borderColor: "rgba(55,130,245,0.95)",
    backgroundColor: "rgba(55,130,245,0.95)",
  },

  modalOptionText: {
    fontSize: 15,
    fontWeight: "700",
  },

  modalOptionTextSelected: {
    color: "#fff",
  },

  starterItemCount: {
    marginTop: 4,
    fontSize: 13,
  },

  modalCancelButton: {
    alignItems: "center",
    paddingVertical: 8,
    marginTop: 4,
  },

  modalCancelText: {
    fontSize: 14,
    fontWeight: "700",
  },
});