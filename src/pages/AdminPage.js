import React, { useState, useEffect } from 'react';
import { useUserStore } from '../store/userStore';

// Import your admin components
import SeasonControls from '../components/admin/SeasonControls';
import FinalRankingsManager from '../components/admin/FinalRankingsManager';
import LiveSeasonScheduler from '../components/admin/LiveSeasonScheduler';
import ScoreDataViewer from '../components/admin/ScoreDataViewer';

const AdminPage = () => {
    const { loggedInProfile, isLoadingAuth } = useUserStore();
    const [activeTab, setActiveTab] = useState('season');

    // Show loading state
    if (isLoadingAuth) {
        return (
            <div className="min-h-screen bg-background dark:bg-background-dark flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary dark:border-primary-dark"></div>
                    <p className="mt-4 text-text-secondary dark:text-text-secondary-dark">Loading admin panel...</p>
                </div>
            </div>
        );
    }

    // Check admin permissions
    if (!loggedInProfile?.isAdmin) {
        return (
            <div className="min-h-screen bg-background dark:bg-background-dark flex items-center justify-center p-8">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h2>
                    <p className="text-text-secondary dark:text-text-secondary-dark">
                        You don't have permission to access the admin panel.
                    </p>
                </div>
            </div>
        );
    }

    const tabs = [
        { id: 'season', name: 'Season Controls', icon: '⚙️' },
        { id: 'rankings', name: 'Final Rankings', icon: '🏆' },
        { id: 'schedule', name: 'Live Schedule', icon: '📅' },
        { id: 'scores', name: 'Score Data', icon: '📊' }
    ];

    const renderTabContent = () => {
        switch (activeTab) {
            case 'season':
                return <SeasonControls />;
            case 'rankings':
                return <FinalRankingsManager />;
            case 'schedule':
                return <LiveSeasonScheduler />;
            case 'scores':
                return <ScoreDataViewer />;
            default:
                return <SeasonControls />;
        }
    };

    return (
        <div className="min-h-screen bg-background dark:bg-background-dark">
            <div className="container mx-auto px-4 py-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl sm:text-4xl font-bold text-primary dark:text-primary-dark">
                        Admin Panel
                    </h1>
                    <p className="text-text-secondary dark:text-text-secondary-dark mt-2">
                        System administration and configuration
                    </p>
                </div>

                {/* Navigation Tabs */}
                <div className="border-b border-accent dark:border-accent-dark mb-8">
                    <nav className="-mb-px flex space-x-6 overflow-x-auto">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                                    activeTab === tab.id
                                        ? 'border-primary dark:border-primary-dark text-primary dark:text-primary-dark'
                                        : 'border-transparent text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark hover:border-accent dark:hover:border-accent-dark'
                                }`}
                            >
                                <span className="mr-2">{tab.icon}</span>
                                {tab.name}
                            </button>
                        ))}
                    </nav>
                </div>

                {/* Tab Content */}
                <div className="bg-surface dark:bg-surface-dark rounded-theme border border-accent dark:border-accent-dark p-6">
                    {renderTabContent()}
                </div>

                {/* Admin Info Panel */}
                <div className="mt-8 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-theme p-4">
                    <div className="flex">
                        <div className="flex-shrink-0">
                            <span className="text-yellow-600 dark:text-yellow-400">⚠️</span>
                        </div>
                        <div className="ml-3">
                            <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                                Admin Access
                            </h3>
                            <div className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
                                <p>
                                    You are logged in as <strong>{loggedInProfile.username}</strong> with administrative privileges.
                                    Please use caution when making changes as they affect all users.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminPage;