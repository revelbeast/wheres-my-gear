import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "active_workspace_id";

/**
 * Save active workspace ID locally
 */
export async function saveActiveWorkspaceId(workspaceId: string) {
  await AsyncStorage.setItem(KEY, workspaceId);
}

/**
 * Get active workspace ID
 */
export async function getActiveWorkspaceId() {
  return await AsyncStorage.getItem(KEY);
}
