import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';

const SchedulePage = ({ setPage }) => {
    const [season, setSeason] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [fantasyRecaps, setFantasyRecaps] = useState(null);

    useEffect(() => {
        const fetchSeasonData = async () => {
            setIsLoading(true);
            try {
                const seasonRef = doc(db, 'game-settings', 'season');
                const seasonSnap = await getDoc(seasonRef);
                
                if (seasonSnap.exists()) {
                    const seasonData = seasonSnap.data();
                    setSeason(seasonData);

                    const recapRef = doc(db, 'fantasy_recaps', seasonData.seasonUid);
                    const recapSnap = await getDoc(recapRef);
                    if (recapSnap.exists()) {
                        const recapsMap = new Map();
                        recapSnap.data().recaps.forEach(recap => {
                            recapsMap.set(recap.offSeasonDay, recap);
                        });
                        setFantasyRecaps(recapsMap);
                    }
                }
            } catch (error) {
                console.error("Error fetching season data:", error);
            }
            setIsLoading(false);
        };
        fetchSeasonData();
    }, []);
    
    if (isLoading) return <div className="p-8 text-center"><p className="text-lg font-semibold text-text-primary">Loading Schedule...</p></div>;
    if (!season || !season.schedule?.startDate) return <div className="p-8 text-center"><p className="text-text-secondary">No active season schedule found.</p></div>;

    const getCalendarDateForDay = (offSeasonDay) => {
        const startDate = season.schedule.startDate.toDate();
        const calendarDate = new Date(startDate.getTime());
        calendarDate.setUTCDate(calendarDate.getUTCDate() + offSeasonDay - 1);
        return calendarDate;
    };

    const eventsByWeek = (season.events || []).reduce((acc, event) => {
        const week = Math.ceil(event.offSeasonDay / 7);
        if (!acc[week]) {
            acc[week] = [];
        }
        acc[week].push(event);
        return acc;
    }, {});

    return (
        <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
            <h1 className="text-4xl font-bold text-primary dark:text-primary-dark mb-6 text-center">{season.name}</h1>
            <div className="space-y-10">
                {Object.keys(eventsByWeek).map(week => (
                    <div key={week} className="bg-surface dark:bg-surface-dark p-6 rounded-theme border-theme border-secondary shadow-theme">
                        <h2 className="text-3xl font-bold text-primary dark:text-primary-dark border-b-theme border-accent pb-3 mb-4">Week {week}</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {eventsByWeek[week].sort((a, b) => a.offSeasonDay - b.offSeasonDay).map(day => {
                                const calendarDate = getCalendarDateForDay(day.offSeasonDay);
                                const hasResults = fantasyRecaps?.has(day.offSeasonDay);
                                
                                return (
                                    <div key={day.offSeasonDay} className="flex flex-col bg-background dark:bg-background-dark p-4 rounded-theme border-theme border-accent">
                                        <div className="flex justify-between items-center border-b-theme border-accent pb-2 mb-3">
                                            <h3 className="font-bold text-lg text-text-primary">
                                                {calendarDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' })}
                                            </h3>
                                            {hasResults && (
                                                <button onClick={() => setPage('scores')} className="text-sm font-semibold text-secondary hover:underline">
                                                    View Results
                                                </button>
                                            )}
                                        </div>
                                        <div className="space-y-3 flex-grow">
                                            {day.shows.length > 0 ? day.shows.map((show, index) => (
                                                <div key={index} className="text-sm">
                                                    <p className="font-bold text-text-primary">{show.eventName.replace(/DCI/g, 'marching.art')}</p>
                                                    <p className="text-xs text-text-secondary">{show.location}</p>
                                                </div>
                                            )) : (
                                                <p className="text-sm text-text-secondary italic">No shows scheduled.</p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default SchedulePage;