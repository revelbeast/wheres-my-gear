import { router, usePathname } from "expo-router";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Boxes,
  ClipboardList,
  LayoutDashboard,
  UserCircle2,
} from "lucide-react-native";

import HapticPressable from "../ui/HapticPressable";
import { useThemedValues } from "../ui/Themed";

type TabItem = {
  label: string;
  route: string;
  activeMatch: string[];
};

export default function BottomTabBar() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const theme = useThemedValues();

  const tabs: TabItem[] = [
    {
      label: "Dashboard",
      route: "/(tabs)",
      activeMatch: ["/", "/index"],
    },
    {
      label: "Inventory",
      route: "/(tabs)/inventory",
      activeMatch: ["/inventory", "/storage", "/vehicles"],
    },
    {
      label: "Checklists",
      route: "/(tabs)/checklists",
      activeMatch: ["/checklists"],
    },
    {
      label: "Profile",
      route: "/(tabs)/profile",
      activeMatch: ["/profile"],
    },
  ];

  function isActive(tab: TabItem) {
    if (tab.label === "Dashboard") {
      return pathname === "/" || pathname === "/index" || pathname === "/(tabs)";
    }

    return tab.activeMatch.some((match) => pathname.startsWith(match));
  }

  function renderIcon(label: string, active: boolean) {
    const color = active ? theme.colors.primary : theme.colors.textSecondary;
    const size = 26;

    if (label === "Dashboard") {
      return <LayoutDashboard size={size} color={color} />;
    }

    if (label === "Inventory") {
      return <Boxes size={size} color={color} />;
    }

    if (label === "Checklists") {
      return <ClipboardList size={size} color={color} />;
    }

    return <UserCircle2 size={size} color={color} />;
  }

  return (
    <View
      style={[
        styles.wrap,
        {
          paddingBottom: insets.bottom,
          height: 66 + insets.bottom,
          backgroundColor: theme.isLight
            ? "rgba(255,255,255,0.95)"
            : "rgba(7, 20, 44, 0.98)",
          borderTopColor: theme.colors.border,
        },
      ]}
    >
      {tabs.map((tab) => {
        const active = isActive(tab);

        return (
          <HapticPressable
            key={tab.label}
            style={styles.tabButton}
            onPress={() => router.replace(tab.route as any)}
          >
            {renderIcon(tab.label, active)}
            <Text
              style={[
                styles.tabLabel,
                {
                  color: active
                    ? theme.colors.primary
                    : theme.colors.textSecondary,
                  fontSize: theme.fontSizes.small,
                },
              ]}
            >
              {tab.label}
            </Text>
          </HapticPressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 8,
    borderTopWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },

  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },

  tabLabel: {
    fontWeight: "600",
  },
});