import React from "react";
import { Image, Modal, StyleSheet, View } from "react-native";

import { ThemedCard, ThemedText } from "./Themed";

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
        <ThemedCard style={styles.card}>
          <Image
            source={require("../../assets/images/logo.png")}
            style={styles.logo}
            resizeMode="contain"
          />

          <ThemedText variant="title" style={styles.title}>
            Syncing your gear...
          </ThemedText>

          <ThemedText color="secondary" style={styles.subtitle}>
            Loading your inventory...
          </ThemedText>

          <ThemedText color="secondary" style={styles.waitText}>
            Please wait.
          </ThemedText>
        </ThemedCard>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  card: {
    width: "100%",
    maxWidth: 360,
    alignItems: "center",
    padding: 24,
  },
  logo: {
    width: 92,
    height: 92,
    marginBottom: 18,
    borderRadius: 22,
  },
  title: {
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    textAlign: "center",
    marginBottom: 18,
  },
  waitText: {
    textAlign: "center",
    marginTop: 16,
  },
});
