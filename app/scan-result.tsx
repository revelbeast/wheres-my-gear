import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";

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
    const { code } = useLocalSearchParams();

    const [state, setState] = useState<ScanState>("autoCreate");
    const [loading, setLoading] = useState(true);

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

    // Firestore lookup
    const lookupItemByBarcode = async (barcode: string) => {
        const q = query(
            collection(db, "items"),
            where("barcode", "==", barcode)
        );

        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            const docSnap = snapshot.docs[0];

            return {
                id: docSnap.id,
                ...docSnap.data(),
            };
        }

        return null;
    };

    // Create draft item
    const createDraftItem = async (barcode: string) => {
        const docRef = await addDoc(collection(db, "items"), {
            barcode,
            name: "Unnamed Item",
            status: "draft",
            createdAt: new Date().toISOString(),
        });

        return docRef.id;
    };

    // Save storage + compartment
    const saveItemLocation = async () => {
        if (!item?.id || !selectedStorage || !selectedCompartment) return;

        const ref = doc(db, "items", item.id);

        await updateDoc(ref, {
            storageId: selectedStorage,
            compartmentId: selectedCompartment,
        });
    };

    // Save checklist
    const saveItemChecklist = async () => {
        if (!item?.id || !selectedChecklist) return;

        const ref = doc(db, "items", item.id);

        await updateDoc(ref, {
            checklistId: selectedChecklist,
        });
    };

    // Scan engine
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
                    name: "Unnamed Item",
                });

                setState("confirmItem");
            }

            setLoading(false);
        };

        run();
    }, [code]);

    return (
        <View
            style={{
                flex: 1,
                justifyContent: "center",
                alignItems: "center",
                padding: 20,
            }}
        >
            <Text style={{ fontSize: 16, fontWeight: "600" }}>
                Scan Pipeline Active
            </Text>

            <Text style={{ marginTop: 20 }}>Code:</Text>
            <Text style={{ fontSize: 18, fontWeight: "500" }}>
                {code}
            </Text>

            <View style={{ marginTop: 40, width: "100%", alignItems: "center" }}>
                {loading ? (
                    <Text>Checking inventory...</Text>
                ) : state === "confirmItem" ? (
                    <View style={{ width: "100%", alignItems: "center" }}>
                        <Text style={{ fontWeight: "600" }}>
                            Confirm Item
                        </Text>

                        <Text style={{ marginTop: 10 }}>
                            {item?.name}
                        </Text>

                        {/* STORAGE */}
                        <Text style={{ marginTop: 25, fontWeight: "600" }}>
                            Storage
                        </Text>

                        {storages.map((s) => (
                            <Text
                                key={s.id}
                                onPress={() => setSelectedStorage(s.id)}
                                style={{
                                    padding: 10,
                                    marginTop: 6,
                                    backgroundColor:
                                        selectedStorage === s.id
                                            ? "#2563EB"
                                            : "#222",
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
                        <Text style={{ marginTop: 20, fontWeight: "600" }}>
                            Compartment
                        </Text>

                        {compartments.map((c) => (
                            <Text
                                key={c.id}
                                onPress={() => setSelectedCompartment(c.id)}
                                style={{
                                    padding: 10,
                                    marginTop: 6,
                                    backgroundColor:
                                        selectedCompartment === c.id
                                            ? "#16A34A"
                                            : "#222",
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
                        <Text style={{ marginTop: 20, fontWeight: "600" }}>
                            Checklist
                        </Text>

                        {checklists.map((c) => (
                            <Text
                                key={c.id}
                                onPress={() => setSelectedChecklist(c.id)}
                                style={{
                                    padding: 10,
                                    marginTop: 6,
                                    backgroundColor:
                                        selectedChecklist === c.id
                                            ? "#7C3AED"
                                            : "#222",
                                    color: "#fff",
                                    width: "100%",
                                    textAlign: "center",
                                    borderRadius: 8,
                                }}
                            >
                                {c.name}
                            </Text>
                        ))}

                        {/* CONTINUE */}
                        <Text
                            onPress={async () => {
                                await saveItemLocation();
                                await saveItemChecklist();

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
                ) : (
                    <Text>{state}</Text>
                )}
            </View>
        </View>
    );
}