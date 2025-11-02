import React, { useState } from 'react';

/**
 * GameTabPanel - Grid-based tab navigation that looks like game menu
 * Perfect for mobile - no scrolling, uses screen space efficiently
 */
const GameTabPanel = ({ tabs, defaultTab = 0, className = '' }) => {
    const [activeTab, setActiveTab] = useState(defaultTab);
    const [showMenu, setShowMenu] = useState(false);

    return (
        <div className={`flex flex-col h-full ${className}`}>
            {/* Compact Header with Menu Toggle */}
            <div className="flex-shrink-0 border-b-2 border-accent dark:border-accent-dark bg-surface dark:bg-surface-dark">
                <div className="flex items-center justify-between px-4 py-3">
                    <h2 className="text-lg font-bold text-primary dark:text-primary-dark">
                        {tabs[activeTab].label}
                    </h2>
                    <button
                        onClick={() => setShowMenu(!showMenu)}
                        className="md:hidden bg-primary text-on-primary px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition-all"
                    >
                        {showMenu ? 'Close' : 'Menu'}
                    </button>
                </div>

                {/* Desktop: Horizontal Tabs */}
                <div className="hidden md:flex border-t border-accent dark:border-accent-dark">
                    {tabs.map((tab, index) => (
                        <button
                            key={index}
                            onClick={() => setActiveTab(index)}
                            className={`flex-1 px-4 py-3 font-semibold transition-all border-b-2 flex items-center justify-center gap-2 ${
                                activeTab === index
                                    ? 'border-primary text-primary dark:text-primary-dark bg-background/30 dark:bg-background-dark/30'
                                    : 'border-transparent text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark hover:bg-accent/20 dark:hover:bg-accent-dark/20'
                            }`}
                        >
                            {tab.icon && <span className="text-xl">{tab.icon}</span>}
                            <span>{tab.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Mobile: Grid Menu Overlay */}
            {showMenu && (
                <div className="md:hidden absolute inset-0 z-50 bg-background/95 dark:bg-background-dark/95 backdrop-blur-sm">
                    <div className="h-full flex flex-col p-4">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold text-primary dark:text-primary-dark">Select Section</h2>
                            <button
                                onClick={() => setShowMenu(false)}
                                className="text-text-secondary dark:text-text-secondary-dark text-3xl leading-none"
                            >
                                ×
                            </button>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 flex-1 content-start">
                            {tabs.map((tab, index) => (
                                <button
                                    key={index}
                                    onClick={() => {
                                        setActiveTab(index);
                                        setShowMenu(false);
                                    }}
                                    className={`h-32 rounded-xl font-bold text-lg transition-all flex flex-col items-center justify-center gap-3 ${
                                        activeTab === index
                                            ? 'bg-primary text-on-primary shadow-lg scale-105'
                                            : 'bg-surface dark:bg-surface-dark border-2 border-accent dark:border-accent-dark text-text-primary dark:text-text-primary-dark hover:border-primary dark:hover:border-primary-dark'
                                    }`}
                                >
                                    {tab.icon && <span className="text-4xl">{tab.icon}</span>}
                                    <span>{tab.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="h-full">
                    {tabs[activeTab].content}
                </div>
            </div>
        </div>
    );
};

export default GameTabPanel;
