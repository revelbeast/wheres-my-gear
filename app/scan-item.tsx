import { CameraView, useCameraPermissions } from "expo-camera";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import HapticPressable from "../components/ui/HapticPressable";

export default function ScanItemScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [mounted, setMounted] = useState(false);

  // scan lock (prevents duplicate scan triggers)
  const [isScanning, setIsScanning] = useState(false);

  // camera lifecycle control (STEP 7.3 FIX)
  const [cameraActive, setCameraActive] = useState(true);

  // session tracking
  const scanSessionRef = React.useRef({
    active: true,
    lastCode: null as string | null,
    timestamp: 0,
  });

  const scanHistoryRef = React.useRef<string[]>([]);

  // derived values (debug / UI)
  const lastScan =
    scanHistoryRef.current.length > 0
      ? scanHistoryRef.current[scanHistoryRef.current.length - 1]
      : null;

  const scanCount = scanHistoryRef.current.length;

  // 🧠 STEP 7.5 — Scan Intelligence Layer
  const getScanContext = (value: string) => {
    const isDuplicateInSession = scanHistoryRef.current.includes(value);

    return {
      barcode: value,
      scanNumber: scanHistoryRef.current.length + 1,
      isDuplicateInSession,
      timestamp: Date.now(),
    };
  };

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

  // CAMERA LIFECYCLE CONTROL
  useFocusEffect(
    useCallback(() => {
      setCameraActive(true);

      scanSessionRef.current.active = true;

      return () => {
        setCameraActive(false);
        scanSessionRef.current.active = false;

        // reset scan session state
        scanSessionRef.current.lastCode = null;
        scanSessionRef.current.timestamp = 0;
        scanHistoryRef.current = [];
      };
    }, [])
  );

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
      {/* SESSION DEBUG OVERLAY */}
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
        onBarcodeScanned={(event) => {
          const value = event?.data;

          if (!value) return;

          if (!scanSessionRef.current.active) return;

          // enhanced duplicate protection
          if (scanSessionRef.current.lastCode === value) {
            console.log("DUPLICATE BLOCKED (lastCode):", value);
            return;
          }

          if (scanHistoryRef.current.includes(value)) {
            console.log("DUPLICATE BLOCKED (history):", value);
            return;
          }

          const now = Date.now();
          if (now - scanSessionRef.current.timestamp < 300) return;

          scanSessionRef.current.lastCode = value;
          scanSessionRef.current.timestamp = now;

          // record scan safely
          scanHistoryRef.current.push(value);

          const context = getScanContext(value);

          setIsScanning(true);

          console.log("SCAN INTELLIGENCE:", context);

          router.replace({
            pathname: "/scan-result",
            params: { code: value },
          });

          console.log("SCAN SESSION HISTORY:", scanHistoryRef.current);

          setTimeout(() => {
            setIsScanning(false);
          }, 800);
        }}
      />

      <View style={styles.footer}>
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
  overlay: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  overlayText: { color: "#fff", marginTop: 10 },
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
});