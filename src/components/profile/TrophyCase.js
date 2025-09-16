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
            bronze: "text-orange-500",
        };

        // This is a generic trophy icon path, you can customize it as needed.
        const trophyPath = "M13.5 6H12V4.125C12 3.504 11.496 3 10.875 3H7.125C6.504 3 6 3.504 6 4.125V6H4.5c-.828 0-1.5.672-1.5 1.5v3c0 .828.672 1.5 1.5 1.5H6v1.125c0 .621.504 1.125 1.125 1.125h3.75c.621 0 1.125-.504 1.125-1.125V12h1.5c.828 0 1.5-.672 1.5-1.5v-3c0-.828-.672-1.5-1.5-1.5zM9 4.5h-.75V6H9V4.5zM7.5 6V4.5H6.75V6H7.5z";

        return <Icon path={trophyPath} className={`w-8 h-8 ${colors[type] || 'text-gray-300'}`} />;
    };

    return (
        // UPDATED: Main container uses theme variables.
        <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border-theme border-secondary shadow-theme">
            {/* UPDATED: Title uses primary theme color. */}
            <h3 className="text-2xl font-bold text-primary dark:text-primary-dark mb-4">Trophy Case</h3>
            <div className="space-y-4">
                <div>
                    {/* UPDATED: Subtitle uses primary text theme color. */}
                    <h4 className="font-semibold text-text-primary">Championships</h4>
                    {safeTrophies.championships.length > 0 ? (
                        <div className="flex flex-wrap gap-2 mt-2">
                            {safeTrophies.championships.map((t, i) => <TrophyIcon key={`champ-${i}`} type={t} />)}
                        </div>
                    ) : (
                        <p className="text-sm text-text-secondary mt-1 italic">No championships won yet.</p>
                    )}
                </div>
                <div>
                    <h4 className="font-semibold text-text-primary">Regionals</h4>
                    {safeTrophies.regionals.length > 0 ? (
                        <div className="flex flex-wrap gap-2 mt-2">
                            {safeTrophies.regionals.map((t, i) => <TrophyIcon key={`reg-${i}`} type={t} />)}
                        </div>
                    ) : (
                        <p className="text-sm text-text-secondary mt-1 italic">No regional titles yet.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TrophyCase;