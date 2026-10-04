import { useEffect, useState } from "react";
import { isScannerTestMode } from "../utils/scannerTestMode";
import { networkStatusManager } from "../utils/networkStatus";

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(networkStatusManager.isOnline());

  useEffect(() => {
    if (isScannerTestMode) {
      setIsOnline(true);
      return;
    }
    const unsubscribe = networkStatusManager.subscribe(setIsOnline);
    return unsubscribe;
  }, []);

  return {
    isOnline,
    isScannerTestMode,
  };
}
