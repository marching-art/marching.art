// src/components/pages/ScoresPage.js
import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';

const ScoresPage = () => {
    const [latestScores, setLatestScores] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    
    useEffect(() => {
        const fetchLatestScores = async () => {
            // This logic is more complex. You would likely need another collection
            // e.g., 'daily_recaps', that your nightly cloud function writes to.
            // For now, we'll simulate fetching from the season document.
            
            const seasonRef = doc(db, 'game-settings', 'season');
            const seasonSnap = await getDoc(seasonRef);

            if (seasonSnap.exists()) {
                const seasonData = seasonSnap.data();
                const seasonStartDate = seasonData.schedule.startDate.toDate();
                const diff = new Date().getTime() - seasonStartDate.getTime();
                // Get *yesterday's* scores
                const lastScoredDay = Math.floor(diff / (1000 * 60 * 60 * 24)); 

                if (lastScoredDay > 0 && seasonData.events) {
                    const eventData = seasonData.events.find(e => e.offSeasonDay === lastScoredDay);
                    // You would process and set the scores here
                    setLatestScores(eventData?.shows || []);
                }
            }
            setIsLoading(false);
        };
        fetchLatestScores();
    }, []);

    // Render logic would map over `latestScores` and display a simplified
    // recap for each show: eventName, and a list of corps with their total score and
    // combined GE, Visual, and Music scores.

    if (isLoading) return <p>Loading Latest Scores...</p>;

    return (
        <div>
            <h1 className="text-4xl font-bold">Latest Show Recaps</h1>
            {/* ... JSX to render simplified score recaps ... */}
        </div>
    );
};

export default ScoresPage;