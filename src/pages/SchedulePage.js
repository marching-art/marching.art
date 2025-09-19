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
        const date = new Date(startDate);
        date.setDate(date.getDate() + dayOffset - 1);
        return date;
    };
    
    const getCorpsCountsForShow = (eventName, day) => {
        const dayData = fantasyRecaps?.recaps?.find(r => r.offSeasonDay === day);
        const showData = dayData?.shows?.find(s => s.eventName === eventName);

        if (!showData || !showData.results) {
            return null;
        }

        return showData.results.reduce((acc, result) => {
            if (acc[result.corpsClass] !== undefined) {
                acc[result.corpsClass]++;
            }
            return acc;
        }, { worldClass: 0, openClass: 0, aClass: 0 });
    };

    const handleViewRecap = (day) => {
        navigate(`/scores?day=${day}`);
    };

    const hasRecapForDay = (day) => {
        return fantasyRecaps?.recaps?.some(r => r.offSeasonDay === day && r.shows?.length > 0);
    };

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
                    <div className="text-center">
                        <h1 className="text-3xl sm:text-4xl font-bold text-primary dark:text-primary-dark">
                            Season Schedule
                        </h1>
                        <p className="text-text-secondary dark:text-text-secondary-dark mt-2">
                            {seasonSettings.name} • {isLiveSeason ? 'Live Season' : 'Off-Season'}
                        </p>
                    </div>

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
                            <div className="space-y-6">
                                {eventsForWeek.map((event, eventIndex) => {
                                    const dayNumber = isLiveSeason ? event.dayIndex + 1 : event.offSeasonDay;
                                    const calendarDate = getCalendarDate(dayNumber);
                                    return (
                                        <div key={eventIndex} className="border-l-4 border-primary dark:border-primary-dark pl-4">
                                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-3">
                                                <p className="text-md text-text-secondary dark:text-text-secondary-dark">
                                                    {calendarDate && (
                                                        <strong className="text-text-primary dark:text-text-primary-dark font-bold">
                                                            {calendarDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                                                        </strong>
                                                    )}
                                                    <span className="ml-2">(Day {dayNumber})</span>
                                                </p>
                                                {hasRecapForDay(dayNumber) && (
                                                    <button 
                                                        onClick={() => handleViewRecap(dayNumber)}
                                                        className="mt-2 sm:mt-0 text-sm bg-primary/10 hover:bg-primary/20 text-primary dark:text-primary-dark font-bold py-2 px-4 rounded-theme transition-all self-start sm:self-center"
                                                    >
                                                        View Recap
                                                    </button>
                                                )}
                                            </div>
                                            
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                {(event.shows || []).map((show, showIndex) => {
                                                    const corpsCounts = getCorpsCountsForShow(show.eventName || show.name, dayNumber);
                                                    return(
                                                        <div key={showIndex} className="bg-background dark:bg-background-dark p-4 rounded-theme border border-accent/50 dark:border-accent-dark/20">
                                                            <h4 className="font-bold text-text-primary dark:text-text-primary-dark">
                                                                {show.eventName?.replace(/DCI/g, 'marching.art') || show.name?.replace(/DCI/g, 'marching.art')}
                                                            </h4>
                                                            <p className="text-sm text-text-secondary dark:text-text-secondary-dark mb-3">
                                                                📍 {show.location}
                                                            </p>

                                                            {corpsCounts && (
                                                                <div className="flex items-center gap-3 text-xs border-t border-accent/50 dark:border-accent-dark/20 pt-3">
                                                                    {CORPS_CLASS_ORDER.map(classKey => {
                                                                        const classDetails = getCorpsClassDetails(classKey);
                                                                        const count = corpsCounts[classKey];
                                                                        if (count > 0) {
                                                                            return (
                                                                                <span key={classKey} className="flex items-center gap-1.5" title={`${classDetails.name} Corps`}>
                                                                                    <div className={`w-2 h-2 rounded-full ${classDetails.color}`}></div>
                                                                                    <span className="font-semibold text-text-primary dark:text-text-primary-dark">{count}</span>
                                                                                </span>
                                                                            )
                                                                        }
                                                                        return null;
                                                                    })}
                                                                </div>
                                                            )}
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