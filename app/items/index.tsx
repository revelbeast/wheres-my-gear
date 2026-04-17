import React, { useEffect, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";

import ScreenBackground from "../../components/ui/ScreenBackground";
import AppHeader from "../../components/ui/AppHeader";
import { colors } from "../../theme/tokens";
import { getItemsByStatus } from "../../lib/gearService";

export default function ItemsScreen() {
  const { status } = useLocalSearchParams<{ status: string }>();
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    loadItems();
  }, []);

  async function loadItems() {
    const data = await getItemsByStatus(status);
    setItems(data);
  }

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content}>
          <AppHeader
            title={status === "packed" ? "Packed Items" : "Missing Items"}
            showBackButton
          />

          {items.map((item) => (
            <View key={item.id} style={styles.card}>
              <Text style={styles.cardTitle}>{item.name}</Text>
              <Text style={styles.cardMeta}>{item.compartmentName}</Text>
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 16 },
  card: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 10,
    backgroundColor: "rgba(12,24,50,0.9)",
  },
  cardTitle: {
    color: colors.text,
    fontWeight: "600",
    marginBottom: 4,
  },
  cardMeta: {
    color: colors.textSecondary,
    fontSize: 13,
  },
});