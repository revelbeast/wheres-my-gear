import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  ScrollView,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import AppHeader from "../../components/ui/AppHeader";
import HapticPressable from "../../components/ui/HapticPressable";
import ScreenBackground from "../../components/ui/ScreenBackground";
import {
  getStorageSpaceById,
  updateStorageSpace,
} from "../../lib/gearService";
import { colors } from "../../theme/tokens";

const VEHICLE_TYPES = [
  "Car",
  "SUV",
  "Truck",
  "Van",
  "RV Class A",
  "RV Class B",
  "RV Class C",
  "Travel Trailer",
  "Fifth Wheel",
  "Motorcycle",
  "Boat",
  "Other Vehicle",
];

const STORAGE_TYPES = [
  "Garage",
  "Shed",
  "Basement",
  "Attic",
  "Closet",
  "Workshop",
  "Storage Unit",
  "Office",
  "Other Storage",
];

type StorageCategory = "vehicle" | "storage";

function getSafeCategory(category: unknown): StorageCategory {
  return category === "storage" ? "storage" : "vehicle";
}

export default function EditStorageScreen() {
  const { storageId } = useLocalSearchParams<{ storageId: string }>();

  const [name, setName] = useState("");
  const [category, setCategory] = useState<StorageCategory>("vehicle");
  const [subtype, setSubtype] = useState("");
  const [customSubtype, setCustomSubtype] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const typeOptions = category === "vehicle" ? VEHICLE_TYPES : STORAGE_TYPES;

  const isOtherSelected =
    subtype === "Other Vehicle" || subtype === "Other Storage";

  const finalSubtype = isOtherSelected ? customSubtype.trim() : subtype.trim();

  useEffect(() => {
    loadStorage();
  }, [storageId]);

  async function loadStorage() {
    if (!storageId) return;

    try {
      const data = await getStorageSpaceById(String(storageId));
      if (!data) return;

      const safeCategory = getSafeCategory(data.category);
      const safeSubtype = data.subtype ?? "";

      setName(data.name ?? "");
      setCategory(safeCategory);

      const options =
        safeCategory === "vehicle" ? VEHICLE_TYPES : STORAGE_TYPES;

      if (safeSubtype && options.includes(safeSubtype)) {
        setSubtype(safeSubtype);
        setCustomSubtype("");
      } else {
        setSubtype(
          safeCategory === "vehicle" ? "Other Vehicle" : "Other Storage"
        );
        setCustomSubtype(safeSubtype);
      }
    } catch (err) {
      console.error("Failed to load storage space:", err);
    } finally {
      setLoading(false);
    }
  }

  function handleCategoryChange(next: StorageCategory) {
    setCategory(next);
    setSubtype("");
    setCustomSubtype("");
  }

  function handleSubtypeSelect(type: string) {
    setSubtype(type);
    if (type !== "Other Vehicle" && type !== "Other Storage") {
      setCustomSubtype("");
    }
  }

  async function handleSave() {
    if (!storageId || !name.trim() || !finalSubtype) return;

    try {
      setSaving(true);
      await updateStorageSpace(String(storageId), {
        name: name.trim(),
        category,
        subtype: finalSubtype,
      });
      router.back();
    } catch (err) {
      console.error("Failed to update storage space:", err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <AppHeader title="Edit Storage Space" showBackButton />

          {loading ? (
            <Text style={styles.helperText}>Loading...</Text>
          ) : (
            <>
              <Text style={styles.label}>Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. My Sprinter Van"
                placeholderTextColor={colors.textMuted}
                value={name}
                onChangeText={setName}
              />

              <Text style={styles.label}>Category</Text>
              <View style={styles.segmentContainer}>
                <HapticPressable
                  style={[
                    styles.segmentButton,
                    category === "vehicle" && styles.segmentActive,
                  ]}
                  onPress={() => handleCategoryChange("vehicle")}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      category === "vehicle" && styles.segmentTextActive,
                    ]}
                  >
                    Vehicle
                  </Text>
                </HapticPressable>

                <HapticPressable
                  style={[
                    styles.segmentButton,
                    category === "storage" && styles.segmentActive,
                  ]}
                  onPress={() => handleCategoryChange("storage")}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      category === "storage" && styles.segmentTextActive,
                    ]}
                  >
                    Storage
                  </Text>
                </HapticPressable>
              </View>

              <Text style={styles.label}>Type</Text>
              <View style={styles.typeContainer}>
                {typeOptions.map((type) => (
                  <HapticPressable
                    key={type}
                    style={[
                      styles.typeChip,
                      subtype === type && styles.typeChipActive,
                    ]}
                    onPress={() => handleSubtypeSelect(type)}
                  >
                    <Text
                      style={[
                        styles.typeText,
                        subtype === type && styles.typeTextActive,
                      ]}
                    >
                      {type}
                    </Text>
                  </HapticPressable>
                ))}
              </View>

              {isOtherSelected && (
                <>
                  <Text style={styles.label}>Custom Type</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter custom type"
                    placeholderTextColor={colors.textMuted}
                    value={customSubtype}
                    onChangeText={setCustomSubtype}
                  />
                </>
              )}

              <HapticPressable
                style={[
                  styles.button,
                  (!name.trim() || !finalSubtype || saving) &&
                    styles.buttonDisabled,
                ]}
                onPress={handleSave}
                disabled={!name.trim() || !finalSubtype || saving}
              >
                <Text style={styles.buttonText}>
                  {saving ? "Saving..." : "Save Changes"}
                </Text>
              </HapticPressable>
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
  },
  container: {
    padding: 16,
    paddingBottom: 140,
  },
  helperText: {
    color: colors.textSecondary,
  },
  label: {
    color: colors.text,
    marginTop: 14,
    marginBottom: 6,
    fontWeight: "600",
  },
  input: {
    backgroundColor: "rgba(7,20,44,0.7)",
    borderRadius: 12,
    padding: 12,
    color: colors.text,
  },
  segmentContainer: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 12,
    padding: 4,
  },
  segmentButton: {
    flex: 1,
    padding: 10,
    alignItems: "center",
    borderRadius: 10,
  },
  segmentActive: {
    backgroundColor: "rgba(55,130,245,0.95)",
  },
  segmentText: {
    color: colors.textSecondary,
    fontWeight: "600",
  },
  segmentTextActive: {
    color: "#fff",
  },
  typeContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  typeChipActive: {
    backgroundColor: "rgba(55,130,245,0.95)",
  },
  typeText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  typeTextActive: {
    color: "#fff",
    fontWeight: "600",
  },
  button: {
    marginTop: 20,
    backgroundColor: "rgba(55,130,245,0.95)",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
  },
});