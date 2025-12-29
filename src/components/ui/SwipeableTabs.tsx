// =============================================================================
// SWIPEABLE TABS COMPONENT
// =============================================================================
// Mobile-native swipe navigation between tabs
// Uses Framer Motion for smooth gestures and animations

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';

// =============================================================================
// TYPES
// =============================================================================

export interface Tab {
  id: string;
  label: string;
  content: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}

export interface SwipeableTabsProps {
  tabs: Tab[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  swipeEnabled?: boolean;
  tabBarClassName?: string;
  contentClassName?: string;
}

// =============================================================================
// SWIPEABLE TABS COMPONENT
// =============================================================================

export const SwipeableTabs: React.FC<SwipeableTabsProps> = ({
  tabs,
  activeTab: controlledActiveTab,
  onTabChange,
  swipeEnabled = true,
  tabBarClassName = '',
  contentClassName = '',
}) => {
  // Internal state for uncontrolled usage
  const [internalActiveTab, setInternalActiveTab] = useState(tabs[0]?.id || '');

  // Use controlled or uncontrolled state
  const activeTab = controlledActiveTab ?? internalActiveTab;
  const activeIndex = tabs.findIndex((t) => t.id === activeTab);

  // Direction for animation
  const [direction, setDirection] = useState(0);

  // Handle tab change
  const handleTabChange = useCallback(
    (tabId: string) => {
      const newIndex = tabs.findIndex((t) => t.id === tabId);
      const oldIndex = tabs.findIndex((t) => t.id === activeTab);
      setDirection(newIndex > oldIndex ? 1 : -1);

      if (onTabChange) {
        onTabChange(tabId);
      } else {
        setInternalActiveTab(tabId);
      }
    },
    [tabs, activeTab, onTabChange]
  );

  // Handle swipe
  const handleDragEnd = useCallback(
    (e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (!swipeEnabled) return;

      const swipeThreshold = 50;
      const velocityThreshold = 500;

      const swipedLeft = info.offset.x < -swipeThreshold || info.velocity.x < -velocityThreshold;
      const swipedRight = info.offset.x > swipeThreshold || info.velocity.x > velocityThreshold;

      if (swipedLeft && activeIndex < tabs.length - 1) {
        handleTabChange(tabs[activeIndex + 1].id);
      } else if (swipedRight && activeIndex > 0) {
        handleTabChange(tabs[activeIndex - 1].id);
      }
    },
    [swipeEnabled, activeIndex, tabs, handleTabChange]
  );

  // Animation variants
  const variants = {
    enter: (dir: number) => ({
      x: dir > 0 ? '100%' : '-100%',
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (dir: number) => ({
      x: dir > 0 ? '-100%' : '100%',
      opacity: 0,
    }),
  };

  const activeTabData = tabs.find((t) => t.id === activeTab);

  return (
    <div className="flex flex-col h-full">
      {/* Tab Bar */}
      <div
        className={`flex-shrink-0 border-b border-[#333] bg-[#1a1a1a] ${tabBarClassName}`}
      >
        <div className="flex relative">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.id === activeTab;

            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`
                  flex-1 flex items-center justify-center gap-2
                  py-3.5 min-h-[48px] text-sm font-bold uppercase tracking-wide
                  transition-colors duration-150 press-feedback
                  ${isActive
                    ? 'text-[#0057B8]'
                    : 'text-gray-500 active:text-white'
                  }
                `}
                aria-selected={isActive}
                role="tab"
              >
                {Icon && <Icon className="w-4 h-4" />}
                <span>{tab.label}</span>
              </button>
            );
          })}

          {/* Active Indicator */}
          <motion.div
            className="absolute bottom-0 h-0.5 bg-[#0057B8]"
            initial={false}
            animate={{
              left: `${(activeIndex / tabs.length) * 100}%`,
              width: `${100 / tabs.length}%`,
            }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          />
        </div>
      </div>

      {/* Content Area */}
      <div className={`flex-1 overflow-hidden relative ${contentClassName}`}>
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={activeTab}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              type: 'spring',
              stiffness: 300,
              damping: 30,
            }}
            drag={swipeEnabled ? 'x' : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.3}
            onDragEnd={handleDragEnd}
            className="absolute inset-0 h-full overflow-y-auto scroll-momentum"
          >
            {activeTabData?.content}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

// =============================================================================
// SIMPLE TAB BAR COMPONENT
// =============================================================================
// Just the tab bar without swipe, for custom implementations

export interface TabBarProps {
  tabs: { id: string; label: string; icon?: React.ComponentType<{ className?: string }> }[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  className?: string;
  variant?: 'default' | 'pills';
}

export const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTab,
  onTabChange,
  className = '',
  variant = 'default',
}) => {
  const activeIndex = tabs.findIndex((t) => t.id === activeTab);

  if (variant === 'pills') {
    return (
      <div className={`flex gap-2 p-2 bg-[#1a1a1a] rounded-lg ${className}`}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.id === activeTab;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`
                flex-1 flex items-center justify-center gap-2
                py-2.5 min-h-[44px] text-sm font-bold uppercase tracking-wide
                rounded-md transition-all duration-150 press-feedback
                ${isActive
                  ? 'bg-[#0057B8] text-white'
                  : 'text-gray-500 hover:text-white active:bg-white/5'
                }
              `}
              aria-selected={isActive}
              role="tab"
            >
              {Icon && <Icon className="w-4 h-4" />}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={`flex relative border-b border-[#333] bg-[#1a1a1a] ${className}`}>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = tab.id === activeTab;

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`
              flex-1 flex items-center justify-center gap-2
              py-3.5 min-h-[48px] text-sm font-bold uppercase tracking-wide
              transition-colors duration-150 press-feedback
              ${isActive
                ? 'text-[#0057B8]'
                : 'text-gray-500 active:text-white'
              }
            `}
            aria-selected={isActive}
            role="tab"
          >
            {Icon && <Icon className="w-4 h-4" />}
            <span>{tab.label}</span>
          </button>
        );
      })}

      {/* Active Indicator */}
      <motion.div
        className="absolute bottom-0 h-0.5 bg-[#0057B8]"
        initial={false}
        animate={{
          left: `${(activeIndex / tabs.length) * 100}%`,
          width: `${100 / tabs.length}%`,
        }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      />
    </div>
  );
};

export default SwipeableTabs;
