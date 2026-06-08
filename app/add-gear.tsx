import { router, useLocalSearchParams } from "expo-router";
import { Save } from "lucide-react-native";
import React, { useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../components/auth/AuthProvider";
import AppHeader from "../components/ui/AppHeader";
import HapticPressable from "../components/ui/HapticPressable";
import ScreenBackground from "../components/ui/ScreenBackground";
import {
  ThemedButton,
  ThemedCard,
  ThemedText,
  useThemedValues,
} from "../components/ui/Themed";
import { createItem } from "../lib/gearService";
import { triggerSuccessHaptic } from "../lib/haptics";
import { useInteractionLock } from "../lib/useInteractionLock";

export default function AddGearScreen() {
  const { user, initializing } = useAuth();
  const params = useLocalSearchParams<{ name?: string | string[] }>();
  const theme = useThemedValues();
  const { isLocked, lock, unlock } = useInteractionLock(650);

  const initialName = useMemo(() => {
    const rawName = Array.isArray(params.name) ? params.name[0] : params.name;
    return String(rawName ?? "").trim();
  }, [params.name]);

  const [itemName, setItemName] = useState(initialName);
  const [quantity, setQuantity] = useState("1");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const canSave =
    !!user &&
    !initializing &&
    !saving &&
    !isLocked &&
    itemName.trim().length > 0;

  async function handleSave() {
    if (!canSave) return;

    lock();

    try {
      setSaving(true);

      const parsedQty = Math.max(1, Number(quantity) || 1);

      await createItem({
        name: itemName.trim(),
        quantity: parsedQty,
        status: "missing",
        notes: notes.trim(),
        source: "siri-shortcut",
        itemPhotoUri: "",
      });

      await triggerSuccessHaptic();

      Alert.alert(
        "Gear added",
        "Your item was added to inventory. You can assign it to a storage space or compartment later.",
        [
          {
            text: "View Inventory",
            onPress: () => router.replace("/(tabs)/inventory"),
          },
        ]
      );
    } catch (err) {
      console.error("Failed to add gear:", err);
      Alert.alert("Could not add gear", "Something went wrong while adding this item.");
    } finally {
      setSaving(false);
      unlock();
    }
  }

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.keyboardAvoidingView}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <AppHeader title="Add Gear" showBackButton backHref="/(tabs)/inventory" />

            <ThemedCard style={styles.card} contentStyle={styles.cardContent}>
              <ThemedText variant="header" style={styles.cardTitle}>
                Add a gear item
              </ThemedText>

              <ThemedText color="secondary" style={styles.cardSubtitle}>
                Add an item quickly now. You can organize it into a storage space,
                room, or compartment later.
              </ThemedText>

              <View style={styles.formGroup}>
                <ThemedText variant="bodyStrong" style={styles.label}>
                  Item Name
                </ThemedText>

                <TextInput
                  value={itemName}
                  onChangeText={setItemName}
                  placeholder="Camp stove, recovery strap, first aid kit..."
                  placeholderTextColor={theme.colors.textMuted}
                  style={[
                    styles.input,
                    {
                      color: theme.colors.text,
                      borderColor: theme.colors.border,
                      backgroundColor: theme.colors.inputSurface,
                    },
                  ]}
                  autoFocus
                  returnKeyType="next"
                />
              </View>

              <View style={styles.formGroup}>
                <ThemedText variant="bodyStrong" style={styles.label}>
                  Quantity
                </ThemedText>

                <TextInput
                  value={quantity}
                  onChangeText={setQuantity}
                  placeholder="1"
                  placeholderTextColor={theme.colors.textMuted}
                  style={[
                    styles.input,
                    styles.quantityInput,
                    {
                      color: theme.colors.text,
                      borderColor: theme.colors.border,
                      backgroundColor: theme.colors.inputSurface,
                    },
                  ]}
                  keyboardType="number-pad"
                />
              </View>

              <View style={styles.formGroup}>
                <ThemedText variant="bodyStrong" style={styles.label}>
                  Notes
                </ThemedText>

                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Optional notes..."
                  placeholderTextColor={theme.colors.textMuted}
                  style={[
                    styles.input,
                    styles.notesInput,
                    {
                      color: theme.colors.text,
                      borderColor: theme.colors.border,
                      backgroundColor: theme.colors.inputSurface,
                    },
                  ]}
                  multiline
                  textAlignVertical="top"
                />
              </View>

              <ThemedButton onPress={handleSave} disabled={!canSave}>
                <ThemedText style={styles.primaryButtonText}>
                  {saving ? "Adding Gear..." : "Add Gear"}
                </ThemedText>
              </ThemedButton>

              <HapticPressable
                style={styles.secondaryButton}
                onPress={() => router.replace("/(tabs)/inventory")}
                disabled={saving || isLocked}
              >
                <ThemedText color="secondary">Cancel</ThemedText>
              </HapticPressable>
            </ThemedCard>

            <View style={styles.footerNote}>
              <Save size={16} color={theme.colors.textMuted} />
              <ThemedText color="muted" style={styles.footerText}>
                Shortcut items are saved as To Pack until you mark them packed.
              </ThemedText>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 32,
  },
  card: {
    marginTop: 8,
  },
  cardContent: {
    padding: 18,
  },
  cardTitle: {
    marginBottom: 8,
  },
  cardSubtitle: {
    lineHeight: 20,
    marginBottom: 18,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  quantityInput: {
    maxWidth: 120,
  },
  notesInput: {
    minHeight: 96,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  secondaryButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    marginTop: 8,
  },
  footerNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 4,
  },
  footerText: {
    flex: 1,
    lineHeight: 18,
  },
});
