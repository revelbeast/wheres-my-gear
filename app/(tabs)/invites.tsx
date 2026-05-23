import React, { useEffect, useState } from "react";
import { Alert, ScrollView, View, Text, Pressable } from "react-native";

import AppHeader from "../../components/ui/AppHeader";
import ScreenBackground from "../../components/ui/ScreenBackground";
import { getInvites } from "../../lib/workspace/members/inviteService";
import { acceptInvite } from "../../lib/workspace/members/acceptInviteService";
import { useActiveWorkspace } from "../../lib/workspace/useActiveWorkspace";

export default function InvitesScreen() {
  const [invites, setInvites] = useState<any[]>([]);
  const activeWorkspace = useActiveWorkspace();

  useEffect(() => {
    loadInvites();
  }, []);

  async function loadInvites() {
    const data = await getInvites("demo-workspace");
    setInvites(data);
  }

  async function onAccept(invite: any) {
    try {
      await acceptInvite("demo-workspace", invite.id, "current-user");

      // IMPORTANT: this is the missing Phase 5 behavior
      Alert.alert(
        "Workspace Joined",
        "You are now part of this workspace. Switch to Dashboard to see updates."
      );

      await loadInvites();
    } catch (e) {
      Alert.alert("Error", "Failed to accept invite");
    }
  }

  return (
    <ScreenBackground>
      <AppHeader title="Invites" />

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {invites.length === 0 ? (
          <Text style={{ color: "#999" }}>No invites</Text>
        ) : (
          invites.map((invite) => (
            <View
              key={invite.id}
              style={{
                padding: 14,
                marginBottom: 10,
                borderRadius: 12,
                backgroundColor: "rgba(255,255,255,0.08)",
              }}
            >
              <Text style={{ color: "white", fontWeight: "600" }}>
                {invite.email}
              </Text>

              <Text style={{ color: "#aaa", marginBottom: 8 }}>
                Role: {invite.role}
              </Text>

              <Pressable
                onPress={() => onAccept(invite)}
                style={{
                  padding: 10,
                  backgroundColor: "#2E7DFF",
                  borderRadius: 8,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: "white" }}>Accept Invite</Text>
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>
    </ScreenBackground>
  );
}
