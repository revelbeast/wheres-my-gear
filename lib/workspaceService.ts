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

export function workspaceDoc(id: string) {
  return doc(
    db,
    WORKSPACE_COLLECTIONS.workspaces,
    id
  );
}

export function workspaceMembersCol(id: string) {
  return collection(
    db,
    WORKSPACE_COLLECTIONS.workspaces,
    id,
    WORKSPACE_COLLECTIONS.members
  );
}

export function workspaceSettingsDoc(id: string) {
  return doc(
    db,
    WORKSPACE_COLLECTIONS.workspaces,
    id,
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
  id: string
): ActiveWorkspace {
  return {
    id,
    type: "personal",
    role: "owner",
  };
}

export function getWorkspaceFeatureFlags(): WorkspaceFeatureFlags {
  return {
    workspaceEnabled: true,
    businessWorkspaceCreationEnabled: true,
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
    !activeWorkspace?.id ||
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
  const personalWorkspaceRef = doc(
    db,
    "users",
    userId,
    WORKSPACE_COLLECTIONS.workspaces,
    personalWorkspace.id
  );
  const existingWorkspace = await getDoc(personalWorkspaceRef);

  if (!existingWorkspace.exists()) {
    await setDoc(personalWorkspaceRef, {
      ...personalWorkspace,
      role: "owner",
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
  id: string
): ActiveWorkspace {
  return {
    id,
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
    id: businessWorkspace.id,
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
  const id = createBusinessWorkspaceId(userId);
  const workspaceSnapshot = await getDoc(workspaceDoc(id));

  if (!workspaceSnapshot.exists()) {
    return null;
  }

  const activeWorkspace = createBusinessActiveWorkspace(id);

  return saveActiveWorkspace(activeWorkspace);
}

export function getCurrentUserId() {
  return requireUserId();
}
