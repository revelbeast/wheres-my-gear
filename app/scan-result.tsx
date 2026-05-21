import * as Linking from "expo-linking";
import { router, useLocalSearchParams } from "expo-router";
import {
  Barcode,
  ExternalLink,
  ScanSearch,
  Search,
} from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { Image, Text, TextInput, TouchableOpacity, View } from "react-native";

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
import { buildAmazonAffiliateLink } from "../lib/amazonAffiliate";
import { auth, db } from "../lib/firebase";
import {
  createItem,
  getCompartmentsByVehicle,
  getStorageSpaces,
  type Compartment,
  type StorageSpace
} from "../lib/gearService";
import { useResponsiveLayout } from "../lib/useResponsiveLayout";

type ScanState =
  | "autoCreate"
  | "confirmItem"
  | "editItem"
  | "linkStorage"
  | "linkChecklist";

export default function ScanResultScreen() {
  const nameInputRef = React.useRef<TextInput>(null);
  const { isTabletLandscape } = useResponsiveLayout();

  const {
    code,
    suggestedName,
    found,
    affiliateLink,
    source,
    brand,
    image,
    description,
    matchConfidence,
    matchStatus,
  } = useLocalSearchParams();

  const uid = auth.currentUser?.uid;

  const amazonUrl = affiliateLink ? String(affiliateLink) : null;
  const affiliateSearchUrl = buildAmazonAffiliateLink(
    suggestedName ? String(suggestedName) : String(code ?? "")
  );
  const catalogSource = source ? String(source) : "Catalog Lookup";
  const catalogBrand = brand ? String(brand) : "Brand unavailable";
  const catalogImage = image ? String(image) : null;
  const catalogDescription = description ? String(description) : null;
  const catalogConfidence =
    matchConfidence && !Number.isNaN(Number(matchConfidence))
      ? `${Math.round(Number(matchConfidence) * 100)}%`
      : "Pending";

  const isPossibleMatch =
    String(matchStatus ?? "").toLowerCase() === "possible";
  const firstCatalogSentence = catalogDescription
    ? catalogDescription
        .split(/(?<=[.!?])\s+/)
        .filter(Boolean)[0] ?? null
    : null;
  const catalogDescriptionPreview =
    firstCatalogSentence && firstCatalogSentence.length > 120
      ? `${firstCatalogSentence.slice(0, 117).trim()}...`
      : firstCatalogSentence;

  const [state, setState] = useState<ScanState>("confirmItem");
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const initialName =
    suggestedName && found === "true"
      ? String(suggestedName)
      : "Product Not Named";

  const [editableName, setEditableName] =
    useState<string>(initialName);

  const [selectedStorage, setSelectedStorage] = useState<string | null>(null);
  const [selectedCompartment, setSelectedCompartment] = useState<string | null>(null);
  const [selectedChecklist, setSelectedChecklist] = useState<string | null>(null);

  const [isStorageDropdownOpen, setIsStorageDropdownOpen] = useState(false);
  const [isCompartmentDropdownOpen, setIsCompartmentDropdownOpen] = useState(false);
  const [isChecklistDropdownOpen, setIsChecklistDropdownOpen] = useState(false);

  const [item, setItem] = useState<any>(null);
  const [storageSpaces, setStorageSpaces] = useState<StorageSpace[]>([]);
  const [compartmentSpaces, setCompartmentSpaces] = useState<Compartment[]>([]);
  const [checklists, setChecklists] = useState<any[]>([]);

  const isFoundScan =
    Array.isArray(found)
      ? found.some((value) => String(value).toLowerCase() === "true")
      : String(found).toLowerCase() === "true";
  const hasUsableName =
    Boolean(editableName?.trim()) &&
    editableName !== "Unidentified Item" &&
    editableName !== "Product Not Named";

  const scanState =
    !isFoundScan
      ? "NOT_FOUND"
      : !hasUsableName
        ? "NEEDS_NAMING"
        : "FOUND";

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
        const storedName =
          typeof result.name === "string" ? result.name.trim() : "";

        const resolvedName =
          isFoundScan && suggestedName
            ? String(suggestedName)
            : storedName.length > 0 && storedName !== "Unidentified Item"
              ? storedName
              : "Unidentified Item";

        setEditableName(resolvedName);
        setState("confirmItem");
      } else {
        const resolvedName =
          suggestedName && isFoundScan
            ? String(suggestedName)
            : "Unidentified Item";

        const id = await createDraftItem(code as string);

        setItem({
          id,
          barcode: code,
          name: resolvedName,
        });

        setEditableName(resolvedName);
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
    <View
      style={{
        flex: 1,
        padding: 20,
        flexDirection: isTabletLandscape ? "row" : "column",
        alignItems: "stretch",
        justifyContent: "flex-start",
        gap: isTabletLandscape ? 20 : 0,
      }}
    >
      <View
        style={{
          flex: isTabletLandscape ? 0.45 : undefined,
          width: isTabletLandscape ? undefined : "100%",
          alignItems: "center",
          justifyContent: "flex-start",
        }}
      >
        {isTabletLandscape ? (
          <Text
            style={{
              marginTop: 18,
              fontSize: 28,
              fontWeight: "800",
              color: "#1D4ED8",
              textAlign: "center",
            }}
          >
            Where&apos;s My Gear - Scan Result
          </Text>
        ) : null}

        <View style={{ marginTop: 24, width: "100%", alignItems: "center" }}>
          {loading ? (
            <Text>Checking inventory...</Text>
          ) : (
            <View style={{ width: "100%", alignItems: "center" }}>
              {scanState === "FOUND" ? (
                <View
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 999,
                    backgroundColor: "#DCFCE7",
                    borderWidth: 1,
                    borderColor: "#86EFAC",
                    marginBottom: 18,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "800",
                      color: isPossibleMatch ? "#B45309" : "#15803D",
                    }}
                  >
                    {isPossibleMatch ? "⚠ Possible Match" : "✓ Item Found"}
                  </Text>
                </View>
              ) : (
                <Text style={{ fontWeight: "700" }}>
                  Item Not Found
                </Text>
              )}

              {scanState === "NOT_FOUND" && (
                <View
                  style={{
                    marginTop: 14,
                    width: "100%",
                    padding: 14,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: "#FED7AA",
                    backgroundColor: "#FFF7ED",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "800",
                      color: "#C2410C",
                      textAlign: "center",
                    }}
                  >
                    ITEM NOT FOUND
                  </Text>

                  <Text
                    style={{
                      marginTop: 6,
                      fontSize: 12,
                      color: "#9A3412",
                      textAlign: "center",
                      lineHeight: 16,
                    }}
                  >
                    No matching inventory item was found. Review the scanned item details, then save it to storage or a checklist.
                  </Text>
                </View>
              )}

              {scanState === "NEEDS_NAMING" && (
                <Text style={{ marginTop: 6, opacity: 0.6, textAlign: "center" }}>
                  Please name this item manually.
                </Text>
              )}

              <Text style={{ marginTop: 12, fontWeight: "600" }}>
                {scanState === "FOUND" ? "Item Name" : "Unidentified Item Name"}
              </Text>

              <TextInput
                value={editableName}
                onChangeText={setEditableName}
                placeholder="Enter item name"
                ref={nameInputRef}
                editable
                returnKeyType="done"
                blurOnSubmit
                style={{
                  marginTop: 8,
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  minHeight: 56,
                  borderRadius: 12,
                  backgroundColor: "#222",
                  color: "#fff",
                  width: "100%",
                  textAlign: "center",
                  fontSize: 12,
                }}
              />

              {/* STORAGE */}
              <Text
                style={{
                  marginTop: 25,
                  marginBottom: 8,
                  alignSelf: "flex-start",
                  color: "#6B7280",
                  fontSize: 12,
                  fontWeight: "700",
                  textTransform: "uppercase",
                }}
              >
                Storage Spaces
              </Text>

              {storageSpaces.length === 0 ? (
                <Text style={{ marginTop: 6, opacity: 0.6, textAlign: "center" }}>
                  No storage spaces created yet.
                </Text>
              ) : (
                <View style={{ width: "100%", zIndex: 30, elevation: 30 }}>
                  <TouchableOpacity
                    onPress={() => {
                      setIsStorageDropdownOpen((current) => !current);
                    }}
                    style={{
                      minHeight: 48,
                      paddingHorizontal: 14,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: "#D1D5DB",
                      backgroundColor: "#FFFFFF",
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <Text
                      style={{
                        color: selectedStorage ? "#111827" : "#6B7280",
                        fontSize: 16,
                        fontWeight: "500",
                      }}
                    >
                      {storageSpaces.find((s) => s.id === selectedStorage)?.name ??
                        "Select a storage space first."}
                    </Text>

                    <Text style={{ color: "#6B7280", fontSize: 18 }}>⌄</Text>
                  </TouchableOpacity>

                  {isStorageDropdownOpen ? (
                    <View
                      style={{
                        marginTop: 6,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: "#E5E7EB",
                        backgroundColor: "#FFFFFF",
                        overflow: "hidden",
                      }}
                    >
                      {storageSpaces.map((s, index) => (
                        <TouchableOpacity
                          key={s.id}
                          onPress={() => {
                            setSelectedStorage((current) => (current === s.id ? null : s.id));
                            setSelectedCompartment(null);
                            setSelectedChecklist(null);
                            setIsStorageDropdownOpen(false);
                          }}
                          style={{
                            paddingHorizontal: 14,
                            paddingVertical: 12,
                            borderTopWidth: index === 0 ? 0 : 1,
                            borderTopColor: "#E5E7EB",
                            backgroundColor: selectedStorage === s.id ? "#F3F4F6" : "#FFFFFF",
                          }}
                        >
                          <Text
                            style={{
                              color: "#111827",
                              fontSize: 16,
                              fontWeight: selectedStorage === s.id ? "700" : "500",
                            }}
                          >
                            {s.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : null}
                </View>
              )}

              {/* COMPARTMENT */}
              <Text
                style={{
                  marginTop: 25,
                  marginBottom: 8,
                  alignSelf: "flex-start",
                  color: "#6B7280",
                  fontSize: 12,
                  fontWeight: "700",
                  textTransform: "uppercase",
                }}
              >
                Compartment
              </Text>

              <View style={{ width: "100%" }}>
                {!selectedStorage ? (
                  <Text
                    style={{
                      marginBottom: 8,
                      color: "#6B7280",
                      fontSize: 13,
                      lineHeight: 18,
                    }}
                  >
                    Select a Storage Space first to choose a Compartment.
                  </Text>
                ) : null}
                <TouchableOpacity
                  disabled={!selectedStorage}
                  onPress={() => {
                    if (!selectedStorage) return;
                    setIsCompartmentDropdownOpen((current) => !current);
                  }}
                  style={{
                    minHeight: 48,
                    paddingHorizontal: 14,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: "#D1D5DB",
                    backgroundColor: "#FFFFFF",
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    opacity: !selectedStorage ? 0.7 : 1,
                  }}
                >
                  <Text
                    numberOfLines={1}
                    style={{
                      flex: 1,
                      color: selectedCompartment ? "#111827" : "#6B7280",
                      fontSize: 16,
                      fontWeight: "500",
                    }}
                  >
                    {!selectedStorage
                      ? "Select a storage space first."
                      : compartmentSpaces.find(
                        (c) => c.id === selectedCompartment
                      )?.name ??
                      "Select a compartment first."}
                  </Text>

                  <Text style={{ marginLeft: 10, color: "#6B7280", fontSize: 18 }}>
                    ⌄
                  </Text>
                </TouchableOpacity>

                {selectedStorage && isCompartmentDropdownOpen ? (
                  <View
                    style={{
                      marginTop: 6,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: "#E5E7EB",
                      backgroundColor: "#FFFFFF",
                      overflow: "hidden",
                    }}
                  >
                    {compartmentSpaces.length === 0 ? (
                      <View
                        style={{
                          paddingHorizontal: 14,
                          paddingVertical: 12,
                        }}
                      >
                        <Text
                          style={{
                            color: "#6B7280",
                            fontSize: 15,
                            fontWeight: "500",
                          }}
                        >
                          No compartments created for this storage.
                        </Text>
                      </View>
                    ) : (
                      compartmentSpaces.map((c, index) => (
                        <TouchableOpacity
                          key={c.id}
                          onPress={() => {
                            setSelectedCompartment((current) =>
                              current === c.id ? null : c.id
                            );
                            setSelectedChecklist(null);
                            setIsCompartmentDropdownOpen(false);
                          }}
                          style={{
                            paddingHorizontal: 14,
                            paddingVertical: 12,
                            borderTopWidth: index === 0 ? 0 : 1,
                            borderTopColor: "#E5E7EB",
                            backgroundColor:
                              selectedCompartment === c.id
                                ? "#F3F4F6"
                                : "#FFFFFF",
                          }}
                        >
                          <Text
                            style={{
                              color: "#111827",
                              fontSize: 16,
                              fontWeight:
                                selectedCompartment === c.id
                                  ? "700"
                                  : "500",
                            }}
                          >
                            {c.name}
                          </Text>
                        </TouchableOpacity>
                      ))
                    )}
                  </View>
                ) : null}
              </View>

              {/* CHECKLIST */}
              <Text
                style={{
                  marginTop: 25,
                  marginBottom: 8,
                  alignSelf: "flex-start",
                  color: "#6B7280",
                  fontSize: 12,
                  fontWeight: "700",
                  textTransform: "uppercase",
                }}
              >
                Checklist
              </Text>

              <View style={{ width: "100%" }}>
                <TouchableOpacity
                  onPress={() =>
                    setIsChecklistDropdownOpen((current) => !current)
                  }
                  style={{
                    minHeight: 48,
                    paddingHorizontal: 14,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: "#D1D5DB",
                    backgroundColor: "#FFFFFF",
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Text
                    numberOfLines={1}
                    style={{
                      flex: 1,
                      color: selectedChecklist ? "#111827" : "#6B7280",
                      fontSize: 16,
                      fontWeight: "500",
                    }}
                  >
                    {checklists.find(
                      (c) => c.id === selectedChecklist
                    )?.name ?? "Select a checklist (optional)"}
                  </Text>

                  <Text
                    style={{
                      marginLeft: 10,
                      color: "#6B7280",
                      fontSize: isTabletLandscape ? 18 : 14,
                    }}
                  >
                    ⌄
                  </Text>
                </TouchableOpacity>

                {isChecklistDropdownOpen ? (
                  <View
                    style={{
                      marginTop: 6,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: "#E5E7EB",
                      backgroundColor: "#FFFFFF",
                      overflow: "hidden",
                    }}
                  >
                    {checklists.length === 0 ? (
                      <View
                        style={{
                          paddingHorizontal: 14,
                          paddingVertical: 12,
                        }}
                      >
                        <Text
                          style={{
                            color: "#6B7280",
                            fontSize: 15,
                          }}
                        >
                          No checklists created yet.
                        </Text>
                      </View>
                    ) : (
                      checklists.map((c, index) => (
                        <TouchableOpacity
                          key={c.id}
                          onPress={() => {
                            setSelectedChecklist((current) =>
                              current === c.id ? null : c.id
                            );
                            setSelectedStorage(null);
                            setSelectedCompartment(null);
                            setIsChecklistDropdownOpen(false);
                          }}
                          style={{
                            paddingHorizontal: 14,
                            paddingVertical: 12,
                            borderTopWidth: index === 0 ? 0 : 1,
                            borderTopColor: "#E5E7EB",
                            backgroundColor:
                              selectedChecklist === c.id
                                ? "#F3F4F6"
                                : "#FFFFFF",
                          }}
                        >
                          <Text
                            style={{
                              color: "#111827",
                              fontSize: 16,
                              fontWeight:
                                selectedChecklist === c.id
                                  ? "700"
                                  : "500",
                            }}
                          >
                            {c.name}
                          </Text>
                        </TouchableOpacity>
                      ))
                    )}
                  </View>
                ) : null}
              </View>

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
                    View Product
                  </Text>
                </View>
              ) : null}

              {/* CANCEL */}
              <Text
                onPress={router.back}
                style={{
                  marginTop: 24,
                  paddingVertical: 14,
                  backgroundColor: "#DC2626",
                  color: "#FFFFFF",
                  borderRadius: 12,
                  width: "100%",
                  textAlign: "center",
                  fontWeight: "700",
                  fontSize: 16,
                }}
              >
                Cancel
              </Text>

              {/* SAVE */}
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
                  marginTop: 28,
                  paddingVertical: 14,
                  backgroundColor: "#111",
                  color: "#fff",
                  borderRadius: 12,
                  width: "100%",
                  textAlign: "center",
                  fontWeight: "700",
                  fontSize: 16,
                }}
              >
                Save
              </Text>
            </View>
          )}
        </View>
      </View>

      <View
        style={{
          flex: isTabletLandscape ? 0.55 : undefined,
          width: isTabletLandscape ? undefined : "100%",
          marginTop: isTabletLandscape ? 0 : 20,
          borderRadius: 18,
          padding: 20,
            backgroundColor: "#FFFFFF",
            borderWidth: 1,
            borderColor: "#E5E7EB",
            shadowColor: "#000",
            shadowOpacity: 0.08,
            shadowRadius: 18,
            shadowOffset: { width: 0, height: 8 },
            justifyContent: "flex-start",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Text style={{ fontSize: 22, fontWeight: "800", color: "#111827" }}>
              Product Match Preview
            </Text>

          </View>

          <View
            style={{
              flexDirection: "row",
              gap: isTabletLandscape ? 20 : 18,
              marginTop: isTabletLandscape ? 20 : 10,
              padding: isTabletLandscape ? 16 : 12,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: "#E5E7EB",
              backgroundColor: "#FFFFFF",
            }}
          >
            <View
              style={{
                width: isTabletLandscape ? 200 : 104,
                height: isTabletLandscape ? 220 : 124,
                borderRadius: 18,
                backgroundColor: "#F8FAFC",
                borderWidth: 1,
                borderColor: "#E5E7EB",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                overflow: "hidden",
              }}
            >
              {catalogImage ? (
                <Image
                  source={{ uri: catalogImage }}
                  style={{
                    width: "100%",
                    height: "100%",
                  }}
                  resizeMode="contain"
                />
              ) : (
                <>
                  <Text style={{ color: "#9CA3AF", fontSize: 42 }}>□</Text>
                  <Text
                    style={{
                      marginTop: 10,
                      color: "#374151",
                      fontWeight: "700",
                      textAlign: "center",
                    }}
                  >
                    Product image{"\n"}coming soon
                  </Text>
                </>
              )}
            </View>

            <View style={{ flex: 1 }}>
              <Text
                numberOfLines={3}
                ellipsizeMode="tail"
                style={{
                  fontSize: isTabletLandscape ? 20 : 15,
                  fontWeight: "800",
                  color: "#111827",
                  marginTop: 0,
                }}
              >
                {editableName || "Product Title"}
              </Text>

              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={{ marginTop: 6, color: "#4B5563", fontWeight: "600" }}
              >
                {catalogBrand}
              </Text>

              <Text style={{ marginTop: isTabletLandscape ? 18 : 10, color: "#111827", fontWeight: "800" }}>
                Description:
              </Text>

              <Text
                style={{
                  marginTop: 6,
                  color: "#374151",
                  lineHeight: isTabletLandscape ? 22 : 18,
                  fontSize: isTabletLandscape ? 15 : 13,
                }}
              >
                {catalogDescriptionPreview || "Product description will appear here once we receive catalog data."}
              </Text>

              <Text style={{ marginTop: 8, color: "#111827", fontWeight: "700" }}>
                Confidence: <Text style={{ color: "#B45309" }}>{catalogConfidence}</Text>
              </Text>

              <TouchableOpacity
                onPress={() => {
                  Linking.openURL(affiliateSearchUrl);
                }}
                style={{
                  marginTop: isTabletLandscape ? 16 : 10,
                  padding: isTabletLandscape ? 16 : 12,
                  borderRadius: 14,
                  backgroundColor: "#FBBF24",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <ExternalLink size={20} color="#111827" />
                  <Text
                    style={{
                      color: "#111827",
                      fontWeight: "900",
                      fontSize: 18,
                    }}
                  >
                    Find product online
                  </Text>
                </View>
              </TouchableOpacity>

            </View>
          </View>

          <View
            style={{
              marginTop: 12,
              padding: 16,
              borderRadius: 16,
              backgroundColor: "#FFFFFF",
              borderWidth: 1,
              borderColor: "#E5E7EB",
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "800", color: "#111827" }}>
              About this Scan
            </Text>

            <View style={{ marginTop: 14, flexDirection: "row", alignItems: "center", gap: 22 }}>
              <Image
                source={require("../assets/images/app-icon.png")}
                style={{
                  width: 112,
                  height: 112,
                  borderRadius: 24,
                }}
              />

              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Barcode size={18} color="#6B7280" />
                  <View>
                <Text style={{ color: "#6B7280", fontSize: 12 }}>Barcode / UPC</Text>
                <Text style={{ marginTop: 2, color: "#111827", fontWeight: "700" }}>
                  {String(code ?? "Unknown")}
                </Text>
              </View>
            </View>

            <View style={{ marginTop: 12, flexDirection: "row", alignItems: "center", gap: 10 }}>
              <ScanSearch size={18} color="#6B7280" />
              <View>
                <Text style={{ color: "#6B7280", fontSize: 12 }}>Scanned with</Text>
                <Text style={{ marginTop: 2, color: "#111827", fontWeight: "700" }}>
                  Where&apos;s My Gear
                </Text>
              </View>
            </View>

                <View style={{ marginTop: 12, flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Search size={18} color="#6B7280" />
                  <View>
                    <Text style={{ color: "#6B7280", fontSize: 12 }}>Source</Text>
                    <Text style={{ marginTop: 2, color: "#111827", fontWeight: "700" }}>
                      {catalogSource}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </View>
    </View >
  );
}