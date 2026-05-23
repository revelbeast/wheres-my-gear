import { collection, doc } from "firebase/firestore";
import { db } from "../firebaseConfig";
import { WORKSPACE_COLLECTIONS } from "./workspaceConstants";

export function legacyUserPath(userId: string) {
  return ["users", userId] as const;
}

export function workspacePath(workspaceId: string) {
  return [WORKSPACE_COLLECTIONS.workspaces, workspaceId] as const;
}

export function inventoryItemsCol(
  workspaceId: string,
  workspaceEnabled = false
) {
  return workspaceEnabled
    ? collection(db, ...workspacePath(workspaceId), WORKSPACE_COLLECTIONS.inventoryItems)
    : collection(db, ...legacyUserPath(workspaceId), WORKSPACE_COLLECTIONS.inventoryItems);
}

export function legacyItemsCol(
  workspaceId: string,
  workspaceEnabled = false
) {
  return workspaceEnabled
    ? collection(db, ...workspacePath(workspaceId), WORKSPACE_COLLECTIONS.items)
    : collection(db, ...legacyUserPath(workspaceId), WORKSPACE_COLLECTIONS.items);
}

export function storageSpacesCol(
  workspaceId: string,
  workspaceEnabled = false
) {
  return workspaceEnabled
    ? collection(db, ...workspacePath(workspaceId), WORKSPACE_COLLECTIONS.storageSpaces)
    : collection(db, ...legacyUserPath(workspaceId), WORKSPACE_COLLECTIONS.storageSpaces);
}

export function compartmentsCol(
  workspaceId: string,
  workspaceEnabled = false
) {
  return workspaceEnabled
    ? collection(db, ...workspacePath(workspaceId), WORKSPACE_COLLECTIONS.compartments)
    : collection(db, ...legacyUserPath(workspaceId), WORKSPACE_COLLECTIONS.compartments);
}

export function checklistsCol(
  workspaceId: string,
  workspaceEnabled = false
) {
  return workspaceEnabled
    ? collection(db, ...workspacePath(workspaceId), WORKSPACE_COLLECTIONS.checklists)
    : collection(db, ...legacyUserPath(workspaceId), WORKSPACE_COLLECTIONS.checklists);
}

export function checklistTemplatesCol(
  workspaceId: string,
  workspaceEnabled = false
) {
  return workspaceEnabled
    ? collection(db, ...workspacePath(workspaceId), WORKSPACE_COLLECTIONS.checklistTemplates)
    : collection(db, ...legacyUserPath(workspaceId), WORKSPACE_COLLECTIONS.checklistTemplates);
}

export function tripsCol(
  workspaceId: string,
  workspaceEnabled = false
) {
  return workspaceEnabled
    ? collection(db, ...workspacePath(workspaceId), WORKSPACE_COLLECTIONS.trips)
    : collection(db, ...legacyUserPath(workspaceId), WORKSPACE_COLLECTIONS.trips);
}

export function checklistItemsCol(
  workspaceId: string,
  checklistId: string,
  workspaceEnabled = false
) {
  return workspaceEnabled
    ? collection(db, ...workspacePath(workspaceId), WORKSPACE_COLLECTIONS.checklists, checklistId, "items")
    : collection(db, ...legacyUserPath(workspaceId), WORKSPACE_COLLECTIONS.checklists, checklistId, "items");
}

export function checklistTemplateItemsCol(
  workspaceId: string,
  templateId: string,
  workspaceEnabled = false
) {
  return workspaceEnabled
    ? collection(db, ...workspacePath(workspaceId), WORKSPACE_COLLECTIONS.checklistTemplates, templateId, "items")
    : collection(db, ...legacyUserPath(workspaceId), WORKSPACE_COLLECTIONS.checklistTemplates, templateId, "items");
}

export function workspaceSettingsDoc(
  workspaceId: string,
  settingsDocId: string,
  workspaceEnabled = false
) {
  return workspaceEnabled
    ? doc(db, ...workspacePath(workspaceId), WORKSPACE_COLLECTIONS.settings, settingsDocId)
    : doc(db, ...legacyUserPath(workspaceId), WORKSPACE_COLLECTIONS.settings, settingsDocId);
}

export function workspaceDoc(workspaceId: string) {
  return doc(db, WORKSPACE_COLLECTIONS.workspaces, workspaceId);
}
