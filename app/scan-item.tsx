import {
  CameraView,
  useCameraPermissions,
} from "expo-camera";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Alert } from "react-native";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../components/auth/AuthProvider";
import { isPremiumPlusUser } from "../lib/revenuecat";
import HapticPressable from "../components/ui/HapticPressable";
import { resolveBarcode } from "../lib/barcodeResolver";
import { getRoomById } from "../lib/gearService";

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

      router.replace({
        pathname: "/scan-result",
        params: {
          code: "AI_IMAGE_SCAN",
          found: String(!!result?.found),
          suggestedName: result?.title ?? "",
          source: "AWS Rekognition",
          brand: result?.brand ?? "",
          image: photo.uri ?? "",
          description: result?.description ?? "",
          matchConfidence:
            result?.confidence != null ? String(result.confidence) : "",
          matchStatus: result?.found ? "possible" : "unknown",
        },
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
      {/* DEBUG OVERLAY */}
      <View
        style={{
          position: "absolute",
          top: 60,
          left: 20,
          right: 20,
          zIndex: 10,
          backgroundColor: "rgba(0,0,0,0.6)",
          padding: 12,
          borderRadius: 12,
        }}
      >
        <Text style={{ color: "#fff", fontWeight: "600" }}>
          Session Active
        </Text>

        <Text style={{ color: "#fff", marginTop: 4 }}>
          Scans: {scanCount}
        </Text>

        <Text style={{ color: "#fff", marginTop: 4 }}>
          Last: {lastScan ?? "None"}
        </Text>
      </View>

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

          if (!value) return;

          // HARD GUARD
          if (!cameraActive) return;
          if (!scanSessionRef.current.active) return;

          // HARD LOCK
          scanSessionRef.current.active = false;
          setCameraActive(false);
          setIsScanning(true);

          // duplicate protection
          if (
            scanSessionRef.current.lastCode === value ||
            scanHistoryRef.current.includes(value)
          ) {
            console.log("DUPLICATE BLOCKED:", value);
            return;
          }

          const now = Date.now();
          if (now - scanSessionRef.current.timestamp < 300) return;

          scanSessionRef.current.lastCode = value;
          scanSessionRef.current.timestamp = now;
          scanHistoryRef.current.push(value);

          const compartmentQrPrefix = "wheresmygear://compartment/";
          const roomQrPrefix = "wheresmygear://room/";

          if (String(value).startsWith(roomQrPrefix)) {
            const scannedRoomId = String(value).replace(roomQrPrefix, "").trim();

            if (scannedRoomId) {
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
            const scannedCompartmentId = String(value)
              .replace(compartmentQrPrefix, "")
              .trim();

            if (scannedCompartmentId) {
              router.replace({
                pathname: "/vehicles/[vehicleId]/compartments/[compartmentId]",
                params: {
                  vehicleId: "unknown",
                  compartmentId: scannedCompartmentId,
                },
              });
              return;
            }
          }

          // 🧠 SINGLE SOURCE OF TRUTH (NEW)
          const result = await resolveBarcode(value);

          console.log("SCAN RESULT:", result);

          // route
          router.replace({
            pathname: "/scan-result",
            params: {
              code: result.barcode,
              found: String(result.found),
              suggestedName: result.bestName ?? "",
              source: result.sources.upcitemdb ? "UPCitemDB" : result.sources.openFoodFacts ? "OpenFoodFacts" : "Unknown",
              brand: result.sources.upcitemdb?.brand ?? "",
              image: result.sources.upcitemdb?.image ?? "",
              description: result.sources.upcitemdb?.description ?? "",
              matchConfidence: result.sources.upcitemdb?.confidence != null ? String(result.sources.upcitemdb.confidence) : "",
              matchStatus: result.found ? "found" : "unknown",
            },
          });

          setTimeout(() => {
            setIsScanning(false);
          }, 800);
        }}
      />

      <View style={styles.footer}>
        <HapticPressable
          style={[styles.closeButton, styles.aiButton]}
          onPress={handleAnalyzeImageWithAI}
          disabled={isScanning}
        >
          <Text style={styles.buttonText}>
            {isScanning ? "Scanning..." : "Scan with AI"}
          </Text>
        </HapticPressable>

        <HapticPressable
          style={styles.closeButton}
          onPress={() => router.back()}
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
    paddingVertical: 10,
    backgroundColor: "#111",
    borderRadius: 12,
  },
  aiButton: {
    marginBottom: 12,
    backgroundColor: "#2563EB",
  },
});