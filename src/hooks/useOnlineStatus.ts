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

export const useOnlineStatus = (): OnlineStatus => {
  const [status, setStatus] = useState<OnlineStatus>(() => ({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isSlowConnection: false,
    connectionType: null,
    lastOnline: null,
    wasOffline: false,
  }));

  const updateConnectionInfo = useCallback(() => {
    // @ts-ignore - navigator.connection is not in all browsers
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

    if (connection) {
      const effectiveType = connection.effectiveType;
      const isSlowConnection = effectiveType === 'slow-2g' || effectiveType === '2g';

      setStatus(prev => ({
        ...prev,
        connectionType: effectiveType,
        isSlowConnection,
      }));
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setStatus(prev => ({
        ...prev,
        isOnline: true,
        lastOnline: new Date(),
        wasOffline: true, // Mark that we were offline
      }));
    };

    const handleOffline = () => {
      setStatus(prev => ({
        ...prev,
        isOnline: false,
        lastOnline: prev.isOnline ? new Date() : prev.lastOnline,
      }));
    };

    // Add event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Listen for connection changes
    // @ts-ignore
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (connection) {
      connection.addEventListener('change', updateConnectionInfo);
      updateConnectionInfo();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (connection) {
        connection.removeEventListener('change', updateConnectionInfo);
      }
    };
  }, [updateConnectionInfo]);

  return status;
};

export default useOnlineStatus;
