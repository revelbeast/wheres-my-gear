import * as Linking from "expo-linking";
import { useLocalSearchParams } from "expo-router";
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

import { db } from "../lib/firebase";

type ScanState =
  | "autoCreate"
  | "confirmItem"
  | "editItem"
  | "linkStorage"
  | "linkChecklist";

export default function ScanResultScreen() {
  const { code, suggestedName, found, affiliateLink } = useLocalSearchParams();

  const isFound = found === "true";

  const amazonUrl = affiliateLink ? String(affiliateLink) : null;

  const [state, setState] = useState<ScanState>("confirmItem");
  const [loading, setLoading] = useState(false);

  const initialName =
    isFound && suggestedName
      ? (suggestedName as string)
      : "Unidentified Item";

  const [editableName, setEditableName] = useState<string>(initialName);

  const [selectedStorage, setSelectedStorage] = useState<string | null>(null);
  const [selectedCompartment, setSelectedCompartment] = useState<string | null>(null);
  const [selectedChecklist, setSelectedChecklist] = useState<string | null>(null);

  const [item, setItem] = useState<any>(null);

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

  const checklists = [
    { id: "travel", name: "Travel Checklist" },
    { id: "camping", name: "Camping Checklist" },
    { id: "daily", name: "Daily Gear" },
  ];

  const lookupItemByBarcode = async (barcode: string) => {
    const q = query(collection(db, "items"), where("barcode", "==", barcode));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const docSnap = snapshot.docs[0];
      return { id: docSnap.id, ...docSnap.data() };
    }

    return null;
  };

  const createDraftItem = async (barcode: string) => {
    const docRef = await addDoc(collection(db, "items"), {
      barcode,
      name: "Unidentified Item",
      status: "draft",
      createdAt: new Date().toISOString(),
    });

    return docRef.id;
  };

  const saveItemLocation = async () => {
    if (!item?.id || !selectedStorage || !selectedCompartment) return;

    const ref = doc(db, "items", item.id);

    await updateDoc(ref, {
      storageId: selectedStorage,
      compartmentId: selectedCompartment,
    });
  };

  const saveItemChecklist = async () => {
    if (!item?.id || !selectedChecklist) return;

    const ref = doc(db, "items", item.id);

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
  }, [code]);

  return (
    <View style={{ flex: 1, padding: 20, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ fontSize: 16, fontWeight: "600" }}>
        Scan Pipeline Active
      </Text>

      <Text style={{ marginTop: 20 }}>Code:</Text>
      <Text style={{ fontSize: 18 }}>{code}</Text>

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

            {storages.map((s) => (
              <Text
                key={s.id}
                onPress={() => setSelectedStorage(s.id)}
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
            ))}

            {/* COMPARTMENT */}
            <Text style={{ marginTop: 20, fontWeight: "600" }}>Compartment</Text>

            {compartments.map((c) => (
              <Text
                key={c.id}
                onPress={() => setSelectedCompartment(c.id)}
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
            ))}

            {/* CHECKLIST */}
            <Text style={{ marginTop: 20, fontWeight: "600" }}>Checklist</Text>

            {checklists.map((c) => (
              <Text
                key={c.id}
                onPress={() => setSelectedChecklist(c.id)}
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
            ))}

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

            {/* CONTINUE */}
            <Text
              onPress={async () => {
                await saveItemLocation();
                await saveItemChecklist();

                if (!item?.id) {
                  const docRef = await addDoc(collection(db, "items"), {
                    barcode: code,
                    name: editableName,
                    status: "active",
                    createdAt: new Date().toISOString(),
                  });

                  console.log("ITEM CREATED:", docRef.id);
                } else {
                  await updateDoc(doc(db, "items", item.id), {
                    name: editableName,
                    updatedAt: new Date().toISOString(),
                  });

                  console.log("ITEM UPDATED:", item.id);
                }

                setState("linkChecklist");
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
              Finish Setup
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}