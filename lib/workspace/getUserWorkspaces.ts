import { db } from "../firebase";
import { collection, getDocs } from "firebase/firestore";

/**
 * Get all workspaces for a user
 */
export async function getUserWorkspaces(userId: string) {
  const ref = collection(db, "users", userId, "workspaces");
  const snapshot = await getDocs(ref);

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data()
  }));
}
