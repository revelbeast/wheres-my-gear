import React from "react";
import { Tabs } from "expo-router";
import {
  LayoutDashboard,
  Boxes,
  ClipboardList,
  UserCircle2,
} from "lucide-react-native";

import { useTheme } from "../../lib/useTheme";

export default function TabsLayout() {
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,

        tabBarStyle: {
          backgroundColor: theme.isLight
            ? "rgba(255,255,255,0.95)"
            : "rgba(7, 20, 44, 0.98)",

          borderTopColor: theme.colors.border,

          height: 88,
          paddingTop: 8,
          paddingBottom: 22,
        },

        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSecondary,

        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, size }) => (
            <LayoutDashboard color={color} size={size ?? 20} />
          ),
        }}
      />

      <Tabs.Screen
        name="inventory"
        options={{
          title: "Inventory",
          tabBarIcon: ({ color, size }) => (
            <Boxes color={color} size={size ?? 20} />
          ),
        }}
      />

      <Tabs.Screen
        name="checklists"
        options={{
          title: "Checklists",
          tabBarIcon: ({ color, size }) => (
            <ClipboardList color={color} size={size ?? 20} />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <UserCircle2 color={color} size={size ?? 20} />
          ),
        }}
      />

      <Tabs.Screen
        name="vehicles"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="notes"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="trips"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="explore"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}