import { BlurView } from "expo-blur";
import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import HapticPressable from "../ui/HapticPressable";
import { ThemedText, useThemedValues } from "../ui/Themed";
import { useActiveWorkspace } from "../../lib/workspace/useActiveWorkspace";
import WorkspaceSwitchModal from "./WorkspaceSwitchModal";

export default function WorkspaceSwitchCard() {
  const theme = useThemedValues();
  const { activeWorkspace } = useActiveWorkspace();
  const [open, setOpen] = useState(false);

  const workspaceType = activeWorkspace?.type
    ? activeWorkspace.type.toUpperCase()
    : "NONE";

  const workspaceRole = activeWorkspace?.role ?? "member";

  return (
    <>
      <BlurView
        intensity={theme.isLight ? 18 : 35}
        tint={theme.isLight ? "light" : "dark"}
        style={[
          styles.card,
          {
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.card,
          },
        ]}
      >
        <ThemedText color="secondary" style={styles.eyebrow}>
          CURRENT WORKSPACE
        </ThemedText>

        <ThemedText variant="bodyStrong" style={styles.workspaceTitle}>
          {workspaceType}
        </ThemedText>

        <ThemedText color="secondary" style={styles.roleText}>
          Role: {workspaceRole}
        </ThemedText>

        <HapticPressable
          onPress={() => setOpen(true)}
          style={[
            styles.button,
            {
              backgroundColor: theme.isLight ? "#2563EB" : "#2E7DFF",
            },
          ]}
        >
          <ThemedText style={styles.buttonText}>
            Switch Workspaces
          </ThemedText>
        </HapticPressable>
      </BlurView>

      <WorkspaceSwitchModal
        visible={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 4,
    marginBottom: 4,
    padding: 6,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  workspaceTitle: {
    marginTop: 0,
  },
  roleText: {
    marginTop: 0,
  },
  button: {
    marginTop: 6,
    paddingVertical: 6,
    borderRadius: 10,
    alignItems: "center",
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
});
