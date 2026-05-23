import { useEffect, useState, useCallback } from "react";
import { getSavedActiveWorkspace } from "../workspaceService";

export function useActiveWorkspace() {
  const [activeWorkspace, setActiveWorkspace] = useState<any>(null);

  const load = useCallback(async () => {
    const ws = await getSavedActiveWorkspace();
    setActiveWorkspace(ws);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return {
    activeWorkspace,
    refreshWorkspace: load,
  };
}
