import React, { useEffect, useState } from "react";
import { Modal, View, Text, Pressable, ScrollView } from "react-native";

import { getUserWorkspaces } from "../../lib/workspace/getUserWorkspaces";
import { useActiveWorkspace } from "../../lib/workspace/useActiveWorkspace";

export default function WorkspaceSwitchModal({
  visible,
  onClose,
  userId = "current-user"
}: any) {
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const { activeWorkspace, setWorkspace } = useActiveWorkspace();

  useEffect(() => {
    if (visible) load();
  }, [visible]);

  async function load() {
    const data = await getUserWorkspaces(userId);
    setWorkspaces(data);
  }

  async function select(ws: any) {
    await setWorkspace(ws);
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={{
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.6)",
        justifyContent: "flex-end"
      }}>
        <View style={{
          backgroundColor: "#1c1c1e",
          padding: 16,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          maxHeight: "70%"
        }}>
          <Text style={{ color: "white", fontSize: 18 }}>
            Switch Workspace
          </Text>

          <ScrollView style={{ marginTop: 12 }}>
            {workspaces.map((ws) => (
              <Pressable
                key={ws.id}
                onPress={() => select(ws)}
                style={{
                  padding: 14,
                  borderRadius: 10,
                  marginBottom: 10,
                  backgroundColor:
                    activeWorkspace?.id === ws.id
                      ? "#2E7DFF"
                      : "rgba(255,255,255,0.08)"
                }}
              >
                <Text style={{ color: "white" }}>
                  {ws.name || ws.type}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <Pressable onPress={onClose}>
            <Text style={{ color: "#aaa", textAlign: "center", marginTop: 10 }}>
              Close
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
