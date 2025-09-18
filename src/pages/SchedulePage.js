import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useUserStore } from '../store/userStore';

const SchedulePage = ({ setPage }) => {
    const { loggedInProfile, isLoadingAuth } = useUserStore();
    const [seasonSettings, setSeasonSettings] = useState(null);
    const [currentDay, setCurrentDay] = useState(0);
    const [selectedWeek, setSelectedWeek] = useState(1);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchScheduleData = async () => {
            if (isLoadingAuth) return;
            
            setIsLoading(true);
            try {
                const seasonDoc = await getDoc(doc(db, 'game-settings', 'season'));
                if (seasonDoc.exists()) {
                    const seasonData = seasonDoc.data();
                    setSeasonSettings(seasonData);

                    // Calculate current day
                    if (seasonData.schedule?.startDate) {
                        const startDate = seasonData.schedule.startDate.toDate();
                        const diffInMillis = new Date().getTime() - startDate.getTime();
                        const day = Math.floor(diffInMillis / (1000 * 60 * 60 * 24)) + 1;
                        setCurrentDay(Math.max(1, day));
                        setSelectedWeek(Math.ceil(Math.max(1, day) / 7));
                    }
                }
            } catch (error) {
                console.error("Error fetching schedule data:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchScheduleData();
    }, [isLoadingAuth]);

    // Show loading state
    if (isLoadingAuth || isLoading) {
        return (
            <div className="min-h-screen bg-background dark:bg-background-dark flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary dark:border-primary-dark"></div>
                    <p className="mt-4 text-text-secondary dark:text-text-secondary-dark">Loading schedule...</p>
                </div>
            </div>
        );
    }

    if (!seasonSettings) {
        return (
            <div className="min-h-screen bg-background dark:bg-background-dark flex items-center justify-center p-8">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark mb-4">No Active Season</h2>
                    <p className="text-text-secondary dark:text-text-secondary-dark">There's no active season schedule to display.</p>
                </div>
            </div>
        );
    }

    const isLiveSeason = seasonSettings.status === 'live-season';
    const maxWeeks = isLiveSeason ? 10 : 7;
    const weeks = Array.from({ length: maxWeeks }, (_, i) => i + 1);
    
    // Get events for selected week
    const eventsForWeek = seasonSettings.events?.filter(event => {
        if (isLiveSeason) {
            return event.week === selectedWeek;
        } else {
            // Off-season: group by week (7 days each)
            const startDay = (selectedWeek - 1) * 7 + 1;
            const endDay = selectedWeek * 7;
            return event.offSeasonDay >= startDay && event.offSeasonDay <= endDay;
        }
    }) || [];

    const getCalendarDate = (dayOffset) => {
        if (!seasonSettings.schedule?.startDate) return null;
        const startDate = seasonSettings.schedule.startDate.toDate();
        const date = new Date(startDate);
        date.setDate(date.getDate() + dayOffset - 1);
        return date;
    };

    return (
        <div className="min-h-screen bg-background dark:bg-background-dark">
            <div className="container mx-auto px-4 py-8">
                <div className="space-y-8">
                    {/* Page Header */}
                    <div className="text-center">
                        <h1 className="text-3xl sm:text-4xl font-bold text-primary dark:text-primary-dark">
                            Season Schedule
                        </h1>
                        <p className="text-text-secondary dark:text-text-secondary-dark mt-2">
                            {seasonSettings.name} • {isLiveSeason ? 'Live Season' : 'Off-Season'}
                        </p>
                    </div>

                    {/* Season Info */}
                    <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark shadow-theme">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
                            <div>
                                <p className="text-2xl font-bold text-primary dark:text-primary-dark">
                                    Day {currentDay}
                                </p>
                                <p className="text-sm text-text-secondary dark:text-text-secondary-dark">Current Day</p>
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-primary dark:text-primary-dark">
                                    Week {Math.ceil(currentDay / 7)}
                                </p>
                                <p className="text-sm text-text-secondary dark:text-text-secondary-dark">Current Week</p>
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-primary dark:text-primary-dark">
                                    {maxWeeks} Weeks
                                </p>
                                <p className="text-sm text-text-secondary dark:text-text-secondary-dark">Season Length</p>
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-primary dark:text-primary-dark">
                                    {seasonSettings.currentPointCap}
                                </p>
                                <p className="text-sm text-text-secondary dark:text-text-secondary-dark">Point Cap</p>
                            </div>
                        </div>
                    </div>

                    {/* Week Selector */}
                    <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark shadow-theme">
                        <h2 className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-4">
                            Select Week to View
                        </h2>
                        <div className="grid grid-cols-2 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-10 gap-2">
                            {weeks.map(week => (
                                <button
                                    key={week}
                                    onClick={() => setSelectedWeek(week)}
                                    className={`p-3 rounded-theme font-semibold transition-all ${
                                        selectedWeek === week
                                            ? 'bg-primary text-on-primary shadow-lg'
                                            : 'bg-background dark:bg-background-dark text-text-primary dark:text-text-primary-dark hover:bg-accent dark:hover:bg-accent-dark/20'
                                    }`}
                                >
                                    Week {week}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Events for Selected Week */}
                    <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark shadow-theme">
                        <h2 className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-4">
                            Week {selectedWeek} Events
                        </h2>
                        
                        {eventsForWeek.length === 0 ? (
                            <div className="text-center py-8">
                                <p className="text-text-secondary dark:text-text-secondary-dark">
                                    No events scheduled for this week.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {eventsForWeek.map((event, eventIndex) => (
                                    <div key={eventIndex} className="border-l-4 border-primary dark:border-primary-dark pl-4">
                                        <div className="mb-2">
                                            <p className="text-sm font-bold text-primary dark:text-primary-dark">
                                                Day {isLiveSeason ? event.dayIndex + 1 : event.offSeasonDay}
                                                {getCalendarDate(isLiveSeason ? event.dayIndex + 1 : event.offSeasonDay) && (
                                                    <span className="ml-2 font-normal">
                                                        ({getCalendarDate(isLiveSeason ? event.dayIndex + 1 : event.offSeasonDay).toLocaleDateString()})
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                        <div className="space-y-2">
                                            {(event.shows || []).map((show, showIndex) => (
                                                <div key={showIndex} className="bg-background dark:bg-background-dark p-3 rounded-theme">
                                                    <h4 className="font-bold text-text-primary dark:text-text-primary-dark">
                                                        {show.eventName?.replace(/DCI/g, 'marching.art') || show.name?.replace(/DCI/g, 'marching.art')}
                                                    </h4>
                                                    <p className="text-sm text-text-secondary dark:text-text-secondary-dark">
                                                        📍 {show.location}
                                                    </p>
                                                    {show.mandatory && (
                                                        <span className="inline-block mt-1 px-2 py-1 bg-primary/20 text-primary dark:text-primary-dark text-xs rounded-theme">
                                                            Championship Event
                                                        </span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Quick Actions */}
                    {loggedInProfile && (
                        <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark shadow-theme">
                            <h3 className="text-lg font-bold text-text-primary dark:text-text-primary-dark mb-4">
                                Quick Actions
                            </h3>
                            <div className="flex flex-col sm:flex-row gap-4">
                                <button 
                                    onClick={() => setPage('dashboard')}
                                    className="flex-1 bg-primary hover:opacity-90 text-on-primary font-bold py-3 px-6 rounded-theme transition-all"
                                >
                                    📋 Manage My Corps
                                </button>
                                <button 
                                    onClick={() => setPage('scores')}
                                    className="flex-1 bg-secondary hover:opacity-90 text-on-secondary font-bold py-3 px-6 rounded-theme transition-all"
                                >
                                    📊 View Scores
                                </button>
                                <button 
                                    onClick={() => setPage('leaderboard')}
                                    className="flex-1 bg-accent hover:opacity-90 text-text-primary dark:text-text-primary-dark font-bold py-3 px-6 rounded-theme transition-all"
                                >
                                    🏆 Leaderboard
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SchedulePage;