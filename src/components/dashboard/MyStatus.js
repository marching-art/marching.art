import React, { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase';

const MyStatus = ({ username }) => {
    const [stats, setStats] = useState({ globalRank: '...', totalPlayers: '...', totalScore: '...' });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchRank = async () => {
            try {
                const getUserRankings = httpsCallable(functions, 'getUserRankings');
                const result = await getUserRankings();
                setStats(result.data);
            } catch (error) {
                console.error("Error fetching user rank:", error);
                setStats({ globalRank: 'N/A', totalPlayers: 'N/A', totalScore: 'N/A' });
            }
            setIsLoading(false);
        };
        fetchRank();
    }, []);

    const StatCard = ({ label, value, large = false }) => (
        <div className="bg-background dark:bg-background-dark p-4 rounded-theme text-center">
            <p className="text-sm font-semibold text-text-secondary dark:text-text-secondary-dark">{label}</p>
            {isLoading ? (
                <div className="h-8 mt-1 bg-surface dark:bg-surface-dark rounded animate-pulse w-3/4 mx-auto"></div>
            ) : (
                <p className={`${large ? 'text-4xl' : 'text-2xl'} font-bold text-primary dark:text-primary-dark`}>{value}</p>
            )}
        </div>
    );

    return (
        <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border-theme border-accent dark:border-accent-dark shadow-theme">
            <h2 className="text-3xl font-bold text-text-primary dark:text-text-primary-dark">
                Welcome back, <span className="text-primary dark:text-primary-dark">{username}!</span>
            </h2>
            <p className="text-text-secondary dark:text-text-secondary-dark mb-4">Here's your current status for the season.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard label="Total Score" value={typeof stats.totalScore === 'number' ? stats.totalScore.toFixed(3) : '...'} large />
                <StatCard label="Global Rank" value={`${stats.globalRank}`} />
                <StatCard label="Total Players" value={stats.totalPlayers} />
            </div>
        </div>
    );
};

export default MyStatus;