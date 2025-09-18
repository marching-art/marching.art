import React from 'react';
import Leaderboard from '../components/dashboard/Leaderboard';

const LeaderboardPage = ({ profile, onViewProfile }) => {
    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
            <h1 className="text-3xl sm:text-4xl font-bold text-text-primary dark:text-text-primary-dark">
                Leaderboards
            </h1>
            <Leaderboard profile={profile} onViewProfile={onViewProfile} />
        </div>
    );
};

export default LeaderboardPage;
