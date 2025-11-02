import React, { useState } from 'react';

/**
 * CompactTabPanel - Icon-based navigation for maximum tabs, zero scrolling
 * Icons on left/top, content fills remaining space
 */
const CompactTabPanel = ({ tabs, defaultTab = 0, className = '', layout = 'top' }) => {
    const [activeTab, setActiveTab] = useState(defaultTab);

    // Top layout (default) - icons across top
    if (layout === 'top') {
        return (
            <div className={`flex flex-col h-full ${className}`}>
                {/* Tab Icons - Top */}
                <div className="flex-shrink-0 bg-surface dark:bg-surface-dark border-b border-accent dark:border-accent-dark">
                    <div className="flex justify-around items-center p-2">
                        {tabs.map((tab, index) => (
                            <button
                                key={index}
                                onClick={() => setActiveTab(index)}
                                title={tab.label}
                                className={`flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-all ${
                                    activeTab === index
                                        ? 'bg-primary text-on-primary shadow-lg'
                                        : 'text-text-secondary dark:text-text-secondary-dark hover:bg-accent dark:hover:bg-accent-dark/20'
                                }`}
                            >
                                <span className="text-2xl">{tab.icon || '○'}</span>
                                <span className="text-xs font-semibold truncate max-w-[80px]">{tab.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {tabs[activeTab].content}
                </div>
            </div>
        );
    }

    // Side layout - icons on left (desktop), top on mobile
    return (
        <div className={`flex flex-col md:flex-row h-full ${className}`}>
            {/* Tab Icons - Side (Desktop) / Top (Mobile) */}
            <div className="flex-shrink-0 bg-surface dark:bg-surface-dark border-b md:border-b-0 md:border-r border-accent dark:border-accent-dark">
                <div className="flex md:flex-col justify-around md:justify-start items-center p-2 gap-1">
                    {tabs.map((tab, index) => (
                        <button
                            key={index}
                            onClick={() => setActiveTab(index)}
                            title={tab.label}
                            className={`flex flex-col md:flex-row items-center justify-center gap-2 p-3 rounded-lg transition-all ${
                                activeTab === index
                                    ? 'bg-primary text-on-primary shadow-lg'
                                    : 'text-text-secondary dark:text-text-secondary-dark hover:bg-accent dark:hover:bg-accent-dark/20'
                            }`}
                        >
                            <span className="text-2xl">{tab.icon || '○'}</span>
                            <span className="text-xs md:text-sm font-semibold hidden md:block truncate max-w-[100px]">
                                {tab.label}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {tabs[activeTab].content}
            </div>
        </div>
    );
};

export default CompactTabPanel;
