// src/components/pages/SchedulePage.js
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

    // Render logic would go here. You would map over `season.events`,
    // group them by week, and display each show's name, date, and location.
    // You could also list which corps are performing at each show.
    
    if (isLoading) return <p>Loading Schedule...</p>;
    if (!season) return <p>No active season schedule found.</p>;

    return (
        <div>
            <h1 className="text-4xl font-bold">{season.name} Schedule</h1>
            {/* ... JSX to render the schedule ... */}
        </div>
    );
};

export default SchedulePage;