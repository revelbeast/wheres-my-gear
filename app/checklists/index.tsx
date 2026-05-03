import React from "react";
import { Redirect } from "expo-router";

/**
 * This screen is intentionally a redirect.
 * The actual Checklists UI lives in:
 * app/(tabs)/checklists.tsx
 *
 * Keeping this file prevents routing conflicts while avoiding duplicate UI.
 */
export default function ChecklistsIndexRedirect() {
  return <Redirect href="/(tabs)/checklists" />;
}