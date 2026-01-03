// src/components/OfflineBanner.tsx
// Offline detection banner with graceful UX
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, Wifi, AlertTriangle, RefreshCw } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

interface OfflineBannerProps {
  className?: string;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({ className = '' }) => {
  const { isOnline, isSlowConnection, wasOffline } = useOnlineStatus();
  const [showReconnected, setShowReconnected] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Show reconnected message briefly when coming back online
  useEffect(() => {
    if (isOnline && wasOffline) {
      setShowReconnected(true);
      setDismissed(false);
      const timer = setTimeout(() => {
        setShowReconnected(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  // Reset dismissed state when going offline
  useEffect(() => {
    if (!isOnline) {
      setDismissed(false);
    }
  }, [isOnline]);

  const showBanner = !isOnline || showReconnected || (isSlowConnection && !dismissed);

  if (!showBanner) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -100, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className={`fixed top-0 left-0 right-0 z-[100] ${className}`}
      >
        {!isOnline ? (
          // Offline Banner
          <div className="bg-red-500/95 backdrop-blur-sm border-b border-red-400/50">
            <div className="container-responsive py-2 px-4">
              <div className="flex items-center justify-center gap-3">
                <WifiOff className="w-4 h-4 text-white animate-pulse" />
                <span className="text-sm font-display font-semibold text-white">
                  You're offline
                </span>
                <span className="text-xs text-white/80 hidden sm:inline">
                  — Changes will sync when you reconnect
                </span>
                <button
                  onClick={() => window.location.reload()}
                  className="ml-2 flex items-center gap-1 px-2 py-1 text-xs bg-white/20 hover:bg-white/30 rounded transition-colors text-white"
                >
                  <RefreshCw className="w-3 h-3" />
                  Retry
                </button>
              </div>
            </div>
          </div>
        ) : showReconnected ? (
          // Reconnected Banner
          <div className="bg-green-500/95 backdrop-blur-sm border-b border-green-400/50">
            <div className="container-responsive py-2 px-4">
              <div className="flex items-center justify-center gap-3">
                <Wifi className="w-4 h-4 text-white" />
                <span className="text-sm font-display font-semibold text-white">
                  Back online
                </span>
                <span className="text-xs text-white/80 hidden sm:inline">
                  — Your data is syncing
                </span>
              </div>
            </div>
          </div>
        ) : isSlowConnection ? (
          // Slow Connection Banner
          <div className="bg-amber-500/95 backdrop-blur-sm border-b border-amber-400/50">
            <div className="container-responsive py-2 px-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-4 h-4 text-white" />
                  <span className="text-sm font-display font-semibold text-white">
                    Slow connection detected
                  </span>
                  <span className="text-xs text-white/80 hidden sm:inline">
                    — Some features may be delayed
                  </span>
                </div>
                <button
                  onClick={() => setDismissed(true)}
                  className="text-white/80 hover:text-white text-xs underline"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </motion.div>
    </AnimatePresence>
  );
};

// Compact inline version for use within components
export const OfflineIndicator: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { isOnline } = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 bg-red-500/20 border border-red-500/30 rounded-sm ${className}`}>
      <WifiOff className="w-3 h-3 text-red-400" />
      <span className="text-xs text-red-400 font-mono uppercase tracking-wide">Offline</span>
    </div>
  );
};

export default OfflineBanner;
