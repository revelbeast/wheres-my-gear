import NetInfo from "@react-native-community/netinfo";
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type SyncContextValue = {
  isOnline: boolean;
  connectionChecked: boolean;
};

const SyncContext = createContext<SyncContextValue>({
  isOnline: true,
  connectionChecked: false,
});

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [connectionChecked, setConnectionChecked] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online =
        state.isConnected === true && state.isInternetReachable !== false;

      setIsOnline(online);
      setConnectionChecked(true);
    });

    return unsubscribe;
  }, []);

  const value = useMemo(
    () => ({
      isOnline,
      connectionChecked,
    }),
    [isOnline, connectionChecked]
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSyncStatus() {
  return useContext(SyncContext);
}
