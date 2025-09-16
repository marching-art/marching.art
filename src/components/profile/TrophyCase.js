import React from 'react';
import Icon from '../ui/Icon';

const TrophyCase = ({ trophies }) => {
    const safeTrophies = trophies || { championships: [], regionals: [] };
    
    const TrophyIcon = ({ type }) => {
        // DESIGN NOTE: Trophy colors like gold, silver, and bronze have universal meaning.
        // We are intentionally NOT using the theme system for these specific colors,
        // so that they remain consistent and instantly recognizable across all themes.
        const colors = {
            gold: "text-yellow-500",
            silver: "text-gray-400",
            bronze: "text-orange-400",
        };

        const trophyPath = "M19.5 10.5c0 5.25-4.25 9.5-9.5 9.5s-9.5-4.25-9.5-9.5S5.25 1 10 1s9.5 4.25 9.5 9.5zM10 3c-1.38 0-2.5 1.12-2.5 2.5s1.12 2.5 2.5 2.5 2.5-1.12 2.5-2.5S11.38 3 10 3zm0 15c-3.86 0-7-3.14-7-7s3.14-7 7-7 7 3.14 7 7-3.14 7-7 7zm0-11c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4z";

        return <Icon path={trophyPath} className={`w-10 h-10 ${colors[type] || 'text-gray-300'}`} />;
    };

    return (
        <div>
            <h3 className="text-2xl font-bold text-primary dark:text-primary-dark mb-4">Trophy Case</h3>
            <div className="space-y-4">
                <div>
                    <h4 className="font-semibold text-text-primary dark:text-text-primary-dark">Championships</h4>
                    {safeTrophies.championships.length > 0 ? (
                        <div className="flex flex-wrap gap-2 mt-2">
                            {safeTrophies.championships.map((t, i) => <TrophyIcon key={`champ-${i}`} type={t} />)}
                        </div>
                    ) : (
                        <p className="text-sm text-text-secondary dark:text-text-secondary-dark mt-1 italic">No championships won yet.</p>
                    )}
                </div>
                <div>
                    <h4 className="font-semibold text-text-primary dark:text-text-primary-dark">Regionals</h4>
                    {safeTrophies.regionals.length > 0 ? (
                        <div className="flex flex-wrap gap-2 mt-2">
                            {safeTrophies.regionals.map((t, i) => <TrophyIcon key={`reg-${i}`} type={t} />)}
                        </div>
                    ) : (
                        <p className="text-sm text-text-secondary dark:text-text-secondary-dark mt-1 italic">No regional titles yet.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TrophyCase;