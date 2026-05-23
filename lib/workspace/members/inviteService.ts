import { db } from "../../firebase";
import {
  collection,
  doc,
  setDoc,
  getDocs,
  serverTimestamp
} from "firebase/firestore";

/**
 * Invites collection
 */
export function invitesCollection(workspaceId: string) {
  return collection(db, "workspaces", workspaceId, "invites");
}

/**
 * Create invite
 */
export async function createInvite(
  workspaceId: string,
  email: string,
  role: "manager" | "member",
  invitedBy: string
) {
  const ref = doc(invitesCollection(workspaceId));

  await setDoc(ref, {
    email,
    role,
    status: "pending",
    invitedBy,
    createdAt: serverTimestamp(),
    expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 7
  });

  return ref.id;
}

/**
 * Get invites
 */
export async function getInvites(workspaceId: string) {
  const snapshot = await getDocs(invitesCollection(workspaceId));
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}
