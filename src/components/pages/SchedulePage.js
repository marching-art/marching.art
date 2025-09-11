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

    // Group events by week
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
            <h1 className="text-4xl font-bold text-yellow-800 dark:text-yellow-300 mb-6 text-center">{season.name} Schedule</h1>
            <div className="space-y-8">
                {Object.keys(eventsByWeek).map(week => (
                    <div key={week} className="bg-white dark:bg-gray-800 p-6 rounded-md border-2 border-yellow-500 shadow-lg">
                        <h2 className="text-2xl font-bold text-yellow-700 dark:text-yellow-400 border-b-2 border-gray-200 dark:border-gray-700 pb-2 mb-4">Week {week}</h2>
                        <div className="space-y-4">
                            {eventsByWeek[week].map(day => (
                                <div key={day.offSeasonDay}>
                                    <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-200">Day {day.offSeasonDay}</h3>
                                    <div className="pl-4 mt-1 space-y-2">
                                        {day.shows.map((show, index) => (
                                            <div key={index} className="p-2 bg-gray-50 dark:bg-gray-900 rounded-md">
                                                <p className="font-bold text-gray-900 dark:text-yellow-200">{show.eventName}</p>
                                                <p className="text-sm text-gray-500 dark:text-gray-400">{show.location} - <span className="italic">{new Date(show.date).toLocaleDateString()}</span></p>
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