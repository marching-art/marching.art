// src/components/dashboard/MyStatus.js - UPDATED WITH SOUNDSPORT SUPPORT
import React, { useState, useEffect } from 'react';
import { getAllUserCorps, CORPS_CLASSES, CORPS_CLASS_ORDER, getSoundSportRating } from '../../utils/profileCompatibility';

const MyStatus = ({ username, profile }) => {
    const [userCorps, setUserCorps] = useState({});
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (profile) {
            const corps = getAllUserCorps(profile);
            setUserCorps(corps);
            setIsLoading(false);
        }
    }, [profile]);

    const StatCard = ({ label, value, color, large = false, isSoundSport = false, score = 0 }) => {
        // For SoundSport, display rating instead of numeric score
        if (isSoundSport && score > 0) {
            const { rating, color: ratingColor } = getSoundSportRating(score);
            return (
                <div className="bg-background dark:bg-background-dark p-4 rounded-theme text-center">
                    <div className="flex items-center justify-center gap-2 mb-2">
                        {color && <div className={`w-3 h-3 rounded-full ${color}`}></div>}
                        <p className="text-sm font-semibold text-text-secondary dark:text-text-secondary-dark">{label}</p>
                    </div>
                    {isLoading ? (
                        <div className="h-8 mt-1 bg-surface dark:bg-surface-dark rounded animate-pulse w-3/4 mx-auto"></div>
                    ) : (
                        <div className="flex flex-col items-center">
                            <p className={`text-xl font-bold ${ratingColor}`}>{rating}</p>
                            <p className="text-xs text-text-secondary dark:text-text-secondary-dark mt-1">
                                ({score.toFixed(2)} pts)
                            </p>
                        </div>
                    )}
                </div>
            );
        }

        // Standard display for other classes
        return (
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
    };

    const orderedCorpsToDisplay = CORPS_CLASS_ORDER.filter(key => userCorps[key]);

    return (
        <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border-theme border-accent dark:border-accent-dark shadow-theme">
            <h2 className="text-3xl font-bold text-text-primary dark:text-text-primary-dark">
                Welcome back, <span className="text-primary dark:text-primary-dark">{username}!</span>
            </h2>
            <p className="text-text-secondary dark:text-text-secondary-dark mb-4">Here are your current corps scores for the season.</p>
            
            {Object.keys(userCorps).length === 0 ? (
                <div className="text-center py-8">
                    <p className="text-text-secondary dark:text-text-secondary-dark">No corps have been created yet. Start your first corps below!</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {orderedCorpsToDisplay.map(key => {
                        const corps = userCorps[key];
                        const classInfo = CORPS_CLASSES[key];
                        const score = corps.totalSeasonScore || 0;
                        const isSoundSport = key === 'soundSport';
                        
                        return (
                            <StatCard
                                key={key}
                                label={classInfo.name}
                                value={isSoundSport ? '' : score.toFixed(2)}
                                color={classInfo.color}
                                isSoundSport={isSoundSport}
                                score={score}
                            />
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default MyStatus;
