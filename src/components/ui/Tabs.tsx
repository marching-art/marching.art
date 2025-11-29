import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion } from 'framer-motion';

// =============================================================================
// TABS CONTEXT
// =============================================================================

interface TabsContextValue {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

const useTabsContext = () => {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error('Tabs components must be used within a Tabs provider');
  }
  return context;
};

// =============================================================================
// TABS ROOT COMPONENT
// =============================================================================

export type TabsVariant = 'default' | 'pills' | 'underline';

export interface TabsProps {
  defaultTab: string;
  variant?: TabsVariant;
  onChange?: (tab: string) => void;
  children: React.ReactNode;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({
  defaultTab,
  variant = 'default',
  onChange,
  children,
  className = '',
}) => {
  const [activeTab, setActiveTabState] = useState(defaultTab);

  const setActiveTab = useCallback(
    (tab: string) => {
      setActiveTabState(tab);
      onChange?.(tab);
    },
    [onChange]
  );

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className={className} data-variant={variant}>
        {children}
      </div>
    </TabsContext.Provider>
  );
};

// =============================================================================
// TABS LIST COMPONENT
// =============================================================================

export interface TabsListProps {
  children: React.ReactNode;
  className?: string;
}

export const TabsList: React.FC<TabsListProps> = ({ children, className = '' }) => {
  return (
    <div
      role="tablist"
      className={`
        flex gap-1 p-1 rounded-lg bg-charcoal-800/50 border border-cream-900/20
        overflow-x-auto scrollbar-hide
        ${className}
      `}
    >
      {children}
    </div>
  );
};

// =============================================================================
// TAB TRIGGER COMPONENT
// =============================================================================

export interface TabTriggerProps {
  value: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
  disabled?: boolean;
  className?: string;
}

export const TabTrigger: React.FC<TabTriggerProps> = ({
  value,
  children,
  icon,
  disabled = false,
  className = '',
}) => {
  const { activeTab, setActiveTab } = useTabsContext();
  const isActive = activeTab === value;

  return (
    <button
      role="tab"
      aria-selected={isActive}
      aria-controls={`tabpanel-${value}`}
      disabled={disabled}
      onClick={() => !disabled && setActiveTab(value)}
      className={`
        relative flex items-center gap-2 px-4 py-2.5
        text-sm font-medium rounded-md
        transition-all duration-200
        focus:outline-none focus:ring-2 focus:ring-gold-500/50
        disabled:opacity-50 disabled:cursor-not-allowed
        ${isActive
          ? 'text-charcoal-900'
          : 'text-cream-400 hover:text-cream-200 hover:bg-cream-900/10'
        }
        ${className}
      `}
    >
      {isActive && (
        <motion.div
          layoutId="activeTab"
          className="absolute inset-0 bg-gradient-gold rounded-md"
          initial={false}
          transition={{ type: 'spring', duration: 0.4, bounce: 0.2 }}
        />
      )}
      <span className="relative z-10 flex items-center gap-2">
        {icon}
        {children}
      </span>
    </button>
  );
};

// =============================================================================
// TAB CONTENT COMPONENT
// =============================================================================

export interface TabContentProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

export const TabContent: React.FC<TabContentProps> = ({
  value,
  children,
  className = '',
}) => {
  const { activeTab } = useTabsContext();

  if (activeTab !== value) {
    return null;
  }

  return (
    <motion.div
      role="tabpanel"
      id={`tabpanel-${value}`}
      aria-labelledby={`tab-${value}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className={`mt-4 ${className}`}
    >
      {children}
    </motion.div>
  );
};

// =============================================================================
// SIMPLE TABS COMPONENT (FOR QUICK USE)
// =============================================================================

export interface SimpleTab {
  id: string;
  label: string;
  icon?: React.ReactNode;
  content: React.ReactNode;
  disabled?: boolean;
}

export interface SimpleTabsProps {
  tabs: SimpleTab[];
  defaultTab?: string;
  onChange?: (tab: string) => void;
  className?: string;
}

export const SimpleTabs: React.FC<SimpleTabsProps> = ({
  tabs,
  defaultTab,
  onChange,
  className = '',
}) => {
  const defaultValue = defaultTab || tabs[0]?.id || '';

  return (
    <Tabs defaultTab={defaultValue} onChange={onChange} className={className}>
      <TabsList>
        {tabs.map((tab) => (
          <TabTrigger key={tab.id} value={tab.id} icon={tab.icon} disabled={tab.disabled}>
            {tab.label}
          </TabTrigger>
        ))}
      </TabsList>
      {tabs.map((tab) => (
        <TabContent key={tab.id} value={tab.id}>
          {tab.content}
        </TabContent>
      ))}
    </Tabs>
  );
};

export default Tabs;
