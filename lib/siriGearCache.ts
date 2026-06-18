import * as FileSystem from "expo-file-system/legacy";

import type { Item } from "./gearService";

const SIRI_GEAR_CACHE_FILE_NAME = "wmg-siri-gear-cache.json";

export async function writeSiriGearCache(items: Item[]) {
  try {
    const documentDirectory = FileSystem.documentDirectory;

    if (!documentDirectory) {
      return;
    }

    const siriItems = items
      .filter((item) => item.name.trim().length > 0)
      .map((item) => ({
        id: item.id,
        name: item.name,
        compartmentName: item.compartmentName ?? "",
        vehicleName: item.vehicleName ?? "",
      }));

    await FileSystem.writeAsStringAsync(
      `${documentDirectory}${SIRI_GEAR_CACHE_FILE_NAME}`,
      JSON.stringify({ items: siriItems, updatedAt: new Date().toISOString() })
    );
  } catch (error) {
    console.error("Failed to write Siri gear cache:", error);
  }
}
