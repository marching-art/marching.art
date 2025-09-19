import React, { useState, useEffect, useMemo } from 'react';
import { doc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '../store/userStore';
import { getAllUserCorps } from '../utils/profileCompatibility';
import PersonalSchedule from '../components/dashboard/PersonalSchedule';

const SchedulePage = () => {
    const navigate = useNavigate();
    const { loggedInProfile } = useUserStore();
    const [seasonSettings, setSeasonSettings] = useState(null);
    const [fantasyRecaps, setFantasyRecaps] = useState(null);
    const [currentDay, setCurrentDay] = useState(0);
    const [selectedWeek, setSelectedWeek] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const [viewMode, setViewMode] = useState('calendar'); // 'calendar' or 'personal'
    const [quickFilter, setQuickFilter] = useState('all'); // 'all', 'today', 'upcoming'

    const userCorps = useMemo(() => {
        return loggedInProfile ? getAllUserCorps(loggedInProfile) : {};
    }, [loggedInProfile]);

    useEffect(() => {
        const fetchScheduleData = async () => {
            setIsLoading(true);
            try {
                const seasonDoc = await getDoc(doc(db, 'game-settings', 'season'));
                if (seasonDoc.exists()) {
                    const seasonData = seasonDoc.data();
                    setSeasonSettings(seasonData);

                    const recapsQuery = query(
                        collection(db, 'fantasy_recaps'), 
                        where('seasonUid', '==', seasonData.seasonUid), 
                        limit(1)
                    );
                    const recapsSnapshot = await getDocs(recapsQuery);
                    if (!recapsSnapshot.empty) {
                        setFantasyRecaps(recapsSnapshot.docs[0].data());
                    }

                    if (seasonData.schedule?.startDate) {
                        const startDate = seasonData.schedule.startDate.toDate();
                        const diffInMillis = new Date().getTime() - startDate.getTime();
                        const day = Math.floor(diffInMillis / (1000 * 60 * 60 * 24)) + 1;
                        const currentWeekValue = Math.ceil(Math.max(1, day) / 7);
                        setCurrentDay(Math.max(1, day));
                        setSelectedWeek(currentWeekValue);
                    }
                }
            } catch (error) {
                console.error("Error fetching schedule data:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchScheduleData();
    }, []);

    const getCalendarDate = (dayOffset) => {
        if (!seasonSettings?.schedule?.startDate) return null;
        const startDate = seasonSettings.schedule.startDate.toDate();
        const date = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
        date.setUTCDate(date.getUTCDate() + dayOffset - 1);
        return date;
    };

    const handleViewRecap = (day) => {
        navigate(`/scores?day=${day}`);
    };

    const hasRecapForDay = (day) => {
        return fantasyRecaps?.recaps?.some(r => r.offSeasonDay === day && r.shows?.length > 0);
    };

    const goToCurrentWeek = () => {
        const currentWeekValue = Math.ceil(currentDay / 7);
        setSelectedWeek(currentWeekValue);
    };

    const jumpToWeek = (weekNumber) => {
        setSelectedWeek(weekNumber);
        setQuickFilter('all');
    };

    const filteredEvents = useMemo(() => {
        if (!seasonSettings?.events) return [];
        
        const isLiveSeason = seasonSettings.status === 'live-season';
        let events = seasonSettings.events;

        if (quickFilter === 'today') {
            events = events.filter(event => {
                const eventDay = isLiveSeason ? event.dayIndex + 1 : event.offSeasonDay;
                return eventDay === currentDay;
            });
        } else if (quickFilter === 'upcoming') {
            events = events.filter(event => {
                const eventDay = isLiveSeason ? event.dayIndex + 1 : event.offSeasonDay;
                return eventDay > currentDay;
            });
        }

        if (viewMode === 'calendar') {
            const startDayOfWeek = (selectedWeek - 1) * 7 + 1;
            const endDayOfWeek = selectedWeek * 7;
            events = events.filter(event => {
                const eventDay = isLiveSeason ? event.dayIndex + 1 : event.offSeasonDay;
                return eventDay >= startDayOfWeek && eventDay <= endDayOfWeek;
            });
        }

        return events;
    }, [seasonSettings, selectedWeek, viewMode, quickFilter, currentDay]);

    if (isLoading) {
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
    const currentWeek = Math.ceil(currentDay / 7);

    return (
        <div className="min-h-screen bg-background dark:bg-background-dark">
            <div className="container mx-auto px-4 py-8">
                <div className="space-y-8">
                    {/* Enhanced Header */}
                    <div className="text-center">
                        <h1 className="text-3xl sm:text-4xl font-bold text-primary dark:text-primary-dark">Season Schedule</h1>
                        <p className="text-text-secondary dark:text-text-secondary-dark mt-2">
                            {seasonSettings.name} • {isLiveSeason ? 'Live Season' : 'Off-Season'} • Day {currentDay}
                        </p>
                    </div>

                    {/* View Mode Toggle & Quick Actions */}
                    <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark shadow-theme">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            {/* View Mode Toggle */}
                            <div className="flex bg-background dark:bg-background-dark rounded-theme p-1">
                                <button
                                    onClick={() => setViewMode('calendar')}
                                    className={`px-4 py-2 rounded-theme text-sm font-medium transition-all ${
                                        viewMode === 'calendar'
                                            ? 'bg-primary text-on-primary shadow-md'
                                            : 'text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark'
                                    }`}
                                >
                                    Full Schedule
                                </button>
                                {Object.keys(userCorps).length > 0 && (
                                    <button
                                        onClick={() => setViewMode('personal')}
                                        className={`px-4 py-2 rounded-theme text-sm font-medium transition-all ${
                                            viewMode === 'personal'
                                                ? 'bg-primary text-on-primary shadow-md'
                                                : 'text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark'
                                        }`}
                                    >
                                        My Schedule
                                    </button>
                                )}
                            </div>

                            {/* Quick Filters */}
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setQuickFilter('all')}
                                    className={`px-3 py-1 rounded-theme text-sm transition-all ${
                                        quickFilter === 'all'
                                            ? 'bg-accent text-text-primary dark:text-text-primary-dark'
                                            : 'text-text-secondary dark:text-text-secondary-dark hover:bg-accent/50'
                                    }`}
                                >
                                    All
                                </button>
                                <button
                                    onClick={() => setQuickFilter('today')}
                                    className={`px-3 py-1 rounded-theme text-sm transition-all ${
                                        quickFilter === 'today'
                                            ? 'bg-accent text-text-primary dark:text-text-primary-dark'
                                            : 'text-text-secondary dark:text-text-secondary-dark hover:bg-accent/50'
                                    }`}
                                >
                                    Today
                                </button>
                                <button
                                    onClick={() => setQuickFilter('upcoming')}
                                    className={`px-3 py-1 rounded-theme text-sm transition-all ${
                                        quickFilter === 'upcoming'
                                            ? 'bg-accent text-text-primary dark:text-text-primary-dark'
                                            : 'text-text-secondary dark:text-text-secondary-dark hover:bg-accent/50'
                                    }`}
                                >
                                    Upcoming
                                </button>
                                <button
                                    onClick={goToCurrentWeek}
                                    className="px-3 py-1 bg-primary text-on-primary rounded-theme text-sm font-medium hover:bg-primary/90 transition-all"
                                >
                                    Current Week
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Personal Schedule View */}
                    {viewMode === 'personal' && Object.keys(userCorps).length > 0 && (
                        <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark shadow-theme">
                            <PersonalSchedule
                                userCorps={userCorps}
                                seasonEvents={seasonSettings.events || []}
                                currentDay={currentDay}
                                seasonStartDate={seasonSettings.schedule?.startDate}
                                seasonMode={isLiveSeason ? 'live' : 'off'}
                            />
                        </div>
                    )}

                    {/* Calendar View */}
                    {viewMode === 'calendar' && (
                        <>
                            {/* Week Navigation */}
                            {quickFilter === 'all' && (
                                <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark shadow-theme">
                                    <div className="flex items-center justify-between mb-4">
                                        <h2 className="text-xl font-bold text-text-primary dark:text-text-primary-dark">
                                            Week Navigation
                                        </h2>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => setSelectedWeek(Math.max(1, selectedWeek - 1))}
                                                disabled={selectedWeek === 1}
                                                className="px-3 py-1 bg-background dark:bg-background-dark text-text-primary dark:text-text-primary-dark rounded-theme disabled:opacity-50 disabled:cursor-not-allowed hover:bg-accent dark:hover:bg-accent-dark/20 transition-all"
                                            >
                                                ← Prev
                                            </button>
                                            <span className="text-sm text-text-secondary dark:text-text-secondary-dark px-2">
                                                Week {selectedWeek} of {maxWeeks}
                                            </span>
                                            <button
                                                onClick={() => setSelectedWeek(Math.min(maxWeeks, selectedWeek + 1))}
                                                disabled={selectedWeek === maxWeeks}
                                                className="px-3 py-1 bg-background dark:bg-background-dark text-text-primary dark:text-text-primary-dark rounded-theme disabled:opacity-50 disabled:cursor-not-allowed hover:bg-accent dark:hover:bg-accent-dark/20 transition-all"
                                            >
                                                Next →
                                            </button>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-10 gap-2">
                                        {weeks.map(week => (
                                            <button 
                                                key={week} 
                                                onClick={() => jumpToWeek(week)} 
                                                className={`p-3 rounded-theme font-semibold transition-all relative ${
                                                    selectedWeek === week 
                                                        ? 'bg-primary text-on-primary shadow-lg' 
                                                        : week === currentWeek
                                                        ? 'bg-accent text-text-primary dark:text-text-primary-dark border-2 border-primary dark:border-primary-dark'
                                                        : 'bg-background dark:bg-background-dark text-text-primary dark:text-text-primary-dark hover:bg-accent dark:hover:bg-accent-dark/20'
                                                }`}
                                            >
                                                Week {week}
                                                {week === currentWeek && week !== selectedWeek && (
                                                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full"></span>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Events Display */}
                            <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark shadow-theme">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-xl font-bold text-text-primary dark:text-text-primary-dark">
                                        {quickFilter === 'today' ? 'Today\'s Events' : 
                                         quickFilter === 'upcoming' ? 'Upcoming Events' :
                                         `Week ${selectedWeek} Events`}
                                    </h2>
                                    <div className="text-sm text-text-secondary dark:text-text-secondary-dark">
                                        {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''}
                                    </div>
                                </div>

                                {filteredEvents.length === 0 ? (
                                    <div className="text-center py-12">
                                        <div className="text-6xl mb-4">📅</div>
                                        <p className="text-text-secondary dark:text-text-secondary-dark text-lg">
                                            {quickFilter === 'today' ? 'No events today' : 
                                             quickFilter === 'upcoming' ? 'No upcoming events' :
                                             'No events scheduled this week'}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        {filteredEvents.map((event, eventIndex) => {
                                            const dayNumber = isLiveSeason ? event.dayIndex + 1 : event.offSeasonDay;
                                            const calendarDate = getCalendarDate(dayNumber);
                                            const isCurrentDay = dayNumber === currentDay;
                                            const isPastDay = dayNumber < currentDay;

                                            return (
                                                <div 
                                                    key={eventIndex} 
                                                    className={`p-6 rounded-lg border transition-all ${
                                                        isCurrentDay 
                                                            ? 'bg-primary/10 border-primary/30 shadow-lg' 
                                                            : isPastDay
                                                            ? 'bg-background/50 dark:bg-background-dark/50 border-accent/30 opacity-75'
                                                            : 'bg-background dark:bg-background-dark border-accent/50 hover:border-accent'
                                                    }`}
                                                >
                                                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4">
                                                        <div>
                                                            <div className="flex items-center gap-3 mb-1">
                                                                <h3 className="text-lg font-bold text-text-primary dark:text-text-primary-dark">
                                                                    {calendarDate 
                                                                        ? calendarDate.toLocaleDateString(undefined, { 
                                                                            timeZone: 'UTC', 
                                                                            weekday: 'long', 
                                                                            month: 'long', 
                                                                            day: 'numeric' 
                                                                        }) 
                                                                        : `Day ${dayNumber}`
                                                                    }
                                                                </h3>
                                                                {isCurrentDay && (
                                                                    <span className="text-xs bg-primary text-on-primary font-bold px-2 py-1 rounded-full animate-pulse">
                                                                        TODAY
                                                                    </span>
                                                                )}
                                                                {isPastDay && (
                                                                    <span className="text-xs bg-accent/50 text-text-secondary dark:text-text-secondary-dark px-2 py-1 rounded-full">
                                                                        PAST
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="text-text-secondary dark:text-text-secondary-dark">
                                                                Day {dayNumber} • Week {Math.ceil(dayNumber / 7)}
                                                            </p>
                                                        </div>
                                                        
                                                        <div className="flex items-center gap-2 mt-3 sm:mt-0">
                                                            {hasRecapForDay(dayNumber) && (
                                                                <button 
                                                                    onClick={() => handleViewRecap(dayNumber)} 
                                                                    className="bg-accent hover:bg-accent/80 text-text-primary dark:text-text-primary-dark font-bold py-2 px-4 rounded-theme transition-all flex items-center gap-2"
                                                                >
                                                                    📊 View Recap
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                        {(event.shows || []).map((show, showIndex) => (
                                                            <div 
                                                                key={showIndex} 
                                                                className={`p-4 rounded-theme border transition-all hover:shadow-md ${
                                                                    isPastDay 
                                                                        ? 'border-accent/30 bg-surface/50 dark:bg-surface-dark/50'
                                                                        : 'border-accent/50 dark:border-accent-dark/30 bg-surface dark:bg-surface-dark hover:border-primary/50'
                                                                }`}
                                                            >
                                                                <h4 className="font-bold text-text-primary dark:text-text-primary-dark mb-2">
                                                                    {show.eventName?.replace(/DCI/g, 'marching.art')}
                                                                </h4>
                                                                <p className="text-sm text-text-secondary dark:text-text-secondary-dark flex items-center gap-1">
                                                                    📍 {show.location}
                                                                </p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SchedulePage;