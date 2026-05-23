/**
 * PHASE 4 - PERMISSION ENGINE
 */

export type WorkspaceRole = "owner" | "manager" | "member";

/**
 * Can user manage workspace settings
 */
export function canManageWorkspace(role: WorkspaceRole) {
  return role === "owner" || role === "manager";
}

/**
 * Can user invite others
 */
export function canInviteUsers(role: WorkspaceRole) {
  return role === "owner" || role === "manager";
}

/**
 * Can user edit inventory
 */
export function canEditInventory(role: WorkspaceRole) {
  return role === "owner" || role === "manager";
}

/**
 * Full access check
 */
export function isOwner(role: WorkspaceRole) {
  return role === "owner";
}
