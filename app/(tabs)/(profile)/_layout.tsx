import React from "react";
import { Stack } from "expo-router";

export const unstable_settings = { initialRouteName: "profile" };

export default function ProfileNestedLayout() {
  return <Stack initialRouteName="profile" screenOptions={{ headerShown: false }} />;
}
