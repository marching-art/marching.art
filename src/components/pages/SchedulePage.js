import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';

const SchedulePage = () => {
    const [season, setSeason] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchSchedule = async () => {
            const seasonRef = doc(db, 'game-settings', 'season');
            const seasonSnap = await getDoc(seasonRef);
            if (seasonSnap.exists()) {
                setSeason(seasonSnap.data());
            }
            setIsLoading(false);
        };
        fetchSchedule();
    }, []);
    
    if (isLoading) return <div className="p-8 text-center"><p className="text-lg font-semibold">Loading Schedule...</p></div>;
    if (!season) return <div className="p-8 text-center"><p>No active season schedule found.</p></div>;

    const eventsByWeek = (season.events || []).reduce((acc, event) => {
        const week = Math.ceil(event.offSeasonDay / 7);
        if (!acc[week]) {
            acc[week] = [];
        }
        acc[week].push(event);
        return acc;
    }, {});

    return (
        <div className="p-4 md:p-8 max-w-4xl mx-auto">
            <h1 className="text-4xl font-bold text-brand-primary dark:text-brand-primary-dark mb-6 text-center">{season.name} Schedule</h1>
            <div className="space-y-8">
                {Object.keys(eventsByWeek).map(week => (
                    <div key={week} className="bg-brand-surface dark:bg-brand-surface-dark p-6 rounded-lg border-2 border-brand-secondary shadow-lg">
                        <h2 className="text-2xl font-bold text-brand-primary dark:text-brand-secondary-dark border-b-2 border-brand-accent dark:border-brand-accent-dark pb-2 mb-4">Week {week}</h2>
                        <div className="space-y-4">
                            {eventsByWeek[week].map(day => (
                                <div key={day.offSeasonDay}>
                                    <h3 className="font-semibold text-lg text-brand-text-primary dark:text-brand-text-primary-dark">Day {day.offSeasonDay}</h3>
                                    <div className="pl-4 mt-1 space-y-2">
                                        {day.shows.map((show, index) => (
                                            <div key={index} className="p-3 bg-white dark:bg-brand-background-dark rounded-md">
                                                <p className="font-bold text-brand-text-primary dark:text-brand-secondary-dark">{show.eventName}</p>
                                                <p className="text-sm text-brand-text-secondary dark:text-brand-text-secondary-dark">{show.location} - <span className="italic">{new Date(show.date).toLocaleDateString()}</span></p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default SchedulePage;