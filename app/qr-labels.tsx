import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../components/auth/AuthProvider";
import HapticPressable from "../components/ui/HapticPressable";
import ScreenBackground from "../components/ui/ScreenBackground";
import { useThemedValues } from "../components/ui/Themed";
import {
  Compartment,
  Item,
  Room,
  StorageSpace,
  getAllCompartments,
  getItemsByCompartment,
  getRoomsByStorageSpace,
  getStorageSpaces,
} from "../lib/gearService";
import { isPremiumPlusUser } from "../lib/revenuecat";

export default function QrLabelsScreen() {
  const theme = useThemedValues();
  const params = useLocalSearchParams<{
    type?: string | string[];
    storageId?: string | string[];
    roomId?: string | string[];
    compartmentId?: string | string[];
  }>();
  const { user } = useAuth();
  const qrCodeRef = useRef<any>(null);
  const bulkQrCodeRefs = useRef<Record<string, any>>({});

  const [storageSpaces, setStorageSpaces] = useState<StorageSpace[]>([]);
  const [compartments, setCompartments] = useState<Compartment[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [labelType, setLabelType] = useState<"compartment" | "room">("compartment");
  const [selectedStorageId, setSelectedStorageId] = useState("");
  const [selectedCompartmentId, setSelectedCompartmentId] = useState("");
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [selectedBulkCompartmentIds, setSelectedBulkCompartmentIds] = useState<string[]>([]);
  const [selectedBulkRoomIds, setSelectedBulkRoomIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [routeParamsApplied, setRouteParamsApplied] = useState(false);
  const [checkingPremiumPlus, setCheckingPremiumPlus] = useState(true);
  const [hasPremiumPlus, setHasPremiumPlus] = useState(false);

  const requestedLabelType = useMemo(() => {
    const value = Array.isArray(params.type) ? params.type[0] : params.type;
    return value === "room" ? "room" : value === "compartment" ? "compartment" : "";
  }, [params.type]);

  const requestedStorageId = useMemo(() => {
    const value = Array.isArray(params.storageId) ? params.storageId[0] : params.storageId;
    return value ?? "";
  }, [params.storageId]);

  const requestedRoomId = useMemo(() => {
    const value = Array.isArray(params.roomId) ? params.roomId[0] : params.roomId;
    return value ?? "";
  }, [params.roomId]);

  const requestedCompartmentId = useMemo(() => {
    const value = Array.isArray(params.compartmentId)
      ? params.compartmentId[0]
      : params.compartmentId;
    return value ?? "";
  }, [params.compartmentId]);

  const selectedStorage = useMemo(
    () => storageSpaces.find((space) => space.id === selectedStorageId) ?? null,
    [selectedStorageId, storageSpaces]
  );

  const visibleCompartments = useMemo(
    () =>
      compartments.filter(
        (compartment) => compartment.vehicleId === selectedStorageId
      ),
    [compartments, selectedStorageId]
  );

  const visibleRooms = useMemo(
    () => rooms.filter((room) => room.storageSpaceId === selectedStorageId),
    [rooms, selectedStorageId]
  );

  const selectedCompartment = useMemo(
    () =>
      compartments.find(
        (compartment) => compartment.id === selectedCompartmentId
      ) ?? null,
    [compartments, selectedCompartmentId]
  );

  const selectedRoom = useMemo(
    () => rooms.find((room) => room.id === selectedRoomId) ?? null,
    [rooms, selectedRoomId]
  );

  const qrValue = useMemo(() => {
    if (labelType === "room") {
      if (!selectedRoom?.id) return "";
      return `wheresmygear://room/${selectedStorage?.id ?? ""}/${selectedRoom.id}`;
    }

    if (!selectedCompartment?.id) return "";
    return `wheresmygear://compartment/${selectedStorage?.id ?? selectedCompartment.vehicleId ?? ""}/${selectedCompartment.id}`;
  }, [labelType, selectedCompartment?.id, selectedRoom?.id]);

  useEffect(() => {
    let active = true;

    async function checkPremiumPlus() {
      try {
        const allowed = await isPremiumPlusUser();
        if (!active) return;

        setHasPremiumPlus(allowed);

        if (!allowed) {
          Alert.alert(
            "Unlock Premium+",
            "Create QR Labels is a Premium+ feature for printing compartment labels and opening stored contents faster.",
            [
              {
                text: "Not Now",
                style: "cancel",
                onPress: () => router.back(),
              },
              {
                text: "Upgrade to Premium+",
                onPress: () => {
                  router.replace({
                    pathname: "/paywall",
                    params: { plan: "premium_plus" },
                  });
                },
              },
            ]
          );
        }
      } catch (err) {
        console.error("Failed to check Premium+ access:", err);
        if (active) setHasPremiumPlus(false);
      } finally {
        if (active) setCheckingPremiumPlus(false);
      }
    }

    void checkPremiumPlus();

    return () => {
      active = false;
    };
  }, [user?.uid]);

  useEffect(() => {
    let active = true;

    async function loadData() {
      if (checkingPremiumPlus || !hasPremiumPlus) return;

      try {
        const [spacesData, compartmentsData] = await Promise.all([
          getStorageSpaces(),
          getAllCompartments(),
        ]);

        if (!active) return;

        setStorageSpaces(spacesData);
        setCompartments(compartmentsData);

        if (spacesData.length > 0) {
          setSelectedStorageId(spacesData[0].id);
        }
      } catch (err) {
        console.error("Failed to load QR label data:", err);
        Alert.alert(
          "Create QR Labels unavailable",
          "Something went wrong while loading your storage spaces and compartments."
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadData();

    return () => {
      active = false;
    };
  }, [checkingPremiumPlus, hasPremiumPlus]);

  useEffect(() => {
    let active = true;

    async function loadRooms() {
      if (!selectedStorageId) {
        setRooms([]);
        setSelectedRoomId("");
        return;
      }

      try {
        const data = await getRoomsByStorageSpace(selectedStorageId);
        if (!active) return;

        setRooms(data);
        setSelectedRoomId(data[0]?.id ?? "");
        setSelectedBulkRoomIds([]);
      } catch (err) {
        console.error("Failed to load rooms for QR labels:", err);
        if (active) {
          setRooms([]);
          setSelectedRoomId("");
        }
      }
    }

    void loadRooms();

    return () => {
      active = false;
    };
  }, [selectedStorageId]);

  useEffect(() => {
    if (routeParamsApplied) return;
    if (loading) return;

    if (requestedLabelType) {
      setLabelType(requestedLabelType);
    }

    if (requestedStorageId) {
      setSelectedStorageId(requestedStorageId);
    }

    if (requestedCompartmentId) {
      setSelectedCompartmentId(requestedCompartmentId);
    }

    if (requestedRoomId) {
      setSelectedRoomId(requestedRoomId);
    }

    setRouteParamsApplied(true);
  }, [
    loading,
    requestedCompartmentId,
    requestedLabelType,
    requestedRoomId,
    requestedStorageId,
    routeParamsApplied,
  ]);

  useEffect(() => {
    const firstCompartment = compartments.find(
      (compartment) => compartment.vehicleId === selectedStorageId
    );

    setSelectedCompartmentId(firstCompartment?.id ?? "");
    setSelectedBulkCompartmentIds([]);
  }, [compartments, selectedStorageId]);

  useEffect(() => {
    let active = true;

    async function loadItems() {
      if (!selectedCompartmentId) {
        setItems([]);
        return;
      }

      try {
        const data = await getItemsByCompartment(selectedCompartmentId);
        if (active) setItems(data);
      } catch (err) {
        console.error("Failed to load QR label items:", err);
        if (active) setItems([]);
      }
    }

    void loadItems();

    return () => {
      active = false;
    };
  }, [selectedCompartmentId]);

  function handleChooseStorageSpace() {
    if (storageSpaces.length === 0) return;

    Alert.alert(
      "Choose Storage Space",
      "Select where the QR label compartment is stored.",
      [
        ...storageSpaces.map((space) => ({
          text: space.name || "Storage Space",
          onPress: () => setSelectedStorageId(space.id),
        })),
        {
          text: "Cancel",
          style: "cancel" as const,
        },
      ]
    );
  }

  function handleChooseCompartment() {
    if (visibleCompartments.length === 0) {
      Alert.alert(
        "No compartments",
        "This storage space does not have any compartments yet."
      );
      return;
    }

    Alert.alert(
      "Choose Compartment",
      "Select the compartment label you want to print.",
      [
        ...visibleCompartments.map((compartment) => ({
          text: compartment.roomName
            ? `${compartment.name} • ${compartment.roomName}`
            : compartment.name || "Compartment",
          onPress: () => setSelectedCompartmentId(compartment.id),
        })),
        {
          text: "Cancel",
          style: "cancel" as const,
        },
      ]
    );
  }

  function handleChooseRoom() {
    if (visibleRooms.length === 0) {
      Alert.alert(
        "No rooms",
        "This storage space does not have any rooms yet."
      );
      return;
    }

    Alert.alert(
      "Choose Room",
      "Select the room label you want to print.",
      [
        ...visibleRooms.map((room) => ({
          text: room.name || "Room",
          onPress: () => setSelectedRoomId(room.id),
        })),
        {
          text: "Cancel",
          style: "cancel" as const,
        },
      ]
    );
  }

  function buildQrLabelHtml(qrImageData: string) {
    const storageName = selectedStorage?.name?.trim() || "Storage Space";
    const isRoomLabel = labelType === "room";
    const compartmentName = isRoomLabel
      ? selectedRoom?.name?.trim() || "Room"
      : selectedCompartment?.name?.trim() || "Compartment";
    const roomName = isRoomLabel
      ? selectedRoom?.name?.trim()
      : selectedCompartment?.roomName?.trim();

    return `
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
              margin: 0;
              padding: 0;
              color: #111827;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
            }
            .label {
              border: 2px solid #111827;
              border-radius: 18px;
              padding: 12px;
              width: 320px;
              text-align: center;
            }
            .app {
              font-size: 14px;
              font-weight: 700;
              letter-spacing: 0.08em;
              text-transform: uppercase;
              color: #2563eb;
              margin-bottom: 10px;
            }
            .title {
              font-size: 20px;
              font-weight: 800;
              margin-bottom: 16px;
            }
            .qr {
              width: 160px;
              height: 160px;
              margin: 10px auto 10px auto;
            }
            .meta {
              font-size: 15px;
              line-height: 1.45;
              text-align: left;
              margin-top: 8px;
              border-top: 1px solid #d1d5db;
              padding-top: 8px;
            }
            .hint {
              font-size: 12px;
              color: #4b5563;
              margin-top: 8px;
            }
          </style>
        </head>
        <body>
          <div class="label">
            <div class="app">Where's My Gear</div>
            <div class="title">${compartmentName}</div>
            <div class="meta">
              <div><strong>Storage:</strong> ${storageName}</div>
              ${roomName ? `<div><strong>Room:</strong> ${roomName}</div>` : ""}
              ${isRoomLabel ? "" : `<div><strong>Compartment:</strong> ${compartmentName}</div>`}
              ${isRoomLabel ? `<div><strong>Room:</strong> ${compartmentName}</div>` : ""}
              <div><strong>${isRoomLabel ? "Compartments" : "Items"}:</strong> ${isRoomLabel ? visibleCompartments.filter((compartment) => compartment.roomId === selectedRoom?.id).length : items.length}</div>
            </div>
            <img class="qr" src="data:image/png;base64,${qrImageData}" />
            <div class="hint">Scan this label in Where's My Gear to view the contents.</div>
          </div>
        </body>
      </html>
    `;
  }

  async function getQrImageData(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!qrCodeRef.current?.toDataURL) {
        reject(new Error("QR code is not ready yet."));
        return;
      }

      qrCodeRef.current.toDataURL((data: string) => {
        if (data) {
          resolve(data);
        } else {
          reject(new Error("Unable to generate QR code image."));
        }
      });
    });
  }

  async function getBulkQrImageData(compartmentId: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const qrRef = bulkQrCodeRefs.current[compartmentId];

      if (!qrRef?.toDataURL) {
        reject(new Error("QR code is not ready yet."));
        return;
      }

      qrRef.toDataURL((data: string) => {
        if (data) {
          resolve(data);
        } else {
          reject(new Error("Unable to generate QR code image."));
        }
      });
    });
  }

  async function handlePrintLabel() {
    if (!qrValue || working) return;

    try {
      setWorking(true);
      const qrImageData = await getQrImageData();

      await Print.printAsync({
        html: buildQrLabelHtml(qrImageData),
      });
    } catch (err: any) {
      const message = String(err?.message ?? err ?? "");

      if (message.toLowerCase().includes("printing did not complete")) {
        return;
      }

      console.error("Failed to print QR label:", err);
      Alert.alert(
        "QR label not printed",
        "Something went wrong while creating the printable QR label."
      );
    } finally {
      setWorking(false);
    }
  }

  function buildSingleLabelHtml({
    storageName,
    compartmentName,
    roomName,
    itemCount,
    qrImageData,
  }: {
    storageName: string;
    compartmentName: string;
    roomName?: string;
    itemCount: number;
    qrImageData: string;
  }) {
    return `
      <div class="label">
        <div class="app">Where's My Gear</div>
        <div class="title">${compartmentName}</div>
        <div class="meta">
          <div><strong>Storage:</strong> ${storageName}</div>
          ${roomName ? `<div><strong>Room:</strong> ${roomName}</div>` : ""}
          <div><strong>Compartment:</strong> ${compartmentName}</div>
          <div><strong>Items:</strong> ${itemCount}</div>
        </div>
        <img class="qr" src="data:image/png;base64,${qrImageData}" />
        <div class="hint">Scan this label in Where's My Gear to view the contents.</div>
      </div>
    `;
  }

  function buildBulkQrLabelsHtml(labels: string[]) {
    return `
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
              margin: 0;
              padding: 16px;
              color: #111827;
            }
            .sheet {
              display: flex;
              flex-wrap: wrap;
              gap: 14px;
              justify-content: center;
            }
            .label {
              border: 2px solid #111827;
              border-radius: 18px;
              box-sizing: border-box;
              page-break-inside: avoid;
              padding: 12px;
              text-align: center;
              width: 320px;
            }
            .app {
              font-size: 14px;
              font-weight: 700;
              letter-spacing: 0.08em;
              text-transform: uppercase;
              color: #2563eb;
              margin-bottom: 10px;
            }
            .title {
              font-size: 20px;
              font-weight: 800;
              margin-bottom: 12px;
            }
            .qr {
              width: 160px;
              height: 160px;
              margin: 10px auto 10px auto;
            }
            .meta {
              font-size: 15px;
              line-height: 1.45;
              text-align: left;
              margin-top: 8px;
              border-top: 1px solid #d1d5db;
              padding-top: 8px;
            }
            .hint {
              font-size: 12px;
              color: #4b5563;
              margin-top: 8px;
            }
          </style>
        </head>
        <body>
          <div class="sheet">
            ${labels.join("\n")}
          </div>
        </body>
      </html>
    `;
  }

  function toggleBulkCompartmentSelection(compartmentId: string) {
    setSelectedBulkCompartmentIds((current) =>
      current.includes(compartmentId)
        ? current.filter((id) => id !== compartmentId)
        : [...current, compartmentId]
    );
  }

  function handleSelectAllBulkLabels() {
    setSelectedBulkCompartmentIds(visibleCompartments.map((compartment) => compartment.id));
  }

  function handleClearBulkLabels() {
    setSelectedBulkCompartmentIds([]);
  }

  async function printLabelsForCompartments(
    compartmentsToPrint: Compartment[],
    emptyMessage: string
  ) {
    if (!selectedStorage || compartmentsToPrint.length === 0 || working) {
      Alert.alert("No labels selected", emptyMessage);
      return;
    }

    try {
      setWorking(true);

      const labelHtmlBlocks = await Promise.all(
        compartmentsToPrint.map(async (compartment) => {
          const compartmentItems = await getItemsByCompartment(compartment.id);
          const qrImageData = await getBulkQrImageData(compartment.id);

          return buildSingleLabelHtml({
            storageName: selectedStorage.name,
            compartmentName: compartment.name || "Compartment",
            roomName: compartment.roomName,
            itemCount: compartmentItems.length,
            qrImageData,
          });
        })
      );

      await Print.printAsync({
        html: buildBulkQrLabelsHtml(labelHtmlBlocks),
      });
    } catch (err: any) {
      const message = String(err?.message ?? err ?? "");

      if (message.toLowerCase().includes("printing did not complete")) {
        return;
      }

      console.error("Failed to print QR labels:", err);
      Alert.alert(
        "Labels not printed",
        "Something went wrong while creating the selected QR labels PDF."
      );
    } finally {
      setWorking(false);
    }
  }

  function toggleBulkRoomSelection(roomId: string) {
    setSelectedBulkRoomIds((current) =>
      current.includes(roomId)
        ? current.filter((id) => id !== roomId)
        : [...current, roomId]
    );
  }

  function handleSelectAllBulkRooms() {
    setSelectedBulkRoomIds(visibleRooms.map((room) => room.id));
  }

  function handleClearBulkRooms() {
    setSelectedBulkRoomIds([]);
  }

  async function printLabelsForRooms(roomsToPrint: Room[], emptyMessage: string) {
    if (!selectedStorage || roomsToPrint.length === 0 || working) {
      Alert.alert("No room labels selected", emptyMessage);
      return;
    }

    try {
      setWorking(true);

      const labelHtmlBlocks = await Promise.all(
        roomsToPrint.map(async (room) => {
          const qrImageData = await getBulkQrImageData(`room-${room.id}`);
          const roomCompartmentCount = visibleCompartments.filter(
            (compartment) => compartment.roomId === room.id
          ).length;

          return buildSingleLabelHtml({
            storageName: selectedStorage.name,
            compartmentName: room.name || "Room",
            roomName: room.name || "Room",
            itemCount: roomCompartmentCount,
            qrImageData,
          });
        })
      );

      await Print.printAsync({
        html: buildBulkQrLabelsHtml(labelHtmlBlocks),
      });
    } catch (err: any) {
      const message = String(err?.message ?? err ?? "");

      if (message.toLowerCase().includes("printing did not complete")) {
        return;
      }

      console.error("Failed to print room QR labels:", err);
      Alert.alert(
        "Room labels not printed",
        "Something went wrong while creating the selected room QR labels PDF."
      );
    } finally {
      setWorking(false);
    }
  }

  async function handlePrintSelectedRoomLabels() {
    const roomsToPrint = visibleRooms.filter((room) =>
      selectedBulkRoomIds.includes(room.id)
    );

    await printLabelsForRooms(
      roomsToPrint,
      "Select one or more rooms before printing selected room labels."
    );
  }

  async function handlePrintAllRoomLabels() {
    await printLabelsForRooms(
      visibleRooms,
      "This storage space does not have any rooms to print."
    );
  }

  async function handlePrintSelectedLabels() {
    const compartmentsToPrint = visibleCompartments.filter((compartment) =>
      selectedBulkCompartmentIds.includes(compartment.id)
    );

    await printLabelsForCompartments(
      compartmentsToPrint,
      "Select one or more compartments before printing selected labels."
    );
  }

  async function handlePrintAllLabels() {
    await printLabelsForCompartments(
      visibleCompartments,
      "This storage space does not have any compartments to print."
    );
  }

  async function handleShareLabel() {
    if (!qrValue || working) return;

    try {
      setWorking(true);
      const qrImageData = await getQrImageData();

      const file = await Print.printToFileAsync({
        html: buildQrLabelHtml(qrImageData),
      });

      const canShare = await Sharing.isAvailableAsync();

      if (!canShare) {
        Alert.alert(
          "Sharing unavailable",
          "This device does not currently support sharing the QR label PDF."
        );
        return;
      }

      await Sharing.shareAsync(file.uri, {
        mimeType: "application/pdf",
        dialogTitle: "Share QR Label",
        UTI: "com.adobe.pdf",
      });
    } catch (err) {
      console.error("Failed to share QR label:", err);
      Alert.alert(
        "QR label not shared",
        "Something went wrong while creating the QR label PDF."
      );
    } finally {
      setWorking(false);
    }
  }

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.headerRow}>
            <HapticPressable
              style={[
                styles.backButton,
                {
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.card,
                },
              ]}
              onPress={() => router.back()}
            >
              <Text style={[styles.backText, { color: theme.colors.text }]}>
                Back
              </Text>
            </HapticPressable>

            <Text style={[styles.title, { color: theme.colors.text }]}>
              QR Labels
            </Text>
          </View>

          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            Create, print, or share QR labels for your compartments and storage locations.
          </Text>

          {checkingPremiumPlus ? (
            <Text style={[styles.message, { color: theme.colors.textSecondary }]}>
              Checking Premium+ access...
            </Text>
          ) : !hasPremiumPlus ? (
            <Text style={[styles.message, { color: theme.colors.textSecondary }]}>
              Create QR Labels requires Premium+.
            </Text>
          ) : loading ? (
            <Text style={[styles.message, { color: theme.colors.textSecondary }]}>
              Loading QR labels...
            </Text>
          ) : storageSpaces.length === 0 ? (
            <Text style={[styles.message, { color: theme.colors.textSecondary }]}>
              Create a storage space and compartment first.
            </Text>
          ) : (
            <>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                Storage Space
              </Text>

              <HapticPressable
                style={[
                  styles.dropdownButton,
                  {
                    borderColor: theme.colors.border,
                    backgroundColor: theme.colors.card,
                  },
                ]}
                onPress={handleChooseStorageSpace}
              >
                <View>
                  <Text style={[styles.dropdownLabel, { color: theme.colors.textSecondary }]}>
                    Selected Storage Space
                  </Text>
                  <Text style={[styles.dropdownValue, { color: theme.colors.text }]}>
                    {selectedStorage?.name ?? "Choose storage space"}
                  </Text>
                </View>
                <Text style={[styles.dropdownChevron, { color: theme.colors.textSecondary }]}>
                  ˅
                </Text>
              </HapticPressable>

              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                Label Type
              </Text>

              <View style={styles.labelTypeRow}>
                <HapticPressable
                  style={[
                    styles.labelTypeButton,
                    {
                      borderColor: labelType === "compartment" ? "#EF4444" : theme.colors.border,
                      backgroundColor: theme.colors.card,
                    },
                  ]}
                  onPress={() => setLabelType("compartment")}
                >
                  <Text style={[styles.labelTypeText, { color: theme.colors.text }]}>
                    Compartment
                  </Text>
                </HapticPressable>

                <HapticPressable
                  style={[
                    styles.labelTypeButton,
                    {
                      borderColor: labelType === "room" ? "#EF4444" : theme.colors.border,
                      backgroundColor: theme.colors.card,
                    },
                  ]}
                  onPress={() => setLabelType("room")}
                >
                  <Text style={[styles.labelTypeText, { color: theme.colors.text }]}>
                    Room
                  </Text>
                </HapticPressable>
              </View>

              {labelType === "compartment" ? (
                <>
                  <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                    Compartment
                  </Text>

              <HapticPressable
                style={[
                  styles.dropdownButton,
                  {
                    borderColor: theme.colors.border,
                    backgroundColor: theme.colors.card,
                  },
                ]}
                onPress={handleChooseCompartment}
              >
                <View>
                  <Text style={[styles.dropdownLabel, { color: theme.colors.textSecondary }]}>
                    Selected Compartment
                  </Text>
                  <Text style={[styles.dropdownValue, { color: theme.colors.text }]}>
                    {selectedCompartment?.name ?? "Choose compartment"}
                  </Text>
                  {selectedCompartment?.roomName ? (
                    <Text
                      style={[
                        styles.dropdownSubvalue,
                        { color: theme.colors.textSecondary },
                      ]}
                    >
                      {selectedCompartment.roomName}
                    </Text>
                  ) : null}
                </View>
                <Text style={[styles.dropdownChevron, { color: theme.colors.textSecondary }]}>
                  ˅
                </Text>
              </HapticPressable>

                </>
              ) : (
                <>
                  <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                    Room
                  </Text>

                  <HapticPressable
                    style={[
                      styles.dropdownButton,
                      {
                        borderColor: theme.colors.border,
                        backgroundColor: theme.colors.card,
                      },
                    ]}
                    onPress={handleChooseRoom}
                  >
                    <View>
                      <Text style={[styles.dropdownLabel, { color: theme.colors.textSecondary }]}>
                        Selected Room
                      </Text>
                      <Text style={[styles.dropdownValue, { color: theme.colors.text }]}>
                        {selectedRoom?.name ?? "Choose room"}
                      </Text>
                    </View>
                    <Text style={[styles.dropdownChevron, { color: theme.colors.textSecondary }]}>
                      ˅
                    </Text>
                  </HapticPressable>

                  {visibleRooms.length === 0 ? (
                    <Text style={[styles.message, { color: theme.colors.textSecondary }]}>
                      No rooms found for this storage space.
                    </Text>
                  ) : null}
                </>
              )}

              {labelType === "compartment" && visibleCompartments.length === 0 ? (
                <Text style={[styles.message, { color: theme.colors.textSecondary }]}>
                  No compartments found for this storage space.
                </Text>
              ) : null}

              <View style={styles.hiddenQrRenderArea}>
                {visibleCompartments.map((compartment) => (
                  <QRCode
                    key={`bulk-qr-${compartment.id}`}
                    value={`wheresmygear://compartment/${selectedStorage?.id ?? compartment.vehicleId ?? ""}/${compartment.id}`}
                    size={190}
                    getRef={(ref) => {
                      bulkQrCodeRefs.current[compartment.id] = ref;
                    }}
                  />
                ))}

                {visibleRooms.map((room) => (
                  <QRCode
                    key={`bulk-room-qr-${room.id}`}
                    value={`wheresmygear://room/${selectedStorage?.id ?? room.storageSpaceId ?? ""}/${room.id}`}
                    size={190}
                    getRef={(ref) => {
                      bulkQrCodeRefs.current[`room-${room.id}`] = ref;
                    }}
                  />
                ))}
              </View>

              {qrValue && (labelType === "room" ? selectedRoom : selectedCompartment) ? (
                <View
                  style={[
                    styles.previewCard,
                    {
                      borderColor: theme.colors.border,
                      backgroundColor: theme.colors.card,
                    },
                  ]}
                >
                  <Text style={[styles.previewTitle, { color: theme.colors.text }]}>
                    {labelType === "room" ? selectedRoom?.name : selectedCompartment?.name}
                  </Text>

                  <View style={styles.qrWrap}>
                    <QRCode
                      value={qrValue}
                      size={190}
                      getRef={(ref) => {
                        qrCodeRef.current = ref;
                      }}
                    />
                  </View>

                  <Text
                    style={[
                      styles.previewMeta,
                      { color: theme.colors.textSecondary },
                    ]}
                  >
                    {selectedStorage?.name ?? "Storage Space"}
                    {labelType === "compartment" && selectedCompartment?.roomName
                      ? ` • ${selectedCompartment.roomName}`
                      : ""}
                    {"\n"}
                    {labelType === "room"
                      ? `${visibleCompartments.filter((compartment) => compartment.roomId === selectedRoom?.id).length} compartment${visibleCompartments.filter((compartment) => compartment.roomId === selectedRoom?.id).length === 1 ? "" : "s"}`
                      : `${items.length} item${items.length === 1 ? "" : "s"}`}
                  </Text>

                  <View style={styles.actionRow}>
                    <HapticPressable
                      style={[
                        styles.actionButton,
                        {
                          borderColor: theme.colors.border,
                          backgroundColor: theme.colors.card,
                        },
                        working && styles.disabled,
                      ]}
                      onPress={handlePrintLabel}
                      disabled={working}
                    >
                      <Text
                        style={[styles.actionText, { color: theme.colors.text }]}
                      >
                        Print Label
                      </Text>
                    </HapticPressable>

                    <HapticPressable
                      style={[
                        styles.actionButton,
                        {
                          borderColor: theme.colors.border,
                          backgroundColor: theme.colors.card,
                        },
                        working && styles.disabled,
                      ]}
                      onPress={handleShareLabel}
                      disabled={working}
                    >
                      <Text
                        style={[styles.actionText, { color: theme.colors.text }]}
                      >
                        Share PDF
                      </Text>
                    </HapticPressable>
                  </View>
                </View>
              ) : null}

              {labelType === "room" && visibleRooms.length > 0 ? (
                <View
                  style={[
                    styles.bulkOuterCard,
                    {
                      borderColor: theme.colors.border,
                      backgroundColor: theme.colors.card,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.bulkSelectCard,
                      {
                        borderColor: theme.colors.border,
                        backgroundColor: theme.colors.card,
                      },
                    ]}
                  >
                    <Text style={[styles.bulkSelectTitle, { color: theme.colors.text }]}>
                      Select Room Labels to Print
                    </Text>

                    <Text
                      style={[
                        styles.bulkSelectSubtitle,
                        { color: theme.colors.textSecondary },
                      ]}
                    >
                      {selectedBulkRoomIds.length} of {visibleRooms.length} selected
                    </Text>

                    <View style={styles.bulkSelectActions}>
                      <HapticPressable
                        style={[
                          styles.smallActionButton,
                          {
                            borderColor: theme.colors.border,
                            backgroundColor: theme.colors.card,
                          },
                        ]}
                        onPress={handleSelectAllBulkRooms}
                        disabled={working || visibleRooms.length === 0}
                      >
                        <Text style={[styles.smallActionText, { color: theme.colors.text }]}>
                          Select All
                        </Text>
                      </HapticPressable>

                      <HapticPressable
                        style={[
                          styles.smallActionButton,
                          {
                            borderColor: theme.colors.border,
                            backgroundColor: theme.colors.card,
                          },
                        ]}
                        onPress={handleClearBulkRooms}
                        disabled={working || selectedBulkRoomIds.length === 0}
                      >
                        <Text style={[styles.smallActionText, { color: theme.colors.text }]}>
                          Clear
                        </Text>
                      </HapticPressable>
                    </View>

                    <ScrollView
                      style={styles.bulkCompartmentList}
                      nestedScrollEnabled
                      showsVerticalScrollIndicator
                    >
                      {visibleRooms.map((room) => {
                        const selected = selectedBulkRoomIds.includes(room.id);
                        const roomCompartmentCount = visibleCompartments.filter(
                          (compartment) => compartment.roomId === room.id
                        ).length;

                        return (
                          <HapticPressable
                            key={`bulk-room-select-${room.id}`}
                            style={[
                              styles.bulkCompartmentRow,
                              {
                                borderColor: selected ? "#EF4444" : theme.colors.border,
                                backgroundColor: theme.colors.card,
                              },
                            ]}
                            onPress={() => toggleBulkRoomSelection(room.id)}
                            disabled={working}
                          >
                            <View style={styles.bulkCheckBox}>
                              <Text style={[styles.bulkCheckText, { color: selected ? "#EF4444" : theme.colors.textSecondary }]}>
                                {selected ? "✓" : ""}
                              </Text>
                            </View>

                            <View style={styles.bulkCompartmentTextWrap}>
                              <Text style={[styles.bulkCompartmentName, { color: theme.colors.text }]}>
                                {room.name || "Room"}
                              </Text>
                              <Text
                                style={[
                                  styles.bulkCompartmentRoom,
                                  { color: theme.colors.textSecondary },
                                ]}
                              >
                                {roomCompartmentCount} compartment{roomCompartmentCount === 1 ? "" : "s"}
                              </Text>
                            </View>
                          </HapticPressable>
                        );
                      })}
                    </ScrollView>
                  </View>

                  <HapticPressable
                    style={[
                      styles.fullWidthActionButton,
                      {
                        borderColor: theme.colors.border,
                        backgroundColor: theme.colors.card,
                      },
                      working && styles.disabled,
                    ]}
                    onPress={handlePrintSelectedRoomLabels}
                    disabled={working || selectedBulkRoomIds.length === 0}
                  >
                    <Text style={[styles.actionText, { color: theme.colors.text }]}>
                      Print Selected Room Labels
                    </Text>
                  </HapticPressable>

                  <HapticPressable
                    style={[
                      styles.fullWidthActionButton,
                      {
                        borderColor: theme.colors.border,
                        backgroundColor: theme.colors.card,
                      },
                      working && styles.disabled,
                    ]}
                    onPress={handlePrintAllRoomLabels}
                    disabled={working || visibleRooms.length === 0}
                  >
                    <Text style={[styles.actionText, { color: theme.colors.text }]}>
                      Print All Room Labels
                    </Text>
                  </HapticPressable>
                </View>
              ) : null}

              {labelType === "compartment" && visibleCompartments.length > 0 ? (
                <View
                  style={[
                    styles.bulkOuterCard,
                    {
                      borderColor: theme.colors.border,
                      backgroundColor: theme.colors.card,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.bulkSelectCard,
                      {
                        borderColor: theme.colors.border,
                        backgroundColor: theme.colors.card,
                      },
                    ]}
                  >
                    <Text style={[styles.bulkSelectTitle, { color: theme.colors.text }]}>
                      Select Labels to Print
                    </Text>

                    <Text
                      style={[
                        styles.bulkSelectSubtitle,
                        { color: theme.colors.textSecondary },
                      ]}
                    >
                      {selectedBulkCompartmentIds.length} of {visibleCompartments.length} selected
                    </Text>

                    <View style={styles.bulkSelectActions}>
                      <HapticPressable
                        style={[
                          styles.smallActionButton,
                          {
                            borderColor: theme.colors.border,
                            backgroundColor: theme.colors.card,
                          },
                        ]}
                        onPress={handleSelectAllBulkLabels}
                        disabled={working || visibleCompartments.length === 0}
                      >
                        <Text style={[styles.smallActionText, { color: theme.colors.text }]}>
                          Select All
                        </Text>
                      </HapticPressable>

                      <HapticPressable
                        style={[
                          styles.smallActionButton,
                          {
                            borderColor: theme.colors.border,
                            backgroundColor: theme.colors.card,
                          },
                        ]}
                        onPress={handleClearBulkLabels}
                        disabled={working || selectedBulkCompartmentIds.length === 0}
                      >
                        <Text style={[styles.smallActionText, { color: theme.colors.text }]}>
                          Clear
                        </Text>
                      </HapticPressable>
                    </View>

                    <ScrollView
                      style={styles.bulkCompartmentList}
                      nestedScrollEnabled
                      showsVerticalScrollIndicator
                    >
                      {visibleCompartments.map((compartment) => {
                        const selected = selectedBulkCompartmentIds.includes(compartment.id);

                        return (
                          <HapticPressable
                            key={`bulk-select-${compartment.id}`}
                            style={[
                              styles.bulkCompartmentRow,
                              {
                                borderColor: selected ? "#EF4444" : theme.colors.border,
                                backgroundColor: theme.colors.card,
                              },
                            ]}
                            onPress={() => toggleBulkCompartmentSelection(compartment.id)}
                            disabled={working}
                          >
                            <View style={styles.bulkCheckBox}>
                              <Text style={[styles.bulkCheckText, { color: selected ? "#EF4444" : theme.colors.textSecondary }]}>
                                {selected ? "✓" : ""}
                              </Text>
                            </View>

                            <View style={styles.bulkCompartmentTextWrap}>
                              <Text style={[styles.bulkCompartmentName, { color: theme.colors.text }]}>
                                {compartment.name || "Compartment"}
                              </Text>
                              {compartment.roomName ? (
                                <Text
                                  style={[
                                    styles.bulkCompartmentRoom,
                                    { color: theme.colors.textSecondary },
                                  ]}
                                >
                                  {compartment.roomName}
                                </Text>
                              ) : null}
                            </View>
                          </HapticPressable>
                        );
                      })}
                    </ScrollView>
                  </View>

                  <HapticPressable
                    style={[
                      styles.fullWidthActionButton,
                      {
                        borderColor: theme.colors.border,
                        backgroundColor: theme.colors.card,
                      },
                      working && styles.disabled,
                    ]}
                    onPress={handlePrintSelectedLabels}
                    disabled={working || selectedBulkCompartmentIds.length === 0}
                  >
                    <Text style={[styles.actionText, { color: theme.colors.text }]}>
                      Print Selected Labels
                    </Text>
                  </HapticPressable>

                  <HapticPressable
                    style={[
                      styles.fullWidthActionButton,
                      {
                        borderColor: theme.colors.border,
                        backgroundColor: theme.colors.card,
                      },
                      working && styles.disabled,
                    ]}
                    onPress={handlePrintAllLabels}
                    disabled={working || visibleCompartments.length === 0}
                  >
                    <Text style={[styles.actionText, { color: theme.colors.text }]}>
                      Print All Labels for This Storage Space
                    </Text>
                  </HapticPressable>


                </View>
              ) : null}
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
  content: {
    gap: 16,
    padding: 20,
    paddingBottom: 44,
  },
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
  },
  backButton: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  backText: {
    fontSize: 15,
    fontWeight: "800",
  },
  title: {
    fontSize: 30,
    fontWeight: "900",
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 21,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "900",
    marginTop: 4,
  },
  labelTypeRow: {
    flexDirection: "row",
    gap: 10,
  },
  labelTypeButton: {
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 2,
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  labelTypeText: {
    fontSize: 15,
    fontWeight: "900",
  },
  dropdownButton: {
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 74,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dropdownLabel: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  dropdownValue: {
    fontSize: 18,
    fontWeight: "900",
  },
  dropdownSubvalue: {
    fontSize: 14,
    marginTop: 3,
  },
  dropdownChevron: {
    fontSize: 28,
    fontWeight: "900",
    paddingLeft: 14,
  },
  optionWrap: {
    gap: 10,
  },
  optionButton: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  optionText: {
    fontSize: 16,
    fontWeight: "800",
  },
  optionSubtext: {
    fontSize: 13,
    marginTop: 4,
  },
  message: {
    fontSize: 15,
    lineHeight: 21,
  },
  previewCard: {
    alignItems: "center",
    borderRadius: 22,
    borderWidth: 1,
    gap: 14,
    marginTop: 8,
    padding: 18,
  },
  previewTitle: {
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center",
  },
  hiddenQrRenderArea: {
    height: 1,
    opacity: 0,
    overflow: "hidden",
    position: "absolute",
    width: 1,
  },
  qrWrap: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
  },
  previewMeta: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  bulkOuterCard: {
    borderRadius: 22,
    borderWidth: 1,
    gap: 12,
    padding: 14,
    width: "100%",
  },
  bulkSelectCard: {
    borderRadius: 18,
    borderWidth: 1,
    gap: 10,
    padding: 14,
    width: "100%",
  },
  bulkSelectTitle: {
    fontSize: 17,
    fontWeight: "900",
  },
  bulkSelectSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  bulkSelectActions: {
    flexDirection: "row",
    gap: 10,
  },
  smallActionButton: {
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  smallActionText: {
    fontSize: 13,
    fontWeight: "900",
  },
  bulkCompartmentList: {
    maxHeight: 260,
  },
  bulkCompartmentRow: {
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  bulkCheckBox: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    height: 24,
    justifyContent: "center",
    width: 24,
  },
  bulkCheckText: {
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 18,
  },
  bulkCompartmentTextWrap: {
    flex: 1,
  },
  bulkCompartmentName: {
    fontSize: 15,
    fontWeight: "900",
  },
  bulkCompartmentRoom: {
    fontSize: 12,
    marginTop: 2,
  },
  fullWidthActionButton: {
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 14,
    width: "100%",
  },
  actionRow: {
    flexDirection: Platform.OS === "web" ? "row" : "row",
    gap: 10,
    width: "100%",
  },
  actionButton: {
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  actionText: {
    fontSize: 15,
    fontWeight: "900",
  },
  disabled: {
    opacity: 0.55,
  },
});
