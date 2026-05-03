import React, { useEffect, useRef } from "react";
import { Stack } from "expo-router";

import { AuthProvider, useAuth } from "../components/auth/AuthProvider";
import { initRevenueCat } from "../lib/revenuecat";

function RootLayoutInner() {
  const { user, initializing } = useAuth();

  const revenueCatInitialized = useRef(false);

  useEffect(() => {
    if (initializing) return;
    if (!user?.uid) return;

    if (revenueCatInitialized.current) return;

    revenueCatInitialized.current = true;

    initRevenueCat(user.uid);
  }, [user?.uid, initializing]);

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutInner />
    </AuthProvider>
  );
}