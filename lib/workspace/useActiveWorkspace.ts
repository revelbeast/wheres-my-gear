import { useEffect, useState } from "react";
import { getSavedActiveWorkspace } from "../workspaceService";

export function useActiveWorkspace() {
  const [activeWorkspace, setActiveWorkspace] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const ws = await getSavedActiveWorkspace();
      setActiveWorkspace(ws);
    })();
  }, []);

  return activeWorkspace;
}
