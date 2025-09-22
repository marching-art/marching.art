import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useUserStore } from '../store/userStore';
import { hasAnyCorps, getAllUserCorps } from '../utils/profileCompatibility';

// Import dashboard components (registration removed)
import MyStatus from '../components/dashboard/MyStatus';
import CorpsSelector from '../components/dashboard/CorpsSelector';
import CorpsSchedule from '../components/dashboard/CorpsSchedule';
import SeasonSignup from '../components/dashboard/SeasonSignup';

const DashboardPage = () => {
    const { loggedInProfile, isLoadingAuth } = useUserStore();
    const [seasonSettings, setSeasonSettings] = useState(null);
    const [corpsData, setCorpsData] = useState([]);
    const [seasonEvents, setSeasonEvents] = useState([]);
    const [currentOffSeasonDay, setCurrentOffSeasonDay] = useState(0);
    const [seasonStartDate, setSeasonStartDate] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchDashboardData = async () => {
            if (isLoadingAuth) return; // Wait for auth to finish loading
            
            setIsLoading(true);
            setError(null);
            
            try {
                // Fetch season settings
                const seasonDoc = await getDoc(doc(db, 'game-settings', 'season'));
                if (seasonDoc.exists()) {
                    const seasonData = seasonDoc.data();
                    setSeasonSettings(seasonData);
                    setSeasonStartDate(seasonData.schedule?.startDate?.toDate() || null);
                    setSeasonEvents(seasonData.events || []);

                    // Calculate current day
                    if (seasonData.schedule?.startDate) {
                        const startDate = seasonData.schedule.startDate.toDate();
                        const diffInMillis = new Date().getTime() - startDate.getTime();
                        const currentDay = Math.floor(diffInMillis / (1000 * 60 * 60 * 24)) + 1;
                        setCurrentOffSeasonDay(Math.max(1, currentDay));
                    }

                    // Fetch corps data
                    if (seasonData.dataDocId) {
                        const corpsDoc = await getDoc(doc(db, 'dci-data', seasonData.dataDocId));
                        if (corpsDoc.exists()) {
                            setCorpsData(corpsDoc.data().corpsValues || []);
                        }
                    }
                } else {
                    setError('No active season found. Please check back later.');
                }
            } catch (error) {
                console.error('Error fetching dashboard data:', error);
                setError('Failed to load dashboard data. Please try again.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchDashboardData();
    }, [isLoadingAuth]);

    // Get user's corps for display
    const userCorps = loggedInProfile ? getAllUserCorps(loggedInProfile) : {};
    const hasCorps = hasAnyCorps(loggedInProfile);

    if (isLoadingAuth || isLoading) {
        return (
            <div className="min-h-screen bg-background dark:bg-background-dark flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary dark:border-primary-dark"></div>
                    <p className="mt-4 text-text-secondary dark:text-text-secondary-dark">Loading your dashboard...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-background dark:bg-background-dark flex items-center justify-center p-8">
                <div className="text-center max-w-md">
                    <div className="mb-4">
                        <svg className="w-16 h-16 text-red-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark mb-4">
                        Dashboard Unavailable
                    </h2>
                    <p className="text-text-secondary dark:text-text-secondary-dark mb-6">
                        {error}
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        className="bg-primary dark:bg-primary-dark text-white font-bold py-2 px-4 rounded-theme hover:bg-primary-dark dark:hover:bg-primary transition-colors"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background dark:bg-background-dark">
            <div className="max-w-7xl mx-auto px-4 py-8">
                {/* Dashboard Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-text-primary dark:text-text-primary-dark">
                        Dashboard
                    </h1>
                    <p className="text-text-secondary dark:text-text-secondary-dark mt-2">
                        Welcome back, {loggedInProfile?.username || loggedInProfile?.displayName || 'Director'}!
                        {seasonSettings && (
                            <span className="ml-2">
                                {seasonSettings.name} • Day {currentOffSeasonDay}
                            </span>
                        )}
                    </p>
                </div>

                {/* Main Dashboard Content */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column - Status and Corps Management */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Season Status */}
                        {seasonSettings && (
                            <MyStatus
                                seasonSettings={seasonSettings}
                                currentDay={currentOffSeasonDay}
                                userCorps={userCorps}
                            />
                        )}

                        {/* Corps Management - No Show Registration */}
                        {seasonSettings && (
                            <div className="bg-surface dark:bg-surface-dark border border-accent dark:border-accent-dark rounded-theme p-6">
                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="text-xl font-bold text-text-primary dark:text-text-primary-dark">
                                        Corps Management
                                    </h2>
                                    {hasCorps && (
                                        <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                                            ✓ Ready for competition
                                        </span>
                                    )}
                                </div>

                                {hasCorps ? (
                                    <div className="space-y-4">
                                        {/* Display user's corps */}
                                        <div className="grid gap-4">
                                            {Object.entries(userCorps).map(([corpsClass, corpsData]) => (
                                                <div key={corpsClass} className="p-4 bg-accent dark:bg-accent-dark/20 rounded-theme border border-accent dark:border-accent-dark">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-4 h-4 rounded-full ${
                                                                corpsClass === 'worldClass' ? 'bg-blue-500' :
                                                                corpsClass === 'openClass' ? 'bg-green-500' : 'bg-purple-500'
                                                            }`}></div>
                                                            <div>
                                                                <h3 className="font-semibold text-text-primary dark:text-text-primary-dark">
                                                                    {corpsData.name}
                                                                </h3>
                                                                <p className="text-sm text-text-secondary dark:text-text-secondary-dark">
                                                                    {corpsClass === 'worldClass' ? 'World Class' :
                                                                     corpsClass === 'openClass' ? 'Open Class' : 'A Class'}
                                                                    {corpsData.location && ` • ${corpsData.location}`}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        
                                                        <div className="text-right">
                                                            <p className="text-sm text-text-secondary dark:text-text-secondary-dark">
                                                                Ready for competition
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Management Actions */}
                                        <div className="flex flex-wrap gap-3 pt-4 border-t border-accent dark:border-accent-dark">
                                            <button
                                                onClick={() => {/* Navigate to corps editor */}}
                                                className="flex items-center gap-2 px-4 py-2 bg-primary dark:bg-primary-dark text-white rounded-theme hover:bg-primary-dark dark:hover:bg-primary transition-colors"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                </svg>
                                                Edit Corps
                                            </button>
                                            
                                            <button
                                                onClick={() => {/* Navigate to lineup editor */}}
                                                className="flex items-center gap-2 px-4 py-2 bg-transparent border border-primary dark:border-primary-dark text-primary dark:text-primary-dark rounded-theme hover:bg-primary dark:hover:bg-primary-dark hover:text-white transition-colors"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                                                </svg>
                                                Manage Lineups
                                            </button>
                                        </div>

                                        {/* Register for Shows - Link to Schedule */}
                                        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-theme">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <h4 className="font-medium text-blue-800 dark:text-blue-200">
                                                        Register for Shows
                                                    </h4>
                                                    <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                                                        Visit the Schedule page to register your corps for upcoming events.
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => window.location.href = '/schedule'}
                                                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-theme hover:bg-blue-700 transition-colors"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                    </svg>
                                                    View Schedule
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-8">
                                        <svg className="w-16 h-16 text-text-secondary dark:text-text-secondary-dark mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                                        </svg>
                                        <h3 className="text-lg font-semibold text-text-primary dark:text-text-primary-dark mb-2">
                                            No Corps Registered
                                        </h3>
                                        <p className="text-text-secondary dark:text-text-secondary-dark mb-4">
                                            Create your first drum corps to start competing!
                                        </p>
                                        
                                        {seasonSettings ? (
                                            <CorpsSelector
                                                seasonSettings={seasonSettings}
                                                corpsData={corpsData}
                                                userCorps={userCorps}
                                            />
                                        ) : (
                                            <SeasonSignup />
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Season Registration (if no season active) */}
                        {!seasonSettings && <SeasonSignup />}
                    </div>

                    {/* Right Column - Schedule and Quick Actions */}
                    <div className="space-y-6">
                        {/* Corps Schedule */}
                        {hasCorps && seasonSettings && (
                            <CorpsSchedule
                                seasonSettings={seasonSettings}
                                userCorps={userCorps}
                                seasonStartDate={seasonStartDate}
                                hideTitle={false}
                            />
                        )}

                        {/* Quick Stats */}
                        {seasonSettings && (
                            <div className="bg-surface dark:bg-surface-dark border border-accent dark:border-accent-dark rounded-theme p-6">
                                <h3 className="text-lg font-bold text-text-primary dark:text-text-primary-dark mb-4">
                                    Season Progress
                                </h3>
                                
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <span className="text-text-secondary dark:text-text-secondary-dark">Current Day</span>
                                        <span className="font-semibold text-text-primary dark:text-text-primary-dark">
                                            {currentOffSeasonDay} / 49
                                        </span>
                                    </div>
                                    
                                    <div className="w-full bg-accent dark:bg-accent-dark/20 rounded-full h-2">
                                        <div 
                                            className="bg-primary dark:bg-primary-dark h-2 rounded-full transition-all duration-300"
                                            style={{ width: `${Math.min((currentOffSeasonDay / 49) * 100, 100)}%` }}
                                        ></div>
                                    </div>
                                    
                                    <div className="flex justify-between items-center text-sm text-text-secondary dark:text-text-secondary-dark">
                                        <span>Season Start</span>
                                        <span>Championship</span>
                                    </div>
                                </div>

                                {/* Championship Progress */}
                                {currentOffSeasonDay >= 47 && (
                                    <div className="mt-4 pt-4 border-t border-accent dark:border-accent-dark">
                                        <h4 className="font-medium text-text-primary dark:text-text-primary-dark mb-2">
                                            Championship Week
                                        </h4>
                                        <div className="space-y-2 text-sm">
                                            <div className={`flex items-center gap-2 ${currentOffSeasonDay >= 47 ? 'text-green-600 dark:text-green-400' : 'text-text-secondary dark:text-text-secondary-dark'}`}>
                                                <div className={`w-2 h-2 rounded-full ${currentOffSeasonDay >= 47 ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                                                Day 47: Quarterfinals
                                            </div>
                                            <div className={`flex items-center gap-2 ${currentOffSeasonDay >= 48 ? 'text-green-600 dark:text-green-400' : 'text-text-secondary dark:text-text-secondary-dark'}`}>
                                                <div className={`w-2 h-2 rounded-full ${currentOffSeasonDay >= 48 ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                                                Day 48: Semifinals
                                            </div>
                                            <div className={`flex items-center gap-2 ${currentOffSeasonDay >= 49 ? 'text-green-600 dark:text-green-400' : 'text-text-secondary dark:text-text-secondary-dark'}`}>
                                                <div className={`w-2 h-2 rounded-full ${currentOffSeasonDay >= 49 ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                                                Day 49: Finals
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Quick Actions */}
                        <div className="bg-surface dark:bg-surface-dark border border-accent dark:border-accent-dark rounded-theme p-6">
                            <h3 className="text-lg font-bold text-text-primary dark:text-text-primary-dark mb-4">
                                Quick Actions
                            </h3>
                            
                            <div className="space-y-3">
                                <button
                                    onClick={() => window.location.href = '/schedule'}
                                    className="w-full flex items-center gap-3 p-3 text-left rounded-theme hover:bg-accent dark:hover:bg-accent-dark/20 transition-colors"
                                >
                                    <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    <div>
                                        <p className="font-medium text-text-primary dark:text-text-primary-dark">View Schedule</p>
                                        <p className="text-sm text-text-secondary dark:text-text-secondary-dark">Register for shows and events</p>
                                    </div>
                                </button>
                                
                                <button
                                    onClick={() => window.location.href = '/leaderboard'}
                                    className="w-full flex items-center gap-3 p-3 text-left rounded-theme hover:bg-accent dark:hover:bg-accent-dark/20 transition-colors"
                                >
                                    <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                    </svg>
                                    <div>
                                        <p className="font-medium text-text-primary dark:text-text-primary-dark">Leaderboard</p>
                                        <p className="text-sm text-text-secondary dark:text-text-secondary-dark">See rankings and scores</p>
                                    </div>
                                </button>
                                
                                <button
                                    onClick={() => window.location.href = '/leagues'}
                                    className="w-full flex items-center gap-3 p-3 text-left rounded-theme hover:bg-accent dark:hover:bg-accent-dark/20 transition-colors"
                                >
                                    <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                    </svg>
                                    <div>
                                        <p className="font-medium text-text-primary dark:text-text-primary-dark">Join Leagues</p>
                                        <p className="text-sm text-text-secondary dark:text-text-secondary-dark">Compete with friends</p>
                                    </div>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardPage;