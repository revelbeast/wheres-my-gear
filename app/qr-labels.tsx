import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { router } from "expo-router";
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

import HapticPressable from "../components/ui/HapticPressable";
import ScreenBackground from "../components/ui/ScreenBackground";
import { useThemedValues } from "../components/ui/Themed";
import {
  Compartment,
  Item,
  StorageSpace,
  getAllCompartments,
  getItemsByCompartment,
  getStorageSpaces,
} from "../lib/gearService";

export default function QrLabelsScreen() {
  const theme = useThemedValues();
  const qrCodeRef = useRef<any>(null);

  const [storageSpaces, setStorageSpaces] = useState<StorageSpace[]>([]);
  const [compartments, setCompartments] = useState<Compartment[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [selectedStorageId, setSelectedStorageId] = useState("");
  const [selectedCompartmentId, setSelectedCompartmentId] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

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

  const selectedCompartment = useMemo(
    () =>
      compartments.find(
        (compartment) => compartment.id === selectedCompartmentId
      ) ?? null,
    [compartments, selectedCompartmentId]
  );

  const qrValue = useMemo(() => {
    if (!selectedCompartment?.id) return "";
    return `wheresmygear://compartment/${selectedCompartment.id}`;
  }, [selectedCompartment?.id]);

  useEffect(() => {
    let active = true;

    async function loadData() {
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
          "QR Labels unavailable",
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
  }, []);

  useEffect(() => {
    const firstCompartment = compartments.find(
      (compartment) => compartment.vehicleId === selectedStorageId
    );

    setSelectedCompartmentId(firstCompartment?.id ?? "");
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

  function buildQrLabelHtml(qrImageData: string) {
    const storageName = selectedStorage?.name?.trim() || "Storage Space";
    const compartmentName =
      selectedCompartment?.name?.trim() || "Compartment";
    const roomName = selectedCompartment?.roomName?.trim();

    return `
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
              margin: 0;
              padding: 24px;
              color: #111827;
            }
            .label {
              border: 2px solid #111827;
              border-radius: 18px;
              padding: 24px;
              width: 360px;
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
              font-size: 26px;
              font-weight: 800;
              margin-bottom: 16px;
            }
            .qr {
              width: 220px;
              height: 220px;
              margin: 0 auto 16px auto;
            }
            .meta {
              font-size: 15px;
              line-height: 1.45;
              text-align: left;
              margin-top: 14px;
              border-top: 1px solid #d1d5db;
              padding-top: 14px;
            }
            .hint {
              font-size: 12px;
              color: #4b5563;
              margin-top: 14px;
            }
          </style>
        </head>
        <body>
          <div class="label">
            <div class="app">Where's My Gear</div>
            <div class="title">${compartmentName}</div>
            <img class="qr" src="data:image/png;base64,${qrImageData}" />
            <div class="meta">
              <div><strong>Storage:</strong> ${storageName}</div>
              ${roomName ? `<div><strong>Room:</strong> ${roomName}</div>` : ""}
              <div><strong>Compartment:</strong> ${compartmentName}</div>
              <div><strong>Items:</strong> ${items.length}</div>
            </div>
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
            Choose a storage space and compartment, then print or share a QR label.
          </Text>

          {loading ? (
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

              <View style={styles.optionWrap}>
                {storageSpaces.map((space) => {
                  const selected = selectedStorageId === space.id;

                  return (
                    <HapticPressable
                      key={space.id}
                      style={[
                        styles.optionButton,
                        {
                          borderColor: selected
                            ? "#2563EB"
                            : theme.colors.border,
                          backgroundColor: theme.colors.card,
                        },
                      ]}
                      onPress={() => setSelectedStorageId(space.id)}
                    >
                      <Text style={[styles.optionText, { color: theme.colors.text }]}>
                        {space.name}
                      </Text>
                    </HapticPressable>
                  );
                })}
              </View>

              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                Compartment
              </Text>

              {visibleCompartments.length === 0 ? (
                <Text
                  style={[styles.message, { color: theme.colors.textSecondary }]}
                >
                  No compartments found for this storage space.
                </Text>
              ) : (
                <View style={styles.optionWrap}>
                  {visibleCompartments.map((compartment) => {
                    const selected = selectedCompartmentId === compartment.id;

                    return (
                      <HapticPressable
                        key={compartment.id}
                        style={[
                          styles.optionButton,
                          {
                            borderColor: selected
                              ? "#2563EB"
                              : theme.colors.border,
                            backgroundColor: theme.colors.card,
                          },
                        ]}
                        onPress={() => setSelectedCompartmentId(compartment.id)}
                      >
                        <Text
                          style={[styles.optionText, { color: theme.colors.text }]}
                        >
                          {compartment.name}
                        </Text>
                        {compartment.roomName ? (
                          <Text
                            style={[
                              styles.optionSubtext,
                              { color: theme.colors.textSecondary },
                            ]}
                          >
                            {compartment.roomName}
                          </Text>
                        ) : null}
                      </HapticPressable>
                    );
                  })}
                </View>
              )}

              {qrValue && selectedCompartment ? (
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
                    {selectedCompartment.name}
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
                    {selectedCompartment.roomName
                      ? ` • ${selectedCompartment.roomName}`
                      : ""}
                    {"\n"}
                    {items.length} item{items.length === 1 ? "" : "s"}
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
