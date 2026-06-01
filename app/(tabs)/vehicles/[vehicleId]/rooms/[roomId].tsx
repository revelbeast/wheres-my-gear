import React from "react";
import { Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";

export default function RoomDetailScreen() {
  const { roomId, vehicleId } = useLocalSearchParams();

  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Text>Room Detail Screen</Text>
      <Text>{String(roomId ?? "")}</Text>
      <Text>{String(vehicleId ?? "")}</Text>
    </View>
  );
}
