import React, { useEffect, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  Pressable,
  View,
  TextInput,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronRight, Plus, X, Trash2, Pencil, Check } from "lucide-react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Swipeable } from "react-native-gesture-handler";

import ScreenBackground from "../../components/ui/ScreenBackground";
import AppHeader from "../../components/ui/AppHeader";
import { colors } from "../../theme/tokens";
import {
  Compartment,
  createCompartment,
  deleteCompartment,
  getCompartments,
  updateCompartment,
} from "../../lib/gearService";

export default function VehicleDetailScreen() {
  const params = useLocalSearchParams<{ vehicleId: string | string[] }>();
  const vehicleId = Array.isArray(params.vehicleId)
    ? params.vehicleId[0]
    : params.vehicleId;

  const [compartments, setCompartments] = useState<Compartment[]>([]);
  const [showCreateBox, setShowCreateBox] = useState(false);
  const [newCompartmentName, setNewCompartmentName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const [editingCompartmentId, setEditingCompartmentId] = useState<string | null>(null);
  const [editingCompartmentName, setEditingCompartmentName] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    if (!vehicleId) return;
    loadCompartments();
  }, [vehicleId]);

  async function loadCompartments() {
    try {
      const data = await getCompartments(String(vehicleId));
      setCompartments(data);
    } catch (err) {
      console.error("Failed to load compartments:", err);
      setCompartments([]);
    }
  }

  async function handleCreateCompartment() {
    if (!vehicleId) return;

    const trimmed = newCompartmentName.trim();
    if (!trimmed) return;

    try {
      setIsCreating(true);
      await createCompartment(trimmed, String(vehicleId));
      setNewCompartmentName("");
      setShowCreateBox(false);
      await loadCompartments();
    } catch (err) {
      console.error("Failed to create compartment:", err);
    } finally {
      setIsCreating(false);
    }
  }

  function startEditing(compartment: Compartment) {
    setEditingCompartmentId(compartment.id);
    setEditingCompartmentName(compartment.name);
  }

  function cancelEditing() {
    setEditingCompartmentId(null);
    setEditingCompartmentName("");
  }

  async function saveEditing(compartmentId: string) {
    const trimmed = editingCompartmentName.trim();
    if (!trimmed) return;

    try {
      setSavingEdit(true);
      await updateCompartment(compartmentId, { name: trimmed });
      setEditingCompartmentId(null);
      setEditingCompartmentName("");
      await loadCompartments();
    } catch (err) {
      console.error("Failed to update compartment:", err);
    } finally {
      setSavingEdit(false);
    }
  }

  function confirmDelete(compartment: Compartment) {
    Alert.alert(
      "Delete compartment?",
      `Delete "${compartment.name}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => handleDelete(compartment),
        },
      ]
    );
  }

  async function handleDelete(compartment: Compartment) {
    try {
      await deleteCompartment(compartment.id);
      await loadCompartments();
    } catch (err) {
      console.error("Failed to delete compartment:", err);
    }
  }

  function renderRightActions(compartment: Compartment) {
    return (
      <Pressable
        style={styles.swipeDeleteAction}
        onPress={() => confirmDelete(compartment)}
      >
        <Trash2 size={18} color="#fff" />
        <Text style={styles.swipeDeleteText}>Delete</Text>
      </Pressable>
    );
  }

  function handleOpenCompartment(compartmentId: string) {
    if (!vehicleId || !compartmentId) return;

    router.push(
      `/vehicles/${encodeURIComponent(String(vehicleId))}/compartments/${encodeURIComponent(
        String(compartmentId)
      )}`
    );
  }

  const headerRight = (
    <Pressable
      style={styles.headerActionButton}
      onPress={() => setShowCreateBox((prev) => !prev)}
    >
      {showCreateBox ? (
        <X size={18} color={colors.text} />
      ) : (
        <Plus size={18} color={colors.text} />
      )}
    </Pressable>
  );

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <AppHeader
            title="Compartments"
            showBackButton
            rightContent={headerRight}
          />

          {showCreateBox && (
            <View style={styles.createCard}>
              <Text style={styles.createTitle}>Create Compartment</Text>

              <View style={styles.createRow}>
                <TextInput
                  value={newCompartmentName}
                  onChangeText={setNewCompartmentName}
                  placeholder="Enter compartment name"
                  placeholderTextColor={colors.textMuted}
                  style={styles.createInput}
                  returnKeyType="done"
                  onSubmitEditing={handleCreateCompartment}
                />

                <Pressable
                  style={[
                    styles.createButton,
                    (!newCompartmentName.trim() || isCreating) &&
                      styles.createButtonDisabled,
                  ]}
                  onPress={handleCreateCompartment}
                  disabled={!newCompartmentName.trim() || isCreating}
                >
                  <Plus size={18} color="#fff" />
                </Pressable>
              </View>
            </View>
          )}

          {compartments.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No compartments found</Text>
              <Text style={styles.emptyText}>
                Create your first compartment using the plus button above.
              </Text>
            </View>
          ) : (
            compartments.map((compartment) => {
              const isEditing = editingCompartmentId === compartment.id;

              return (
                <Swipeable
                  key={compartment.id}
                  renderRightActions={() => renderRightActions(compartment)}
                  overshootRight={false}
                  enabled={!isEditing}
                >
                  <View style={styles.card}>
                    {isEditing ? (
                      <View style={styles.editWrap}>
                        <TextInput
                          value={editingCompartmentName}
                          onChangeText={setEditingCompartmentName}
                          placeholder="Compartment name"
                          placeholderTextColor={colors.textMuted}
                          style={styles.editInput}
                          autoFocus
                          returnKeyType="done"
                          onSubmitEditing={() => saveEditing(compartment.id)}
                        />
                        <View style={styles.editActions}>
                          <Pressable
                            style={[
                              styles.saveEditButton,
                              (!editingCompartmentName.trim() || savingEdit) &&
                                styles.createButtonDisabled,
                            ]}
                            onPress={() => saveEditing(compartment.id)}
                            disabled={!editingCompartmentName.trim() || savingEdit}
                          >
                            <Check size={16} color="#fff" />
                            <Text style={styles.saveEditText}>Save</Text>
                          </Pressable>

                          <Pressable
                            style={styles.cancelEditButton}
                            onPress={cancelEditing}
                          >
                            <X size={16} color={colors.text} />
                            <Text style={styles.cancelEditText}>Cancel</Text>
                          </Pressable>
                        </View>
                      </View>
                    ) : (
                      <>
                        <Pressable
                          style={styles.cardLeft}
                          onPress={() => handleOpenCompartment(compartment.id)}
                        >
                          <Text style={styles.cardTitle}>{compartment.name}</Text>
                        </Pressable>

                        <View style={styles.cardRight}>
                          <Pressable
                            style={styles.iconButton}
                            onPress={() => startEditing(compartment)}
                          >
                            <Pencil size={16} color={colors.textSecondary} />
                          </Pressable>

                          <Pressable
                            style={styles.iconButton}
                            onPress={() => handleOpenCompartment(compartment.id)}
                          >
                            <ChevronRight size={18} color={colors.textSecondary} />
                          </Pressable>
                        </View>
                      </>
                    )}
                  </View>
                </Swipeable>
              );
            })
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
    paddingBottom: 140,
  },
  headerActionButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(12,24,50,0.9)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  createCard: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 18,
    backgroundColor: "rgba(12,24,50,0.9)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  createTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 10,
  },
  createRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  createInput: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(7, 20, 44, 0.7)",
  },
  createButton: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(55, 130, 245, 0.95)",
  },
  createButtonDisabled: {
    opacity: 0.5,
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
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 6,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  card: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 10,
    backgroundColor: "rgba(12,24,50,0.9)",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardLeft: {
    flex: 1,
    paddingRight: 10,
  },
  cardRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardTitle: {
    color: colors.text,
    fontWeight: "600",
    fontSize: 16,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  editWrap: {
    flex: 1,
  },
  editInput: {
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(7, 20, 44, 0.7)",
    marginBottom: 10,
  },
  editActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  saveEditButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "rgba(55, 130, 245, 0.95)",
  },
  saveEditText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  cancelEditButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  cancelEditText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
  },
  swipeDeleteAction: {
    width: 110,
    marginBottom: 10,
    borderRadius: 16,
    backgroundColor: "rgba(180, 40, 40, 0.95)",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  swipeDeleteText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
});