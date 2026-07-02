// src/hooks/useOnlineStatus.ts
// Hook for detecting online/offline status with graceful handling
import { useState, useEffect, useCallback } from 'react';

export interface OnlineStatus {
  isOnline: boolean;
  isSlowConnection: boolean;
  connectionType: string | null;
  lastOnline: Date | null;
  wasOffline: boolean;
}

// The Network Information API is non-standard and not in the DOM lib types,
// so read it through a narrow typed accessor instead of a @ts-expect-error
// (which is brittle: line-wrapping moves it off the line it suppresses).
interface NetworkInformation {
  effectiveType?: string;
  addEventListener?: (type: 'change', listener: () => void) => void;
  removeEventListener?: (type: 'change', listener: () => void) => void;
}

function getNetworkConnection(): NetworkInformation | undefined {
  if (typeof navigator === 'undefined') return undefined;
  const nav = navigator as Navigator & {
    connection?: NetworkInformation;
    mozConnection?: NetworkInformation;
    webkitConnection?: NetworkInformation;
  };
  return nav.connection || nav.mozConnection || nav.webkitConnection;
}

export const useOnlineStatus = (): OnlineStatus => {
  const [status, setStatus] = useState<OnlineStatus>(() => ({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isSlowConnection: false,
    connectionType: null,
    lastOnline: null,
    wasOffline: false,
  }));

  const updateConnectionInfo = useCallback(() => {
    const connection = getNetworkConnection();

    if (connection) {
      const effectiveType = connection.effectiveType;
      const isSlowConnection = effectiveType === 'slow-2g' || effectiveType === '2g';

      setStatus((prev) => ({
        ...prev,
        connectionType: effectiveType ?? null,
        isSlowConnection,
      }));
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setStatus((prev) => ({
        ...prev,
        isOnline: true,
        lastOnline: new Date(),
        wasOffline: true, // Mark that we were offline
      }));
    };

    const handleOffline = () => {
      setStatus((prev) => ({
        ...prev,
        isOnline: false,
        lastOnline: prev.isOnline ? new Date() : prev.lastOnline,
      }));
    };

    // Add event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Listen for connection changes
    const connection = getNetworkConnection();
    if (connection) {
      connection.addEventListener?.('change', updateConnectionInfo);
      updateConnectionInfo();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (connection) {
        connection.removeEventListener?.('change', updateConnectionInfo);
      }
    };
  }, [updateConnectionInfo]);

  return status;
};

export default useOnlineStatus;
