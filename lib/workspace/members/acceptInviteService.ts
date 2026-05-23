import { db } from "../../firebase";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp
} from "firebase/firestore";

/**
 * Accept workspace invite and join workspace
 */
export async function acceptInvite(
  workspaceId: string,
  inviteId: string,
  userId: string
) {
  const inviteRef = doc(db, "workspaces", workspaceId, "invites", inviteId);
  const inviteSnap = await getDoc(inviteRef);

  if (!inviteSnap.exists()) {
    throw new Error("Invite not found");
  }

  const invite = inviteSnap.data();

  if (invite.status !== "pending") {
    throw new Error("Invite already used or expired");
  }

  // Create member record
  const memberRef = doc(db, "workspaces", workspaceId, "members", userId);

  await setDoc(memberRef, {
    userId,
    workspaceId,
    role: invite.role,
    status: "active",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  // Mark invite as accepted
  await updateDoc(inviteRef, {
    status: "accepted",
    acceptedAt: serverTimestamp()
  });

  return true;
}
