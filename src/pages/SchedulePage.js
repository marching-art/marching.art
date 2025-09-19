import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { CORPS_CLASS_ORDER, getCorpsClassDetails } from '../utils/profileCompatibility';

const SchedulePage = () => {
    const navigate = useNavigate();
    const [seasonSettings, setSeasonSettings] = useState(null);
    const [fantasyRecaps, setFantasyRecaps] = useState(null); // Still needed for "View Recap" button
    const [currentDay, setCurrentDay] = useState(0);
    const [selectedWeek, setSelectedWeek] = useState(1);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // NOTE: This fetch is now the single source of truth for schedule AND counts.
        const fetchScheduleData = async () => {
            setIsLoading(true);
            try {
                const seasonDoc = await getDoc(doc(db, 'game-settings', 'season'));
                if (seasonDoc.exists()) {
                    const seasonData = seasonDoc.data();
                    setSeasonSettings(seasonData);

                    // Fetch recaps only to know if a "View Recap" button should be shown
                    // This can be optimized in the future if needed
                    const recapsQuery = query(collection(db, 'fantasy_recaps'), where('seasonUid', '==', seasonData.seasonUid), limit(1));
                    const recapsSnapshot = await getDocs(recapsQuery);
                    if (!recapsSnapshot.empty) {
                        setFantasyRecaps(recapsSnapshot.docs[0].data());
                    }

                    if (seasonData.schedule?.startDate) {
                        const startDate = seasonData.schedule.startDate.toDate();
                        const diffInMillis = new Date().getTime() - startDate.getTime();
                        const day = Math.floor(diffInMillis / (1000 * 60 * 60 * 24)) + 1;
                        const currentWeek = Math.ceil(Math.max(1, day) / 7);
                        setCurrentDay(Math.max(1, day));
                        setSelectedWeek(currentWeek);
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

    // ... Loading and No Season states ...
    if (isLoading) { return <div>Loading...</div>; }
    if (!seasonSettings) { return <div>No Active Season</div>; }

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
                    {/* Header and Week Selector can remain the same */}
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
                                    return (
                                        <div key={eventIndex} className="border-l-4 border-primary dark:border-primary-dark pl-4">
                                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-3">
                                                <p className="text-md text-text-secondary dark:text-text-secondary-dark">
                                                    {calendarDate && (<strong className="text-text-primary dark:text-text-primary-dark font-bold">{calendarDate.toLocaleDateString(undefined, { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric' })}</strong>)}
                                                    <span className="ml-2">(Day {dayNumber})</span>
                                                </p>
                                                {hasRecapForDay(dayNumber) && (<button onClick={() => handleViewRecap(dayNumber)} className="mt-2 sm:mt-0 text-sm bg-primary/10 hover:bg-primary/20 text-primary dark:text-primary-dark font-bold py-2 px-4 rounded-theme transition-all self-start sm:self-center">View Recap</button>)}
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                {(event.shows || []).map((show, showIndex) => {
                                                    // **THIS IS THE KEY CHANGE:** Reading counts directly from the `show` object
                                                    const corpsCounts = show.registrationCounts || {};
                                                    return (
                                                        <div key={showIndex} className="bg-background dark:bg-background-dark p-4 rounded-theme border border-accent/50 dark:border-accent-dark/20">
                                                            <h4 className="font-bold text-text-primary dark:text-text-primary-dark">{show.eventName?.replace(/DCI/g, 'marching.art')}</h4>
                                                            <p className="text-sm text-text-secondary dark:text-text-secondary-dark mb-3">📍 {show.location}</p>
                                                            <div className="flex items-center gap-3 text-xs border-t border-accent/50 dark:border-accent-dark/20 pt-3">
                                                                {CORPS_CLASS_ORDER.map(classKey => {
                                                                    const classDetails = getCorpsClassDetails(classKey);
                                                                    const count = corpsCounts[classKey] || 0;
                                                                    return (
                                                                        <span key={classKey} className="flex items-center gap-1.5" title={`${count} ${classDetails.name} Corps Registered`}>
                                                                            <div className={`w-2 h-2 rounded-full ${classDetails.color}`}></div>
                                                                            <span className="font-semibold text-text-primary dark:text-text-primary-dark">{count}</span>
                                                                        </span>
                                                                    )
                                                                })}
                                                            </div>
                                                        </div>
                                                    )
                                                })}
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