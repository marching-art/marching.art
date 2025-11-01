// src/components/dashboard/SoundSportDisplay.js
// Component for displaying SoundSport ratings instead of numeric scores
import React from 'react';
import { getSoundSportRating } from '../../utils/profileCompatibility';

const SoundSportRatingBadge = ({ score }) => {
    const { rating, color } = getSoundSportRating(score);
    
    return (
        <div className="inline-flex items-center gap-2">
            <span className={`text-2xl font-bold ${color}`}>{rating}</span>
            <span className="text-sm text-text-secondary dark:text-text-secondary-dark">
                ({score.toFixed(2)})
            </span>
        </div>
    );
};

const SoundSportScoreCard = ({ corpsName, score }) => {
    const { rating, color } = getSoundSportRating(score);
    
    return (
        <div className="bg-surface dark:bg-surface-dark p-4 rounded-theme border-theme border-accent dark:border-accent-dark">
            <h3 className="text-lg font-semibold text-text-primary dark:text-text-primary-dark mb-2">
                {corpsName}
            </h3>
            <div className="flex items-baseline gap-2">
                <span className={`text-4xl font-bold ${color}`}>{rating}</span>
                <span className="text-text-secondary dark:text-text-secondary-dark">Rating</span>
            </div>
            <div className="mt-2 text-sm text-text-secondary dark:text-text-secondary-dark">
                Based on {score.toFixed(2)} points
            </div>
        </div>
    );
};

export { SoundSportRatingBadge, SoundSportScoreCard, getSoundSportRating };
