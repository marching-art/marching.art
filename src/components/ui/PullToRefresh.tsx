// =============================================================================
// PULL TO REFRESH COMPONENT
// =============================================================================
// Native-feel pull-to-refresh for mobile with haptic-like feedback
// Works with any scrollable container

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { RefreshCw } from 'lucide-react';
import { triggerHaptic } from '../../hooks/useHaptic';

// =============================================================================
// TYPES
// =============================================================================

export interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  disabled?: boolean;
  pullThreshold?: number;
  maxPull?: number;
  className?: string;
}

// =============================================================================
// PULL TO REFRESH COMPONENT
// =============================================================================

export const PullToRefresh: React.FC<PullToRefreshProps> = ({
  onRefresh,
  children,
  disabled = false,
  pullThreshold = 80,
  maxPull = 120,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [canRefresh, setCanRefresh] = useState(false);

  // Motion values for smooth animation
  const pullDistance = useMotionValue(0);
  const indicatorY = useTransform(pullDistance, [0, maxPull], [-60, 60]);
  const indicatorOpacity = useTransform(pullDistance, [0, pullThreshold / 2, pullThreshold], [0, 0.5, 1]);
  const indicatorScale = useTransform(pullDistance, [0, pullThreshold], [0.5, 1]);
  const indicatorRotation = useTransform(pullDistance, [0, maxPull], [0, 180]);

  // Touch tracking
  const touchStartY = useRef(0);
  const touchStartScrollTop = useRef(0);
  const isPulling = useRef(false);

  // Handle touch start
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (disabled || isRefreshing) return;

      const container = containerRef.current;
      if (!container) return;

      // Only start pull if at the top of scroll
      if (container.scrollTop <= 0) {
        touchStartY.current = e.touches[0].clientY;
        touchStartScrollTop.current = container.scrollTop;
        isPulling.current = true;
      }
    },
    [disabled, isRefreshing]
  );

  // Handle touch move
  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isPulling.current || disabled || isRefreshing) return;

      const container = containerRef.current;
      if (!container || container.scrollTop > 0) {
        isPulling.current = false;
        pullDistance.set(0);
        return;
      }

      const touchY = e.touches[0].clientY;
      const pull = Math.max(0, (touchY - touchStartY.current) * 0.5); // Resistance factor

      if (pull > 0) {
        e.preventDefault();
        const clampedPull = Math.min(pull, maxPull);
        pullDistance.set(clampedPull);
        const nowCanRefresh = clampedPull >= pullThreshold;
        // Haptic feedback when threshold is crossed
        if (nowCanRefresh && !canRefresh) {
          triggerHaptic('medium');
        }
        setCanRefresh(nowCanRefresh);
      }
    },
    [disabled, isRefreshing, maxPull, pullThreshold, pullDistance, canRefresh]
  );

  // Handle touch end
  const handleTouchEnd = useCallback(async () => {
    if (!isPulling.current) return;
    isPulling.current = false;

    const currentPull = pullDistance.get();

    if (canRefresh && !isRefreshing && !disabled) {
      // Trigger refresh with haptic feedback
      triggerHaptic('pull');
      setIsRefreshing(true);
      animate(pullDistance, pullThreshold, { duration: 0.2 });

      try {
        await onRefresh();
        // Success haptic is handled by the parent's refresh handler
      } finally {
        setIsRefreshing(false);
        setCanRefresh(false);
        animate(pullDistance, 0, { duration: 0.3 });
      }
    } else {
      // Spring back
      animate(pullDistance, 0, { type: 'spring', stiffness: 400, damping: 30 });
      setCanRefresh(false);
    }
  }, [canRefresh, isRefreshing, disabled, onRefresh, pullDistance, pullThreshold]);

  // Reset on unmount
  useEffect(() => {
    return () => {
      pullDistance.set(0);
    };
  }, [pullDistance]);

  return (
    <div className={`relative h-full ${className}`}>
      {/* Pull Indicator */}
      <motion.div
        className="absolute left-1/2 -translate-x-1/2 z-10 flex items-center justify-center"
        style={{
          y: indicatorY,
          opacity: indicatorOpacity,
          scale: indicatorScale,
        }}
      >
        <motion.div
          className={`
            w-10 h-10 rounded-sm flex items-center justify-center
            ${isRefreshing ? 'bg-[#0057B8]' : canRefresh ? 'bg-[#0057B8]' : 'bg-[#333]'}
            transition-colors duration-200
          `}
          animate={isRefreshing ? { rotate: 360 } : {}}
          transition={isRefreshing ? { duration: 1, repeat: Infinity, ease: 'linear' } : {}}
        >
          <motion.div style={{ rotate: isRefreshing ? 0 : indicatorRotation }}>
            <RefreshCw className="w-5 h-5 text-white" />
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Content Container */}
      <div
        ref={containerRef}
        className="h-full overflow-y-auto scroll-momentum"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <motion.div style={{ y: pullDistance }}>
          {children}
        </motion.div>
      </div>
    </div>
  );
};

// =============================================================================
// REFRESH INDICATOR COMPONENT
// =============================================================================
// Standalone refresh indicator for custom implementations

export interface RefreshIndicatorProps {
  isRefreshing: boolean;
  progress?: number; // 0-1
  className?: string;
}

export const RefreshIndicator: React.FC<RefreshIndicatorProps> = ({
  isRefreshing,
  progress = 0,
  className = '',
}) => {
  return (
    <motion.div
      className={`flex items-center justify-center py-4 ${className}`}
      initial={{ opacity: 0, height: 0 }}
      animate={{
        opacity: isRefreshing || progress > 0 ? 1 : 0,
        height: isRefreshing || progress > 0 ? 'auto' : 0,
      }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        className={`
          w-8 h-8 rounded-sm flex items-center justify-center
          ${isRefreshing ? 'bg-[#0057B8]' : 'bg-[#333]'}
        `}
        animate={isRefreshing ? { rotate: 360 } : { rotate: progress * 180 }}
        transition={isRefreshing ? { duration: 1, repeat: Infinity, ease: 'linear' } : { duration: 0 }}
      >
        <RefreshCw className="w-4 h-4 text-white" />
      </motion.div>
    </motion.div>
  );
};

export default PullToRefresh;
