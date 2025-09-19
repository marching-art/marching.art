import React, { useState, useEffect } from 'react';
import { doc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { CORPS_CLASS_ORDER, getCorpsClassDetails } from '../utils/profileCompatibility';

const SchedulePage = () => {
    const navigate = useNavigate();
    const [seasonSettings, setSeasonSettings] = useState(null);
    const [fantasyRecaps, setFantasyRecaps] = useState(null);
    const [currentDay, setCurrentDay] = useState(0);
    const [selectedWeek, setSelectedWeek] = useState(1);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchScheduleData = async () => {
            setIsLoading(true);
            try {
                const seasonDoc = await getDoc(doc(db, 'game-settings', 'season'));
                if (seasonDoc.exists()) {
                    const seasonData = seasonDoc.data();
                    setSeasonSettings(seasonData);

                    const recapsQuery = query(collection(db, 'fantasy_recaps'), where('seasonUid', '==', seasonData.seasonUid), limit(1));
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

    const handleViewRecap = (day) => navigate(`/scores?day=${day}`);
    const hasRecapForDay = (day) => fantasyRecaps?.recaps?.some(r => r.offSeasonDay === day && r.shows?.length > 0);

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
    
    const eventsForWeek = seasonSettings.events?.filter(event => {
        const eventDay = isLiveSeason ? event.dayIndex + 1 : event.offSeasonDay;
        const startDayOfWeek = (selectedWeek - 1) * 7 + 1;
        const endDayOfWeek = selectedWeek * 7;
        return eventDay >= startDayOfWeek && eventDay <= endDayOfWeek;
    }) || [];

    return (
        <div className="min-h-screen bg-background dark:bg-background-dark">
            <div className="container mx-auto px-4 py-8">
                <div className="space-y-8">
                    {/* Header and Week Selector remain the same */}
                    <div className="text-center">
                        <h1 className="text-3xl sm:text-4xl font-bold text-primary dark:text-primary-dark">Season Schedule</h1>
                        <p className="text-text-secondary dark:text-text-secondary-dark mt-2">{seasonSettings.name} • {isLiveSeason ? 'Live Season' : 'Off-Season'}</p>
                    </div>
                    <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark shadow-theme">
                        <h2 className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-4">Select Week to View</h2>
                        <div className="grid grid-cols-2 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-10 gap-2">
                            {weeks.map(week => <button key={week} onClick={() => setSelectedWeek(week)} className={`p-3 rounded-theme font-semibold transition-all ${selectedWeek === week ? 'bg-primary text-on-primary shadow-lg' : 'bg-background dark:bg-background-dark text-text-primary dark:text-text-primary-dark hover:bg-accent dark:hover:bg-accent-dark/20'}`}>Week {week}</button>)}
                        </div>
                    </div>

                    <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark shadow-theme">
                        <h2 className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-4">Week {selectedWeek} Events</h2>
                        {eventsForWeek.length === 0 ? (
                            <div className="text-center py-8"><p className="text-text-secondary dark:text-text-secondary-dark">No events scheduled this week.</p></div>
                        ) : (
                            <div className="space-y-6">
                                {eventsForWeek.map((event, eventIndex) => {
                                    const dayNumber = isLiveSeason ? event.dayIndex + 1 : event.offSeasonDay;
                                    const calendarDate = getCalendarDate(dayNumber);
                                    // NEW: Check if this is the current day
                                    const isCurrentDay = dayNumber === currentDay;

                                    return (
                                        <div key={eventIndex} className={`p-4 rounded-lg transition-colors ${isCurrentDay ? 'bg-primary/10' : ''}`}>
                                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-3">
                                                <p className="text-md text-text-secondary dark:text-text-secondary-dark">
                                                    <strong className="text-text-primary dark:text-text-primary-dark font-bold">
                                                        {calendarDate ? calendarDate.toLocaleDateString(undefined, { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric' }) : `Day ${dayNumber}`}
                                                    </strong>
                                                    <span className="ml-2">(Day {dayNumber})</span>
                                                </p>
                                                <div className="flex items-center gap-4 mt-2 sm:mt-0">
                                                    {/* NEW: "Today" badge */}
                                                    {isCurrentDay && (
                                                        <span className="text-xs bg-primary text-on-primary font-bold px-3 py-1 rounded-full">Today</span>
                                                    )}
                                                    {hasRecapForDay(dayNumber) && (
                                                        <button onClick={() => handleViewRecap(dayNumber)} className="text-sm bg-accent/50 hover:bg-accent text-text-primary dark:text-text-primary-dark font-bold py-2 px-4 rounded-theme transition-all self-start sm:self-center">View Recap</button>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                {(event.shows || []).map((show, showIndex) => (
                                                    <div key={showIndex} className="bg-background dark:bg-background-dark p-4 rounded-theme border border-accent/50 dark:border-accent-dark/20">
                                                        <h4 className="font-bold text-text-primary dark:text-text-primary-dark">{show.eventName?.replace(/DCI/g, 'marching.art')}</h4>
                                                        <p className="text-sm text-text-secondary dark:text-text-secondary-dark">📍 {show.location}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SchedulePage;