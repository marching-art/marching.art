import React, { useState } from 'react';

const TabPanel = ({ tabs, defaultTab = 0, className = '' }) => {
    const [activeTab, setActiveTab] = useState(defaultTab);

    return (
        <div className={`flex flex-col h-full ${className}`}>
            {/* Desktop: Horizontal Tabs */}
            <div className="hidden md:flex flex-shrink-0 border-b border-accent dark:border-accent-dark bg-surface dark:bg-surface-dark">
                <div className="flex w-full">
                    {tabs.map((tab, index) => (
                        <button
                            key={index}
                            onClick={() => setActiveTab(index)}
                            className={`flex-1 px-4 py-3 font-semibold transition-all border-b-2 ${
                                activeTab === index
                                    ? 'border-primary text-primary dark:text-primary-dark bg-background/50 dark:bg-background-dark/50'
                                    : 'border-transparent text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark'
                            }`}
                        >
                            {tab.icon && <span className="mr-2">{tab.icon}</span>}
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Mobile: Dropdown Selector */}
            <div className="md:hidden flex-shrink-0 border-b border-accent dark:border-accent-dark bg-surface dark:bg-surface-dark p-2">
                <select
                    value={activeTab}
                    onChange={(e) => setActiveTab(Number(e.target.value))}
                    className="w-full bg-background dark:bg-background-dark border border-accent dark:border-accent-dark rounded-lg px-4 py-3 text-text-primary dark:text-text-primary-dark font-semibold focus:ring-2 focus:ring-primary focus:border-primary"
                >
                    {tabs.map((tab, index) => (
                        <option key={index} value={index}>
                            {tab.label}
                        </option>
                    ))}
                </select>
            </div>

            {/* Tab Content - Scrollable */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="h-full">
                    {tabs[activeTab].content}
                </div>
            </div>
        </div>
    );
};

export default TabPanel;
