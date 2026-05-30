import React, { createContext, useContext, useEffect, useState } from "react";
import NetInfo from "@react-native-community/netinfo";
import { flushOfflineQueue } from "../../lib/offlineQueue";

type SyncContextValue = {
  isOnline: boolean;
  connectionChecked: boolean;
  isSyncing: boolean;
};

const SyncContext = createContext<SyncContextValue | undefined>(undefined);

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [connectionChecked, setConnectionChecked] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online =
        state.isConnected === true && state.isInternetReachable !== false;

      setIsOnline(online);
      setConnectionChecked(true);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!isOnline) return;

    const runSync = async () => {
      setIsSyncing(true);
      console.log("OFFLINE SYNC: starting flushOfflineQueue");

      try {
        await flushOfflineQueue();
        console.log("OFFLINE SYNC: flushOfflineQueue complete");
      } catch (error) {
        console.error("OFFLINE SYNC: flushOfflineQueue failed", error);
      }

      await new Promise((r) => setTimeout(r, 300));
      setIsSyncing(false);
    };

    runSync();
  }, [isOnline]);

  return (
    <SyncContext.Provider value={{
      isOnline,
      connectionChecked,
      isSyncing
    }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSyncStatus() {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error("useSyncStatus must be used within SyncProvider");
  return ctx;
}