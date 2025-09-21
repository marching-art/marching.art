import React, { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase'; // Fixed import path
import { useUserStore } from '../../store/userStore';
import { ADMIN_ACTIONS, ADMIN_CONFIG, hasPermission, ADMIN_PERMISSIONS } from '../../config/admin'; // Fixed import path
import toast from 'react-hot-toast';
import Icon from '../ui/Icon';

const AdminDashboard = () => {
    const { loggedInProfile } = useUserStore();
    const [isLoading, setIsLoading] = useState(false);
    const [systemStats, setSystemStats] = useState({
        totalUsers: 0,
        activeSeasons: 0,
        totalLeagues: 0,
        pendingReports: 0
    });

    // Manual trigger functions
    const manualTrigger = httpsCallable(functions, 'manualTrigger');
    const startNewOffSeason = httpsCallable(functions, 'startNewOffSeason');
    const startNewLiveSeason = httpsCallable(functions, 'startNewLiveSeason');

    useEffect(() => {
        loadSystemStats();
    }, []);

    const loadSystemStats = async () => {
        try {
            // Load system statistics
            // This would typically fetch from your analytics or admin endpoints
            setSystemStats({
                totalUsers: 1247,
                activeSeasons: 1,
                totalLeagues: 89,
                pendingReports: 3
            });
        } catch (error) {
            console.error('Error loading system stats:', error);
        }
    };

    const handleManualTrigger = async (jobName) => {
        if (!hasPermission(loggedInProfile?.role, ADMIN_PERMISSIONS.MANAGE_SEASONS)) {
            toast.error('Insufficient permissions');
            return;
        }

        setIsLoading(true);
        try {
            const result = await manualTrigger({ jobName });
            toast.success(result.data.message || 'Job executed successfully');
        } catch (error) {
            console.error('Manual trigger error:', error);
            toast.error(error.message || 'Failed to execute job');
        } finally {
            setIsLoading(false);
        }
    };

    const handleStartNewSeason = async (seasonType) => {
        if (!hasPermission(loggedInProfile?.role, ADMIN_PERMISSIONS.MANAGE_SEASONS)) {
            toast.error('Insufficient permissions');
            return;
        }

        setIsLoading(true);
        try {
            const triggerFunction = seasonType === 'live' ? startNewLiveSeason : startNewOffSeason;
            const result = await triggerFunction();
            toast.success(result.data.message || `New ${seasonType} season started successfully`);
            loadSystemStats(); // Refresh stats
        } catch (error) {
            console.error('Start season error:', error);
            toast.error(error.message || `Failed to start ${seasonType} season`);
        } finally {
            setIsLoading(false);
        }
    };

    const adminActions = [
        {
            name: 'Calculate Corps Statistics',
            description: 'Recalculate all corps statistics and rankings',
            action: () => handleManualTrigger(ADMIN_ACTIONS.PROCESS_SCORES),
            permission: ADMIN_PERMISSIONS.MANAGE_SEASONS,
            icon: "M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586l-2 2V5H5v14h7v2H4a1 1 0 01-1-1V4z"
        },
        {
            name: 'Update Global Leaderboard',
            description: 'Force update of global leaderboard rankings',
            action: () => handleManualTrigger(ADMIN_ACTIONS.UPDATE_LEADERBOARD),
            permission: ADMIN_PERMISSIONS.MANAGE_SEASONS,
            icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
        },
        {
            name: 'Archive Season Results',
            description: 'Archive current season and prepare for new season',
            action: () => handleManualTrigger(ADMIN_ACTIONS.ARCHIVE_SEASON),
            permission: ADMIN_PERMISSIONS.MANAGE_SEASONS,
            icon: "M5 8a2 2 0 012-2h6a2 2 0 012 2v3a2 2 0 01-2 2H9l-3 3v-3a2 2 0 01-2-2V8z"
        }
    ];

    return (
        <div className="space-y-6">
            {/* System Overview */}
            <div className="bg-surface dark:bg-surface-dark border border-accent dark:border-accent-dark rounded-theme p-6">
                <h2 className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-6">
                    System Overview
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="text-center">
                        <div className="text-3xl font-bold text-primary dark:text-primary-dark">
                            {systemStats.totalUsers.toLocaleString()}
                        </div>
                        <div className="text-sm text-text-secondary dark:text-text-secondary-dark">
                            Total Users
                        </div>
                    </div>
                    
                    <div className="text-center">
                        <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                            {systemStats.activeSeasons}
                        </div>
                        <div className="text-sm text-text-secondary dark:text-text-secondary-dark">
                            Active Seasons
                        </div>
                    </div>
                    
                    <div className="text-center">
                        <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                            {systemStats.totalLeagues}
                        </div>
                        <div className="text-sm text-text-secondary dark:text-text-secondary-dark">
                            Total Leagues
                        </div>
                    </div>
                    
                    <div className="text-center">
                        <div className="text-3xl font-bold text-red-600 dark:text-red-400">
                            {systemStats.pendingReports}
                        </div>
                        <div className="text-sm text-text-secondary dark:text-text-secondary-dark">
                            Pending Reports
                        </div>
                    </div>
                </div>
            </div>

            {/* Season Management */}
            <div className="bg-surface dark:bg-surface-dark border border-accent dark:border-accent-dark rounded-theme p-6">
                <h2 className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-6">
                    Season Management
                </h2>
                
                <div className="grid gap-4 md:grid-cols-2">
                    <button
                        onClick={() => handleStartNewSeason('off')}
                        disabled={isLoading}
                        className="flex items-center justify-center gap-3 p-4 bg-primary dark:bg-primary-dark text-white rounded-theme hover:bg-primary-dark dark:hover:bg-primary transition-colors disabled:opacity-50"
                    >
                        <Icon path="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" className="w-5 h-5" />
                        Start New Off-Season
                    </button>
                    
                    <button
                        onClick={() => handleStartNewSeason('live')}
                        disabled={isLoading}
                        className="flex items-center justify-center gap-3 p-4 bg-red-600 text-white rounded-theme hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                        <Icon path="M5.636 5.636a9 9 0 1012.728 0M12 3v9" className="w-5 h-5" />
                        Start New Live Season
                    </button>
                </div>
            </div>

            {/* Admin Actions */}
            <div className="bg-surface dark:bg-surface-dark border border-accent dark:border-accent-dark rounded-theme p-6">
                <h2 className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-6">
                    System Actions
                </h2>
                
                <div className="grid gap-4">
                    {adminActions.map((actionItem) => {
                        const hasRequiredPermission = hasPermission(loggedInProfile?.role, actionItem.permission);
                        
                        if (!hasRequiredPermission) return null;
                        
                        return (
                            <div key={actionItem.name} className="flex items-center justify-between p-4 bg-accent dark:bg-accent-dark/20 rounded-theme">
                                <div className="flex items-center gap-4">
                                    <Icon path={actionItem.icon} className="w-6 h-6 text-primary dark:text-primary-dark" />
                                    <div>
                                        <h3 className="font-semibold text-text-primary dark:text-text-primary-dark">
                                            {actionItem.name}
                                        </h3>
                                        <p className="text-sm text-text-secondary dark:text-text-secondary-dark">
                                            {actionItem.description}
                                        </p>
                                    </div>
                                </div>
                                
                                <button
                                    onClick={actionItem.action}
                                    disabled={isLoading}
                                    className="px-4 py-2 bg-primary dark:bg-primary-dark text-white rounded-theme hover:bg-primary-dark dark:hover:bg-primary transition-colors disabled:opacity-50"
                                >
                                    Execute
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* System Status */}
            <div className="bg-surface dark:bg-surface-dark border border-accent dark:border-accent-dark rounded-theme p-6">
                <h2 className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-6">
                    System Status
                </h2>
                
                <div className="grid gap-4 md:grid-cols-3">
                    <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-theme">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <div>
                            <p className="font-medium text-green-800 dark:text-green-200">Database</p>
                            <p className="text-sm text-green-600 dark:text-green-300">Online</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-theme">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <div>
                            <p className="font-medium text-green-800 dark:text-green-200">Functions</p>
                            <p className="text-sm text-green-600 dark:text-green-300">Operational</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-theme">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <div>
                            <p className="font-medium text-green-800 dark:text-green-200">Hosting</p>
                            <p className="text-sm text-green-600 dark:text-green-300">Online</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;