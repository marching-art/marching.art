import React from 'react';
import { useUserStore } from '../../store/userStore'; // Import the store hook
import { getAllUserCorps, CORPS_CLASSES, CORPS_CLASS_ORDER } from '../../utils/profileCompatibility';

const MyStatus = () => {
    const { loggedInProfile, isLoadingAuth } = useUserStore();
    
    const userCorps = loggedInProfile ? getAllUserCorps(loggedInProfile) : {};
    const username = loggedInProfile?.username || '';
    
    const StatCard = ({ label, value, color, large = false }) => (
        <div className="bg-background dark:bg-background-dark p-4 rounded-theme text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
                {color && <div className={`w-3 h-3 rounded-full ${color}`}></div>}
                <p className="text-sm font-semibold text-text-secondary dark:text-text-secondary-dark">{label}</p>
            </div>
            {isLoading ? (
                <div className="h-8 mt-1 bg-surface dark:bg-surface-dark rounded animate-pulse w-3/4 mx-auto"></div>
            ) : (
                <p className={`${large ? 'text-2xl' : 'text-xl'} font-bold text-primary dark:text-primary-dark`}>{value}</p>
            )}
        </div>
    );

    const orderedCorpsToDisplay = CORPS_CLASS_ORDER.filter(key => userCorps[key]);

    return (
        <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border-theme border-accent dark:border-accent-dark shadow-theme">
            <h2 className="text-3xl font-bold text-text-primary dark:text-text-primary-dark">
                Welcome back, <span className="text-primary dark:text-primary-dark">{username}!</span>
            </h2>
            <p className="text-text-secondary dark:text-text-secondary-dark mb-4">Here are your current corps scores for the season.</p>
            
            {isLoadingAuth ? (
                 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="h-24 bg-background dark:bg-background-dark rounded-theme animate-pulse"></div>
                    <div className="h-24 bg-background dark:bg-background-dark rounded-theme animate-pulse"></div>
                    <div className="h-24 bg-background dark:bg-background-dark rounded-theme animate-pulse"></div>
                 </div>
            ) : Object.keys(userCorps).length === 0 ? (
                <div className="text-center py-8">
                    <p className="text-text-secondary dark:text-text-secondary-dark">No corps have been created yet. Visit the Lineup Editor to get started!</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {orderedCorpsToDisplay.map(corpsClassKey => {
                        const corps = userCorps[corpsClassKey];
                        return (
                             <StatCard 
                                key={corpsClassKey}
                                label={`${CORPS_CLASSES[corpsClassKey]?.name || corpsClassKey}`}
                                value={`${(corps.totalSeasonScore || 0).toFixed(3)}`}
                                color={CORPS_CLASSES[corpsClassKey]?.color}
                                large={Object.keys(userCorps).length === 1}
                            />
                        )
                    })}
                </div>
            )}
        </div>
    );
};

export default MyStatus;