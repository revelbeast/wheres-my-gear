import { auth, db } from "../firebaseConfig";
import { collection, doc } from "firebase/firestore";
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

export function getCurrentUserId() {
  return requireUserId();
}
