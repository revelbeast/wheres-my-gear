import {
  CameraView,
  useCameraPermissions,
} from "expo-camera";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Alert } from "react-native";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Dimensions, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../components/auth/AuthProvider";
import { isPremiumPlusUser } from "../lib/revenuecat";
import HapticPressable from "../components/ui/HapticPressable";
import { resolveBarcode } from "../lib/barcodeResolver";
import { getCompartmentById, getItemsByCompartment, getRoomById, getStorageSpaceById } from "../lib/gearService";

export default function ScanItemScreen() {
  const { mode } = useLocalSearchParams();
  const isAiMode = String(mode ?? "") === "ai";
  const autoAiScanStartedRef = React.useRef(false);
  const { user } = useAuth();
  const [hasPremiumPlusAccess, setHasPremiumPlusAccess] = useState(false);
  const [checkingPremiumPlusAccess, setCheckingPremiumPlusAccess] = useState(true);
  const [permission, requestPermission] = useCameraPermissions();
  const [mounted, setMounted] = useState(false);
  const _resolverAnchor = resolveBarcode;

  // scan lock
  const [isScanning, setIsScanning] = useState(false);
  const [arOverlay, setArOverlay] = useState<any>(null);
  const [arAnchor, setArAnchor] = useState<{ top: number; left: number } | null>(null);
  const [arLabels, setArLabels] = useState<any[]>([]);

  // camera lifecycle control
  const [cameraActive, setCameraActive] = useState(true);

  const cameraRef = React.useRef<CameraView | null>(null);

  // session tracking
  const scanSessionRef = React.useRef({
    active: true,
    lastCode: null as string | null,
    timestamp: 0,
  });

  const scanHistoryRef = React.useRef<string[]>([]);

  // derived UI values
  const lastScan =
    scanHistoryRef.current.length > 0
      ? scanHistoryRef.current[scanHistoryRef.current.length - 1]
      : null;

  const scanCount = scanHistoryRef.current.length;

  // -----------------------------
  // PRODUCT LOOKUP (SAFE)
  // -----------------------------
  const lookupProductName = async (barcode: string): Promise<string | null> => {
    try {
      const res = await fetch(
        `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`
      );

      const text = await res.text();

      // guard against HTML responses
      if (text.trim().startsWith("<")) {
        return null;
      }

      const data = JSON.parse(text);

      if (data?.status === 1) {
        return (
          data?.product?.product_name ||
          data?.product?.generic_name ||
          null
        );
      }

      return null;
    } catch (err) {
      console.log("PRODUCT LOOKUP FAILED:", err);
      return null;
    }
  };

  // -----------------------------
  // SCAN CONTEXT (OPTION A CORE)
  // -----------------------------
  const getScanContext = async (value: string) => {
    const productName = await lookupProductName(value);

    const isFound = !!productName;

    const isDuplicateInSession = scanHistoryRef.current.includes(value);

    return {
      barcode: value,
      scanNumber: scanHistoryRef.current.length + 1,
      isDuplicateInSession,
      found: isFound,
      suggestedName: isFound ? productName : null,
      timestamp: Date.now(),
    };
  };

  const handleAnalyzeImageWithAI = async () => {
    if (isScanning) return;
    if (!cameraRef.current) return;
    if (!cameraActive) return;

    try {
      setIsScanning(true);

      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.55,
        skipProcessing: true,
      });

      if (!photo?.base64) {
        Alert.alert("AI Scan Failed", "Could not capture an image for AI analysis.");
        return;
      }

      const response = await fetch(
        "https://us-central1-wheres-my-gear-ab7a7.cloudfunctions.net/analyzeGearImageWithRekognition",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            imageBase64: photo.base64,
          }),
        }
      );

      const result = await response.json();

      setArOverlay({
        type: "ai",
        code: "AI_IMAGE_SCAN",
        found: !!result?.found,
        suggestedName: result?.title ?? "",
        source: "AWS Rekognition",
        brand: result?.brand ?? "",
        image: photo.uri ?? "",
        description: result?.description ?? "",
        matchConfidence: result?.confidence != null ? String(result.confidence) : "",
        matchStatus: result?.found ? "possible" : "unknown",
      });
    } catch (error) {
      console.log("AI IMAGE SCAN FAILED:", error);
      Alert.alert(
        "AI Scan Failed",
        "Where's My Gear could not analyze this image. You can still scan a barcode or add the item manually."
      );
    } finally {
      setIsScanning(false);
    }
  };

  useEffect(() => {
    if (!isAiMode) return;
    if (autoAiScanStartedRef.current) return;
    if (checkingPremiumPlusAccess) return;
    if (!hasPremiumPlusAccess) return;
    if (!mounted) return;
    if (!permission?.granted) return;
    if (!cameraActive) return;
    if (!cameraRef.current) return;

    autoAiScanStartedRef.current = true;

    const timer = setTimeout(() => {
      void handleAnalyzeImageWithAI();
    }, 2500);

    return () => clearTimeout(timer);
  }, [
    isAiMode,
    checkingPremiumPlusAccess,
    hasPremiumPlusAccess,
    mounted,
    permission?.granted,
    cameraActive,
  ]);

  // permission handling
  useEffect(() => {
    if (!permission) return;

    if (!permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission?.granted]);

  // mounted flag
  useEffect(() => {
    setMounted(true);
  }, []);

  // Premium+ enforcement
  useEffect(() => {
    let active = true;

    async function validatePremiumPlusAccess() {
      try {
        if (!user) {
          router.replace("/sign-in");
          return;
        }

        const hasAccess = await isPremiumPlusUser();

        if (!active) return;

        setHasPremiumPlusAccess(hasAccess);

        if (!hasAccess) {
          Alert.alert(
            "Unlock Premium +",
            "QR and Barcode scanning is a Premium + add-on feature for smart gear scanning and faster item setup.",
            [
              {
                text: "Not Now",
                style: "cancel",
                onPress: () => router.back(),
              },
              {
                text: "Upgrade to Premium +",
                onPress: () =>
                  router.push({
                    pathname: "/paywall",
                    params: { plan: "premium_plus" },
                  }),
              },
            ]
          );
        }
      } catch (error) {
        console.error("Premium+ access check failed:", error);
        router.back();
      } finally {
        if (active) {
          setCheckingPremiumPlusAccess(false);
        }
      }
    }

    void validatePremiumPlusAccess();

    return () => {
      active = false;
    };
  }, [user]);

  // camera lifecycle control
  useFocusEffect(
    useCallback(() => {
      setCameraActive(true);
      scanSessionRef.current.active = true;

      return () => {
        setCameraActive(false);
        scanSessionRef.current.active = false;

        scanSessionRef.current.lastCode = null;
        scanSessionRef.current.timestamp = 0;
        scanHistoryRef.current = [];
      };
    }, [])
  );

  if (checkingPremiumPlusAccess || !hasPremiumPlusAccess) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.text}>Checking Premium+ access...</Text>
      </View>
    );
  }

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>Camera permission required</Text>

        <HapticPressable style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Enable Camera</Text>
        </HapticPressable>
      </View>
    );
  }

  if (!mounted || !permission?.granted) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.text}>Starting camera...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
<CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
        active={cameraActive}
        barcodeScannerSettings={{
          barcodeTypes: [
            "qr",
            "ean13",
            "ean8",
            "code128",
            "pdf417",
            "upc_a",
            "upc_e",
          ],
        }}
        onBarcodeScanned={async (event) => {
          const value = event?.data;

          let currentScanAnchor: { top: number; left: number } | null = null;
          let currentCalloutAnchor: { top: number; left: number } | null = null;

          if (event?.bounds?.origin && event?.bounds?.size) {
            const screenWidth = Dimensions.get("window").width;
            const cardWidth = 285;
            const margin = 16;
            const qrX = event.bounds.origin.x;
            const qrY = event.bounds.origin.y;
            const qrWidth = event.bounds.size.width;

            let left = qrX + qrWidth + 12;

            if (left + cardWidth > screenWidth - margin) {
              left = qrX - cardWidth - 12;
            }

            left = Math.max(margin, Math.min(left, screenWidth - cardWidth - margin));

            currentScanAnchor = {
              top: Math.max(115, qrY - 185),
              left,
            };

            currentCalloutAnchor = {
              top: Math.max(84, qrY - 38),
              left: Math.max(12, Math.min(qrX + qrWidth + 8, screenWidth - 150)),
            };

            setArAnchor(currentScanAnchor);
          }

          if (!value) return;

          // HARD GUARD
          if (!cameraActive) return;
          if (!scanSessionRef.current.active) return;

          // SOFT LOCK
          // Keep camera active so multiple QR labels can be detected in one session.
          setIsScanning(true);

          // duplicate protection
          if (
            scanSessionRef.current.lastCode === value ||
            scanHistoryRef.current.includes(value)
          ) {
            setIsScanning(false);
            return;
          }

          const now = Date.now();
          if (now - scanSessionRef.current.timestamp < 300) return;

          scanSessionRef.current.lastCode = value;
          scanSessionRef.current.timestamp = now;
          scanHistoryRef.current.push(value);

          const compartmentQrPrefix = "wheresmygear://compartment/";
          const roomQrPrefix = "wheresmygear://room/";
          const storageQrPrefix = "wheresmygear://storage/";

          if (String(value).startsWith(storageQrPrefix)) {
            const scannedStorageId = String(value).replace(storageQrPrefix, "").trim();

            if (scannedStorageId) {
              router.replace({
                pathname: "/vehicles/[vehicleId]",
                params: {
                  vehicleId: scannedStorageId,
                },
              });
              return;
            }
          }

          if (String(value).startsWith(roomQrPrefix)) {
            const roomPayload = String(value).replace(roomQrPrefix, "").trim();
            const [maybeStorageId, maybeRoomId] = roomPayload.split("/").filter(Boolean);

            const scannedStorageId = maybeRoomId ? maybeStorageId : "";
            const scannedRoomId = maybeRoomId || maybeStorageId;

            if (scannedRoomId) {
              if (scannedStorageId) {
                router.replace({
                  pathname: "/vehicles/[vehicleId]/rooms/[roomId]",
                  params: {
                    vehicleId: scannedStorageId,
                    roomId: scannedRoomId,
                  },
                });
                return;
              }

              const room = await getRoomById(scannedRoomId);

              if (room?.storageSpaceId) {
                router.replace({
                  pathname: "/vehicles/[vehicleId]/rooms/[roomId]",
                  params: {
                    vehicleId: room.storageSpaceId,
                    roomId: scannedRoomId,
                  },
                });
                return;
              }

              Alert.alert(
                "Room not found",
                "Where's My Gear could not find the room connected to this QR label."
              );
              return;
            }
          }

          if (String(value).startsWith(compartmentQrPrefix)) {
            const compartmentPayload = String(value)
              .replace(compartmentQrPrefix, "")
              .trim();

            const [maybeStorageId, maybeCompartmentId] = compartmentPayload
              .split("/")
              .filter(Boolean);

            const scannedStorageId = maybeCompartmentId ? maybeStorageId : "unknown";
            const scannedCompartmentId = maybeCompartmentId || maybeStorageId;

            if (scannedCompartmentId) {
              const compartment = await getCompartmentById(scannedCompartmentId);
              const storageSpace = compartment?.vehicleId
                ? await getStorageSpaceById(compartment.vehicleId)
                : null;
              const items = await getItemsByCompartment(scannedCompartmentId);

              const packedCount = items.filter((item: any) => item.status === "packed").length;
              const topItems = items
                .slice(0, 5)
                .map((item: any) => item.name)
                .filter(Boolean);

              const nextOverlay = {
                type: "compartment",
                code: value,
                found: !!compartment,
                compartmentId: scannedCompartmentId,
                vehicleId: compartment?.vehicleId || scannedStorageId,
                roomId: compartment?.roomId || "",
                suggestedName: compartment?.name || "Compartment",
                source: "QR Label",
                roomName: compartment?.roomName || "No room assigned",
                storageSpaceName: storageSpace?.name || "Unknown storage",
                itemCount: items.length,
                packedCount,
                topItems,
                matchStatus: compartment ? "found" : "unknown",
              };

              const visibleOverlay = {
                ...nextOverlay,
                anchor: currentScanAnchor,
                calloutAnchor: currentCalloutAnchor,
                lastSeenAt: Date.now(),
              };

              setArLabels((current) => {
                const withoutExisting = current.filter(
                  (label) => label.compartmentId !== scannedCompartmentId
                );

                return [
                  ...withoutExisting,
                  visibleOverlay,
                ]
                  .sort((a, b) => {
                    const aTop = a?.anchor?.top ?? 9999;
                    const bTop = b?.anchor?.top ?? 9999;
                    return aTop - bTop;
                  })
                  .slice(0, 5);
              });

              setArOverlay(visibleOverlay);
              setIsScanning(false);

              return;
            }
          }

          // 🧠 SINGLE SOURCE OF TRUTH (NEW)
          const result = await resolveBarcode(value);

          console.log("SCAN RESULT:", result);

          // route
          setArOverlay({
            type: "barcode",
            code: result.barcode,
            found: result.found,
            suggestedName: result.bestName ?? "",
            source: result.sources.upcitemdb ? "UPCitemDB" : result.sources.openFoodFacts ? "OpenFoodFacts" : "Unknown",
            brand: result.sources.upcitemdb?.brand ?? "",
            image: result.sources.upcitemdb?.image ?? "",
            description: result.sources.upcitemdb?.description ?? "",
            matchConfidence: result.sources.upcitemdb?.confidence != null ? String(result.sources.upcitemdb.confidence) : "",
            matchStatus: result.found ? "found" : "unknown",
          });

          setTimeout(() => {
            setIsScanning(false);
          }, 800);
        }}
      />

      {arOverlay ? (
        <>
          {arLabels.map((label) => {
            const notPacked = Math.max(0, (label.itemCount ?? 0) - (label.packedCount ?? 0));
            const isSelected = arOverlay?.compartmentId === label.compartmentId;

            if (!label.calloutAnchor) return null;

            return (
              <HapticPressable
                key={`callout-${label.compartmentId}`}
                style={[
                  styles.arCalloutChip,
                  {
                    top: label.calloutAnchor.top,
                    left: label.calloutAnchor.left,
                  },
                  isSelected ? styles.arCalloutChipSelected : null,
                ]}
                onPress={() => {
                  setArOverlay(label);
                  setArAnchor(label.anchor ?? null);
                }}
              >
                <Text style={styles.arCalloutName} numberOfLines={1}>
                  {label.suggestedName || "Compartment"}
                </Text>
                <Text style={styles.arCalloutMeta}>
                  {(label.itemCount ?? 0)} items · {notPacked === 0 ? "OK" : `${notPacked} missing`}
                </Text>
              </HapticPressable>
            );
          })}

          {arLabels.length > 1 ? (
            <View style={styles.nearbyLabelsPanel}>
              <Text style={styles.nearbyLabelsTitle}>
                Labels In View ({arLabels.length})
              </Text>

              <Text style={styles.nearbyLabelsHint}>
                Tap a label to preview contents
              </Text>

              {arLabels.map((label) => {
                const isSelected = arOverlay?.compartmentId === label.compartmentId;
                const notPacked = Math.max(0, (label.itemCount ?? 0) - (label.packedCount ?? 0));

                return (
                  <HapticPressable
                    key={label.compartmentId}
                    style={[
                      styles.nearbyLabelRow,
                      isSelected ? styles.nearbyLabelRowSelected : null,
                    ]}
                    onPress={() => {
                      setArOverlay(label);
                      setArAnchor(label.anchor ?? null);
                    }}
                  >
                    <View style={styles.nearbyLabelTextBox}>
                      <Text style={styles.nearbyLabelName} numberOfLines={1}>
                        {isSelected ? "✓ " : ""}{label.suggestedName || "Compartment"}
                      </Text>
                      <Text style={styles.nearbyLabelMeta}>
                        {(label.itemCount ?? 0)} items
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.nearbyStatusBadge,
                        notPacked === 0 ? styles.nearbyStatusGood : styles.nearbyStatusWarn,
                      ]}
                    >
                      <Text style={styles.nearbyStatusText}>
                        {notPacked === 0 ? "All Present" : `${notPacked} Missing`}
                      </Text>
                    </View>

                    <Text style={styles.nearbyLabelChevron}>›</Text>
                  </HapticPressable>
                );
              })}
            </View>
          ) : null}

          <View
            style={[
              styles.arCard,
              arLabels.length > 1
                ? { top: 128 + arLabels.length * 82 }
                : null,
            ]}
          >
          <View style={styles.arCardHeader}>
            <Text style={styles.arCardTitle}>
              {arOverlay?.suggestedName || "Gear Scan Result"}
            </Text>

            <HapticPressable
              style={styles.arCloseButton}
              onPress={() => {
                setArOverlay(null);
                setArAnchor(null);
                scanSessionRef.current.active = true;
                setCameraActive(true);
                setIsScanning(false);
              }}
            >
              <Text style={styles.arCloseText}>×</Text>
            </HapticPressable>
          </View>

          <Text style={styles.arCardSubtitle}>
            {arOverlay?.type === "compartment"
              ? "Compartment Inventory"
              : arOverlay?.found
                ? "Recognized label or item"
                : "Unknown item"}
          </Text>

          {arOverlay?.type === "compartment" ? (
            <>
              <View style={styles.arStatsRow}>
                <View style={styles.arStatBox}>
                  <Text style={styles.arStatNumber}>{arOverlay?.itemCount ?? 0}</Text>
                  <Text style={styles.arStatLabel}>Items</Text>
                </View>

                <View style={styles.arStatBox}>
                  <Text style={styles.arStatNumber}>{arOverlay?.packedCount ?? 0}</Text>
                  <Text style={styles.arStatLabel}>Packed</Text>
                </View>
              </View>

              {Array.isArray(arOverlay?.topItems) && arOverlay.topItems.length > 0 ? (
                <View style={styles.arTopItemsBox}>
                  <Text style={styles.arTopItemsTitle}>Top Items</Text>
                  <Text style={styles.arTopItemsText}>
                    {arOverlay.topItems.slice(0, 3).join(", ")}
                    {arOverlay.topItems.length > 3 ? ` +${arOverlay.topItems.length - 3} more` : ""}
                  </Text>
                </View>
              ) : null}
            </>
          ) : null}

          {arOverlay?.type === "compartment" ? (
            <>
              <View style={styles.arMetricRow}>
                <Text style={styles.arMetricLabel}>Room</Text>
                <Text style={styles.arMetricValue} numberOfLines={1}>
                  {arOverlay?.roomName || "No room assigned"}
                </Text>
              </View>

              <View style={styles.arMetricRow}>
                <Text style={styles.arMetricLabel}>Storage</Text>
                <Text style={styles.arMetricValue} numberOfLines={1}>
                  {arOverlay?.storageSpaceName || "Unknown storage"}
                </Text>
              </View>
            </>
          ) : (
            <>
              <View style={styles.arMetricRow}>
                <Text style={styles.arMetricLabel}>Source</Text>
                <Text style={styles.arMetricValue}>{arOverlay?.source || "Unknown"}</Text>
              </View>

              <View style={styles.arMetricRow}>
                <Text style={styles.arMetricLabel}>Code</Text>
                <Text style={styles.arMetricValue} numberOfLines={1}>
                  {arOverlay?.code || "N/A"}
                </Text>
              </View>
            </>
          )}

          {arOverlay?.brand ? (
            <View style={styles.arMetricRow}>
              <Text style={styles.arMetricLabel}>Brand</Text>
              <Text style={styles.arMetricValue}>{arOverlay.brand}</Text>
            </View>
          ) : null}

          {arOverlay?.matchConfidence ? (
            <View style={styles.arMetricRow}>
              <Text style={styles.arMetricLabel}>Confidence</Text>
              <Text style={styles.arMetricValue}>{arOverlay.matchConfidence}</Text>
            </View>
          ) : null}

          {arOverlay?.description ? (
            <Text style={styles.arDescription} numberOfLines={3}>
              {arOverlay.description}
            </Text>
          ) : null}

          <HapticPressable
            style={styles.arPrimaryButton}
            onPress={() => {
              setArOverlay(null);
              setArAnchor(null);
              if (arOverlay?.type === "compartment" && arOverlay?.compartmentId) {
                router.replace({
                  pathname: "/vehicles/[vehicleId]/compartments/[compartmentId]",
                  params: {
                    vehicleId: arOverlay?.vehicleId ?? "unknown",
                    compartmentId: arOverlay.compartmentId,
                  },
                });
                return;
              }

              router.replace({
                pathname: "/scan-result",
                params: {
                  code: arOverlay?.code ?? "",
                  found: String(!!arOverlay?.found),
                  suggestedName: arOverlay?.suggestedName ?? "",
                  source: arOverlay?.source ?? "Unknown",
                  brand: arOverlay?.brand ?? "",
                  image: arOverlay?.image ?? "",
                  description: arOverlay?.description ?? "",
                  matchConfidence: arOverlay?.matchConfidence ?? "",
                  matchStatus: arOverlay?.matchStatus ?? "unknown",
                },
              });
            }}
          >
            <Text style={styles.arPrimaryButtonText}>Open Details</Text>
          </HapticPressable>
          </View>
        </>
      ) : null}

      <View style={styles.footer}>
        {!arOverlay ? (
          <HapticPressable
            style={[styles.closeButton, styles.aiButton]}
            onPress={handleAnalyzeImageWithAI}
            disabled={isScanning}
          >
            <Text style={styles.buttonText}>
              {isScanning ? "Scanning..." : "Scan with AI"}
            </Text>
          </HapticPressable>
        ) : null}

        <HapticPressable
          style={styles.closeButton}
          onPress={() => {
            setArLabels([]);
            router.back();
          }}
        >
          <Text style={styles.buttonText}>Close</Text>
        </HapticPressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  camera: { flex: 1 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  text: { marginBottom: 12 },
  button: {
    padding: 12,
    backgroundColor: "#2563EB",
    borderRadius: 10,
  },
  buttonText: { color: "#fff" },
  footer: {
    position: "absolute",
    bottom: 30,
    width: "100%",
    alignItems: "center",
  },
  closeButton: {
    paddingHorizontal: 20,
    paddingVertical: 9,
    backgroundColor: "#111",
    borderRadius: 12,
  },
  aiButton: {
    marginBottom: 12,
    backgroundColor: "#2563EB",
  },
  arCalloutChip: {
    position: "absolute",
    width: 138,
    zIndex: 50,
    backgroundColor: "rgba(37, 99, 235, 0.92)",
    borderRadius: 11,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
  },
  arCalloutChipSelected: {
    backgroundColor: "rgba(37, 99, 235, 1)",
    borderColor: "rgba(255,255,255,0.65)",
  },
  arCalloutName: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "900",
  },
  arCalloutMeta: {
    color: "rgba(255,255,255,0.88)",
    fontSize: 10,
    marginTop: 2,
  },
  nearbyLabelsPanel: {
    position: "absolute",
    top: 92,
    left: 16,
    right: 16,
    zIndex: 18,
    backgroundColor: "rgba(15, 23, 42, 0.84)",
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  nearbyLabelsTitle: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    marginBottom: 8,
    letterSpacing: 0.6,
  },
  nearbyLabelsHint: {
    color: "rgba(255,255,255,0.58)",
    fontSize: 12,
    marginTop: -4,
    marginBottom: 8,
  },
  nearbyLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 10,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: "rgba(37, 99, 235, 0.95)",
  },
  nearbyLabelRowSelected: {
    backgroundColor: "rgba(37, 99, 235, 0.22)",
  },
  nearbyLabelTextBox: {
    flex: 1,
    paddingRight: 10,
  },
  nearbyLabelName: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "900",
  },
  nearbyLabelMeta: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 12,
    marginTop: 2,
  },
  nearbyStatusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginRight: 8,
  },
  nearbyStatusGood: {
    backgroundColor: "rgba(34, 197, 94, 0.20)",
  },
  nearbyStatusWarn: {
    backgroundColor: "rgba(245, 158, 11, 0.22)",
  },
  nearbyStatusText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800",
  },
  nearbyLabelChevron: {
    color: "#fff",
    fontSize: 28,
    lineHeight: 28,
    opacity: 0.85,
  },
  arCard: {
    position: "absolute",
    top: 315,
    right: 16,
    width: 285,
    zIndex: 20,
    backgroundColor: "rgba(15, 23, 42, 0.88)",
    borderRadius: 18,
    padding: 11,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  arCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  arCardTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
    flex: 1,
    paddingRight: 10,
  },
  arCloseButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  arCloseText: {
    color: "#fff",
    fontSize: 24,
    lineHeight: 26,
  },
  arCardSubtitle: {
    color: "rgba(255,255,255,0.72)",
    marginTop: 4,
    marginBottom: 8,
    fontSize: 13,
  },
  arStatsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  arStatBox: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderRadius: 12,
    paddingVertical: 7,
    alignItems: "center",
  },
  arStatNumber: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "900",
  },
  arStatLabel: {
    color: "rgba(255,255,255,0.68)",
    fontSize: 12,
    marginTop: 2,
  },
  arTopItemsBox: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: 8,
    marginBottom: 6,
  },
  arTopItemsTitle: {
    color: "rgba(255,255,255,0.68)",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 4,
  },
  arTopItemsText: {
    color: "#fff",
    lineHeight: 18,
  },
  arMetricRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 8,
  },
  arMetricLabel: {
    color: "rgba(255,255,255,0.62)",
    fontSize: 13,
  },
  arMetricValue: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
    flex: 1,
    textAlign: "right",
  },
  arDescription: {
    color: "rgba(255,255,255,0.84)",
    marginTop: 12,
    lineHeight: 19,
  },
  arPrimaryButton: {
    marginTop: 10,
    backgroundColor: "#2563EB",
    borderRadius: 12,
    paddingVertical: 9,
    alignItems: "center",
  },
  arPrimaryButtonText: {
    color: "#fff",
    fontWeight: "800",
  },
});