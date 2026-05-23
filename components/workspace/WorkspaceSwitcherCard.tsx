import React from "react";
import { View, Text, Pressable } from "react-native";
import { useActiveWorkspace } from "../../lib/workspace/useActiveWorkspace";

export default function WorkspaceSwitcherCard() {
  const { activeWorkspace } = useActiveWorkspace();

  return (
    <View
      style={{
        padding: 16,
        borderRadius: 14,
        backgroundColor: "rgba(255,255,255,0.08)",
        marginBottom: 14,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
      }}
    >
      <Text style={{ color: "#aaa", fontSize: 12, letterSpacing: 1 }}>
        CURRENT WORKSPACE
      </Text>

      <Text
        style={{
          color: "white",
          fontSize: 18,
          fontWeight: "700",
          marginTop: 6,
        }}
      >
        {activeWorkspace?.type?.toUpperCase() || "NONE"}
      </Text>

      <View style={{ flexDirection: "row", marginTop: 6, gap: 8 }}>
        <View
          style={{
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 999,
            backgroundColor: "#2E7DFF",
          }}
        >
          <Text style={{ color: "white", fontSize: 12 }}>
            {activeWorkspace?.role || "member"}
          </Text>
        </View>

        <View
          style={{
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 999,
            backgroundColor: "rgba(255,255,255,0.1)",
          }}
        >
          <Text style={{ color: "#ccc", fontSize: 12 }}>
            ID: {activeWorkspace?.id?.slice?.(0, 6) || "—"}
          </Text>
        </View>
      </View>

      <Pressable
        style={{
          marginTop: 12,
          padding: 10,
          borderRadius: 10,
          backgroundColor: "rgba(255,255,255,0.12)",
          alignItems: "center",
        }}
      >
        <Text style={{ color: "white", fontWeight: "600" }}>
          Switch Workspace
        </Text>
      </Pressable>
    </View>
  );
}
