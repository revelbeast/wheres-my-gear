import { useEffect, useState, useCallback } from "react";
import { getSavedActiveWorkspace, saveActiveWorkspace } from "../workspaceService";
import { saveActiveWorkspaceId, getActiveWorkspaceId } from "./workspaceStorage";
import { ActiveWorkspace } from "../../types/workspaces";

export function useActiveWorkspace() {
  const [activeWorkspace, setActiveWorkspace] = useState<ActiveWorkspace | null>(null);

  const load = useCallback(async () => {
    const savedId = await getActiveWorkspaceId();
    const ws = await getSavedActiveWorkspace();

    if (ws && savedId && ws.id !== savedId) {
      // future reconciliation logic
    }

    setActiveWorkspace(ws);
  }, []);

  const setWorkspace = useCallback(async (workspace: ActiveWorkspace) => {
    setActiveWorkspace(workspace);

    if (workspace?.id) {
      await saveActiveWorkspaceId(workspace.id);
      await saveActiveWorkspace(workspace);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return {
    activeWorkspace,
    setWorkspace,
    refreshWorkspace: load
  };
}
