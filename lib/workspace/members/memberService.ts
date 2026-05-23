import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  setDoc
} from "firebase/firestore";
import { db } from "../../firebase";

/**
 * Workspace members collection reference
 */
export function membersCollection(workspaceId: string) {
  return collection(db, "workspaces", workspaceId, "members");
}

/**
 * Add member to workspace
 */
export async function addMember(
  workspaceId: string,
  userId: string,
  role: "owner" | "manager" | "member"
) {
  const ref = doc(db, "workspaces", workspaceId, "members", userId);

  await setDoc(ref, {
    userId,
    workspaceId,
    role,
    status: "active",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  return true;
}

/**
 * Fetch workspace members
 */
export async function getMembers(workspaceId: string) {
  const snapshot = await getDocs(membersCollection(workspaceId));
  return snapshot.docs.map(d => d.data());
}
