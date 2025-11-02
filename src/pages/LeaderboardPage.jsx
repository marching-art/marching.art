import React from 'react';
import Leaderboard from '../components/dashboard/Leaderboard';
import TabPanel from '../components/ui/TabPanel';

const LeaderboardPage = ({ profile, onViewProfile }) => {
    const tabs = [
        {
            label: 'Leaderboards',
            content: (
                <div className="p-4 md:p-8 max-w-5xl mx-auto">
                    <h1 className="text-3xl sm:text-4xl font-bold text-text-primary dark:text-text-primary-dark mb-6">
                        Leaderboards
                    </h1>
                    <Leaderboard profile={profile} onViewProfile={onViewProfile} />
                </div>
            )
        }
    ];

    return (
        <div className="page-content">
            <TabPanel tabs={tabs} defaultTab={0} />
        </div>
    );
};

export default LeaderboardPage;
