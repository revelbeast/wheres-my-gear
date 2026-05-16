import * as Linking from "expo-linking";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import { Text, TextInput, View } from "react-native";

import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";

import {
  addChecklistItem,
  subscribeToChecklists,
} from "../lib/checklistsService";
import { auth, db } from "../lib/firebase";
import {
  createItem,
  getCompartmentsByVehicle,
  getStorageSpaces,
  type Compartment,
  type StorageSpace
} from "../lib/gearService";

type ScanState =
  | "autoCreate"
  | "confirmItem"
  | "editItem"
  | "linkStorage"
  | "linkChecklist";

export default function ScanResultScreen() {
  const { code, suggestedName, found, affiliateLink } = useLocalSearchParams();

  const isFound = found === "true";
  const uid = auth.currentUser?.uid;

  const amazonUrl = affiliateLink ? String(affiliateLink) : null;

  const [state, setState] = useState<ScanState>("confirmItem");
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const initialName =
    isFound && suggestedName
      ? (suggestedName as string)
      : "Unidentified Item";

  const [editableName, setEditableName] = useState<string>(initialName);

  const [selectedStorage, setSelectedStorage] = useState<string | null>(null);
  const [selectedCompartment, setSelectedCompartment] = useState<string | null>(null);
  const [selectedChecklist, setSelectedChecklist] = useState<string | null>(null);

  const [item, setItem] = useState<any>(null);
  const [storageSpaces, setStorageSpaces] = useState<StorageSpace[]>([]);
  const [compartmentSpaces, setCompartmentSpaces] = useState<Compartment[]>([]);
  const [checklists, setChecklists] = useState<any[]>([]);

  const storages = [
    { id: "garage", name: "Garage" },
    { id: "house", name: "House" },
    { id: "car", name: "Car" },
  ];

  const compartments = [
    { id: "top", name: "Top Shelf" },
    { id: "middle", name: "Middle Shelf" },
    { id: "bottom", name: "Bottom Shelf" },
  ];

  const lookupItemByBarcode = async (barcode: string): Promise<any | null> => {
    if (!uid) return null;

    const q = query(
      collection(db, "users", uid, "items"),
      where("barcode", "==", barcode)
    );
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const docSnap = snapshot.docs[0];
      return { id: docSnap.id, ...docSnap.data() };
    }

    return null;
  };

  const createDraftItem = async (barcode: string) => {
    if (!uid) {
      throw new Error("Cannot create draft item without signed-in user.");
    }

    const docRef = await addDoc(collection(db, "users", uid, "items"), {
      barcode,
      name: "Unidentified Item",
      status: "draft",
      createdAt: new Date().toISOString(),
    });

    return docRef.id;
  };

  const saveItemLocation = async () => {
    if (!item?.id || !selectedStorage || !selectedCompartment) return;

    if (!uid) return;

    const ref = doc(db, "users", uid, "items", item.id);

    await updateDoc(ref, {
      storageId: selectedStorage,
      compartmentId: selectedCompartment,
    });
  };

  const saveItemChecklist = async () => {
    if (!item?.id || !selectedChecklist) return;

    if (!uid) return;

    const ref = doc(db, "users", uid, "items", item.id);

    await updateDoc(ref, {
      checklistId: selectedChecklist,
    });
  };

  useEffect(() => {
    const run = async () => {
      if (!code) return;

      setLoading(true);

      const result = await lookupItemByBarcode(code as string);

      setItem(result);

      if (result) {
        const resolvedName =
          typeof result.name === "string" && result.name.trim().length > 0
            ? result.name
            : suggestedName
              ? String(suggestedName)
              : "Unidentified Item";

        setEditableName(resolvedName);
        setState("confirmItem");
      } else {
        const id = await createDraftItem(code as string);

        setItem({
          id,
          barcode: code,
          name: "Unidentified Item",
        });

        setState("confirmItem");
      }

      setLoading(false);
    };

    run();

    const loadStorageSpaces = async () => {
      try {
        const spaces = await getStorageSpaces();
        console.log("SCAN STORAGE SPACES LOADED:", spaces.length);
        setStorageSpaces(spaces);
      } catch (error) {
        console.log("SCAN STORAGE LOAD ERROR:", error);
      }
    };

    loadStorageSpaces();
  }, [code]);

  useEffect(() => {
    if (!uid) return;

    const unsubscribe = subscribeToChecklists(uid, (items) => {
      const activeChecklists = items.filter(
        (checklist) =>
          checklist.status === "active" &&
          !checklist.isArchived
      );

      setChecklists(activeChecklists);
    });

    return unsubscribe;
  }, [uid]);

  useEffect(() => {
    const loadCompartments = async () => {
      if (!selectedStorage) {
        setCompartmentSpaces([]);
        setSelectedCompartment(null);
        return;
      }

      try {
        const spaces = await getCompartmentsByVehicle(selectedStorage);
        console.log("SCAN COMPARTMENTS LOADED:", spaces.length);
        setCompartmentSpaces(spaces);
        setSelectedCompartment(null);
      } catch (error) {
        console.log("SCAN COMPARTMENT LOAD ERROR:", error);
        setCompartmentSpaces([]);
        setSelectedCompartment(null);
      }
    };

    loadCompartments();
  }, [selectedStorage]);

  return (
    <View style={{ flex: 1, padding: 20, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ fontSize: 22, fontWeight: "700" }}>
        Scan Result
      </Text>

      <Text
        onPress={() => router.back()}
        style={{
          marginTop: 10,
          color: "#9CA3AF",
          fontWeight: "600",
        }}
      >
      </Text>

      <View style={{ marginTop: 40, width: "100%", alignItems: "center" }}>
        {loading ? (
          <Text>Checking inventory...</Text>
        ) : (
          <View style={{ width: "100%", alignItems: "center" }}>
            <Text style={{ fontWeight: "600" }}>
              {isFound ? "Item Found" : "Item Not Found"}
            </Text>

            {!isFound && (
              <Text style={{ marginTop: 6, opacity: 0.6, textAlign: "center" }}>
                No match found. Please name this item manually.
              </Text>
            )}

            <Text style={{ marginTop: 12, fontWeight: "600" }}>
              {isFound ? "Item Name" : "Unidentified Item Name"}
            </Text>

            <TextInput
              value={editableName}
              onChangeText={setEditableName}
              placeholder="Enter item name"
              autoFocus
              editable
              returnKeyType="done"
              blurOnSubmit
              style={{
                marginTop: 8,
                padding: 10,
                borderRadius: 8,
                backgroundColor: "#222",
                color: "#fff",
                width: "100%",
                textAlign: "center",
              }}
            />

            {/* STORAGE */}
            <Text style={{ marginTop: 25, fontWeight: "600" }}>Storage</Text>

            {storageSpaces.length === 0 ? (
              <Text style={{ marginTop: 6, opacity: 0.6, textAlign: "center" }}>
                No storage spaces created yet.
              </Text>
            ) : (
              storageSpaces.map((s) => (
                <Text
                  key={s.id}
                  onPress={() => {
                    setSelectedStorage((current) => (current === s.id ? null : s.id));
                    setSelectedCompartment(null);
                    setSelectedChecklist(null);
                  }}
                  style={{
                    padding: 10,
                    marginTop: 6,
                    backgroundColor: selectedStorage === s.id ? "#2563EB" : "#222",
                    color: "#fff",
                    width: "100%",
                    textAlign: "center",
                    borderRadius: 8,
                  }}
                >
                  {s.name}
                </Text>
              ))
            )}

            {!selectedChecklist ? (
              <>
                {/* COMPARTMENT */}
                <Text style={{ marginTop: 20, fontWeight: "600" }}>Compartment</Text>

                {!selectedStorage ? (
                  <Text style={{ marginTop: 6, opacity: 0.6, textAlign: "center" }}>
                    Select a storage space first.
                  </Text>
                ) : compartmentSpaces.length === 0 ? (
                  <Text style={{ marginTop: 6, opacity: 0.6, textAlign: "center" }}>
                    No compartments created for this storage.
                  </Text>
                ) : (
                  compartmentSpaces.map((c) => (
                    <Text
                      key={c.id}
                      onPress={() => {
                        setSelectedCompartment((current) => (current === c.id ? null : c.id));
                        setSelectedChecklist(null);
                      }}
                      style={{
                        padding: 10,
                        marginTop: 6,
                        backgroundColor: selectedCompartment === c.id ? "#16A34A" : "#222",
                        color: "#fff",
                        width: "100%",
                        textAlign: "center",
                        borderRadius: 8,
                      }}
                    >
                      {c.name}
                    </Text>
                  ))
                )}
              </>
            ) : null}

            {/* CHECKLIST */}
            <Text style={{ marginTop: 20, fontWeight: "600" }}>Checklist</Text>

            {checklists.length === 0 ? (
              <Text style={{ marginTop: 6, opacity: 0.6, textAlign: "center" }}>
                No active checklists created yet.
              </Text>
            ) : (
              checklists.map((c) => (
                <Text
                  key={c.id}
                  onPress={() => {
                    setSelectedChecklist((current) => (current === c.id ? null : c.id));
                    setSelectedStorage(null);
                    setSelectedCompartment(null);
                  }}
                  style={{
                    padding: 10,
                    marginTop: 6,
                    backgroundColor: selectedChecklist === c.id ? "#7C3AED" : "#222",
                    color: "#fff",
                    width: "100%",
                    textAlign: "center",
                    borderRadius: 8,
                  }}
                >
                  {c.name}
                </Text>
              ))
            )}

            {selectedChecklist ? (
              <Text
                style={{
                  marginTop: 10,
                  opacity: 0.7,
                  textAlign: "center",
                }}
              >
                Checklist selected. This item will be saved to a checklist instead of a storage space.
              </Text>
            ) : null}

            {amazonUrl ? (
              <View
                style={{
                  marginTop: 20,
                  width: "100%",
                  padding: 12,
                  borderRadius: 10,
                  backgroundColor: "#111",
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "600" }}>
                  Suggested Product Match
                </Text>

                <Text style={{ color: "#aaa", fontSize: 12, marginTop: 4 }}>
                  Optional external link
                </Text>

                <Text
                  onPress={() => Linking.openURL(amazonUrl)}
                  style={{
                    marginTop: 10,
                    padding: 10,
                    backgroundColor: "#2563EB",
                    color: "#fff",
                    textAlign: "center",
                    borderRadius: 8,
                    fontWeight: "600",
                  }}
                >
                  View on Amazon
                </Text>
              </View>
            ) : null}

            <Text
              onPress={() => router.back()}
              style={{
                marginTop: 24,
                padding: 12,
                backgroundColor: "#374151",
                color: "#fff",
                borderRadius: 8,
                width: "100%",
                textAlign: "center",
                fontWeight: "600",
              }}
            >
              Cancel
            </Text>

            {/* CONTINUE */}
            <Text
              onPress={async () => {
                if (isSaving) return;

                try {
                  setIsSaving(true);

                  const hasStoragePath =
                    !!selectedStorage && !!selectedCompartment;
                  const hasChecklistPath = !!selectedChecklist;

                  if (!hasStoragePath && !hasChecklistPath) {
                    console.log(
                      "SAVE BLOCKED: Select storage + compartment or checklist."
                    );
                    return;
                  }

                  if (!uid) {
                    console.log("SAVE BLOCKED: Missing signed-in user.");
                    return;
                  }

                  if (hasChecklistPath) {
                    await addChecklistItem(
                      uid,
                      selectedChecklist,
                      editableName
                    );

                    console.log(
                      "CHECKLIST ITEM ADDED:",
                      selectedChecklist
                    );

                    router.back();
                    return;
                  }

                  const selectedStorageSpace =
                    storageSpaces.find(
                      (s) => s.id === selectedStorage
                    ) ?? null;

                  const selectedCompartmentSpace =
                    compartmentSpaces.find(
                      (c) => c.id === selectedCompartment
                    ) ?? null;

                  const payload = {
                    name: editableName,
                    status: "missing" as const,
                    source: "scan",
                    vehicleId: selectedStorage ?? "",
                    vehicleName: selectedStorageSpace?.name ?? "",
                    compartmentId: selectedCompartment ?? "",
                    compartmentName:
                      selectedCompartmentSpace?.name ?? "",
                  };

                  const createdId = await createItem(payload);

                  console.log(
                    "INVENTORY ITEM CREATED:",
                    createdId
                  );

                  router.back();
                } finally {
                  setIsSaving(false);
                }
              }}
              style={{
                marginTop: 30,
                padding: 12,
                backgroundColor: "#111",
                color: "#fff",
                borderRadius: 8,
                width: "100%",
                textAlign: "center",
              }}
            >
              Save Item
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}