export type WorkspaceType = "personal" | "business";

export type WorkspaceRole = "owner" | "manager" | "member";

export type WorkspaceStatus = "active" | "archived";

export type Workspace = {
  id: string;
  name: string;
  type: WorkspaceType;
  ownerUserId: string;
  status: WorkspaceStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type WorkspaceMember = {
  id: string;
  userId: string;
  email?: string | null;
  displayName?: string | null;
  role: WorkspaceRole;
  joinedAt?: unknown;
  updatedAt?: unknown;
};

export type ActiveWorkspace = {
  id: string;
  type: WorkspaceType;
  role: WorkspaceRole;
};

export type WorkspaceFeatureFlags = {
  workspaceEnabled: boolean;
  businessWorkspaceCreationEnabled: boolean;
  teamMembersEnabled: boolean;
  businessSubscriptionEnabled: boolean;
};

export const DEFAULT_WORKSPACE_FEATURE_FLAGS: WorkspaceFeatureFlags = {
  workspaceEnabled: false,
  businessWorkspaceCreationEnabled: false,
  teamMembersEnabled: false,
  businessSubscriptionEnabled: false,
};
