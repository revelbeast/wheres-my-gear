import React from "react";
import { ActivityIndicator, Image, Modal, StyleSheet, View } from "react-native";

import { ThemedText } from "./Themed";

type SyncStepStatus = "done" | "loading" | "pending";

type SyncStep = {
  label: string;
  status: SyncStepStatus;
};

type GearSyncOverlayProps = {
  visible: boolean;
  steps?: SyncStep[];
};

function getStepIcon(status: SyncStepStatus) {
  if (status === "done") return "✓";
  if (status === "loading") return "⟳";
  return "•";
}

export default function GearSyncOverlay({
  visible,
  steps = [
    { label: "Storage Spaces", status: "loading" },
    { label: "Rooms", status: "pending" },
    { label: "Compartments", status: "pending" },
    { label: "Inventory Items", status: "pending" },
  ],
}: GearSyncOverlayProps) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Image
            source={require("../../assets/images/app-icon-googleplay.png")}
            style={styles.logo}
            resizeMode="cover"
          />

          <ActivityIndicator size="large" color="#FFFFFF" style={styles.spinner} />

          <ThemedText variant="title" style={styles.title}>
            Syncing your gear...
          </ThemedText>

          <ThemedText style={styles.subtitle}>
            Loading your gear.
          </ThemedText>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    paddingHorizontal: 20,
    backgroundColor: "rgba(0,0,0,0.72)",
  },
  card: {
    width: "100%",
    maxWidth: 280,
    alignItems: "center",
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderRadius: 28,
    backgroundColor: "rgba(30,58,138,0.98)",
    borderColor: "rgba(147,197,253,0.42)",
  },
  logo: {
    width: 76,
    height: 76,
    marginBottom: 8,
    borderRadius: 18,
  },
  spinner: {
    marginBottom: 12,
  },
  title: {
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 4,
  },
  subtitle: {
    color: "rgba(255,255,255,0.78)",
    textAlign: "center",
    fontSize: 15,
    lineHeight: 20,
  },
});
