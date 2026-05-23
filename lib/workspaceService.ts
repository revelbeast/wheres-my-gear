import { auth, db } from "../firebaseConfig";
import { collection, doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import {
  PERSONAL_WORKSPACE_NAME,
  WORKSPACE_COLLECTIONS,
  WORKSPACE_SETTINGS_DOC_ID,
} from "./workspaceConstants";
import type {
  ActiveWorkspace,
  Workspace,
  WorkspaceFeatureFlags,
} from "../types/workspaces";

function requireUserId() {
  const userId = auth.currentUser?.uid;

  if (!userId) {
    throw new Error(
      "You are not signed in. Please close and reopen the app, then try again."
    );
  }

  return userId;
}

export function workspacesCol() {
  return collection(db, WORKSPACE_COLLECTIONS.workspaces);
}

export function workspaceDoc(workspaceId: string) {
  return doc(
    db,
    WORKSPACE_COLLECTIONS.workspaces,
    workspaceId
  );
}

export function workspaceMembersCol(workspaceId: string) {
  return collection(
    db,
    WORKSPACE_COLLECTIONS.workspaces,
    workspaceId,
    WORKSPACE_COLLECTIONS.members
  );
}

export function workspaceSettingsDoc(workspaceId: string) {
  return doc(
    db,
    WORKSPACE_COLLECTIONS.workspaces,
    workspaceId,
    WORKSPACE_COLLECTIONS.settings,
    WORKSPACE_SETTINGS_DOC_ID
  );
}

export function userWorkspaceSettingsDoc(userId: string) {
  return doc(
    db,
    "users",
    userId,
    WORKSPACE_COLLECTIONS.settings,
    WORKSPACE_SETTINGS_DOC_ID
  );
}

export function createDefaultPersonalWorkspace(
  userId: string
): Workspace {
  return {
    id: userId,
    name: PERSONAL_WORKSPACE_NAME,
    type: "personal",
    ownerUserId: userId,
    status: "active",
  };
}

export function createDefaultActiveWorkspace(
  workspaceId: string
): ActiveWorkspace {
  return {
    workspaceId,
    type: "personal",
    role: "owner",
  };
}

export function getWorkspaceFeatureFlags(): WorkspaceFeatureFlags {
  return {
    workspaceEnabled: false,
    businessWorkspaceCreationEnabled: false,
    teamMembersEnabled: false,
    businessSubscriptionEnabled: false,
  };
}

export async function saveActiveWorkspace(activeWorkspace: ActiveWorkspace) {
  const featureFlags = getWorkspaceFeatureFlags();

  if (!featureFlags.workspaceEnabled) {
    return null;
  }

  const userId = requireUserId();

  await setDoc(
    userWorkspaceSettingsDoc(userId),
    {
      activeWorkspace,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return activeWorkspace;
}

export async function getSavedActiveWorkspace() {
  const featureFlags = getWorkspaceFeatureFlags();

  if (!featureFlags.workspaceEnabled) {
    return null;
  }

  const userId = requireUserId();
  const settingsSnapshot = await getDoc(userWorkspaceSettingsDoc(userId));

  if (!settingsSnapshot.exists()) {
    return null;
  }

  const activeWorkspace = settingsSnapshot.data().activeWorkspace;

  if (
    !activeWorkspace?.workspaceId ||
    !activeWorkspace?.type ||
    !activeWorkspace?.role
  ) {
    return null;
  }

  return activeWorkspace as ActiveWorkspace;
}

export async function ensurePersonalWorkspace() {
  const featureFlags = getWorkspaceFeatureFlags();

  if (!featureFlags.workspaceEnabled) {
    return null;
  }

  const userId = requireUserId();
  const personalWorkspace = createDefaultPersonalWorkspace(userId);
  const personalWorkspaceRef = workspaceDoc(personalWorkspace.id);
  const existingWorkspace = await getDoc(personalWorkspaceRef);

  if (!existingWorkspace.exists()) {
    await setDoc(personalWorkspaceRef, {
      ...personalWorkspace,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  return createDefaultActiveWorkspace(personalWorkspace.id);
}

export function createBusinessWorkspaceId(userId: string) {
  return `${userId}_business`;
}

export function createDefaultBusinessWorkspace(
  userId: string,
  businessName: string
): Workspace {
  return {
    id: createBusinessWorkspaceId(userId),
    name: businessName.trim(),
    type: "business",
    ownerUserId: userId,
    status: "active",
  };
}

export function createBusinessActiveWorkspace(
  workspaceId: string
): ActiveWorkspace {
  return {
    workspaceId,
    type: "business",
    role: "owner",
  };
}

export async function createOwnerBusinessWorkspace(businessName: string) {
  const featureFlags = getWorkspaceFeatureFlags();

  if (
    !featureFlags.workspaceEnabled ||
    !featureFlags.businessWorkspaceCreationEnabled
  ) {
    return null;
  }

  const normalizedBusinessName = businessName.trim();

  if (!normalizedBusinessName) {
    throw new Error("Business workspace name is required.");
  }

  const userId = requireUserId();
  const businessWorkspace = createDefaultBusinessWorkspace(
    userId,
    normalizedBusinessName
  );
  const businessWorkspaceRef = workspaceDoc(businessWorkspace.id);
  const existingWorkspace = await getDoc(businessWorkspaceRef);

  if (existingWorkspace.exists()) {
    return createBusinessActiveWorkspace(businessWorkspace.id);
  }

  await setDoc(businessWorkspaceRef, {
    ...businessWorkspace,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await setDoc(doc(workspaceMembersCol(businessWorkspace.id), userId), {
    id: userId,
    userId,
    role: "owner",
    joinedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await setDoc(workspaceSettingsDoc(businessWorkspace.id), {
    workspaceId: businessWorkspace.id,
    type: "business",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return createBusinessActiveWorkspace(businessWorkspace.id);
}

export async function switchToPersonalWorkspace() {
  const featureFlags = getWorkspaceFeatureFlags();

  if (!featureFlags.workspaceEnabled) {
    return null;
  }

  const userId = requireUserId();
  const activeWorkspace = createDefaultActiveWorkspace(userId);

  return saveActiveWorkspace(activeWorkspace);
}

export async function switchToBusinessWorkspace() {
  const featureFlags = getWorkspaceFeatureFlags();

  if (!featureFlags.workspaceEnabled) {
    return null;
  }

  const userId = requireUserId();
  const workspaceId = createBusinessWorkspaceId(userId);
  const workspaceSnapshot = await getDoc(workspaceDoc(workspaceId));

  if (!workspaceSnapshot.exists()) {
    return null;
  }

  const activeWorkspace = createBusinessActiveWorkspace(workspaceId);

  return saveActiveWorkspace(activeWorkspace);
}

export function getCurrentUserId() {
  return requireUserId();
}
