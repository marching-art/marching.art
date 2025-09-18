import React from 'react';
import Icon from '../ui/Icon';

// A specific icon for larger Championship trophies
const ChampionshipTrophyIcon = ({ metal }) => {
    const colors = {
        gold: "text-yellow-500",
        silver: "text-gray-400",
        bronze: "text-orange-400",
    };
    const trophyPath = "M19.5 10.5c0 5.25-4.25 9.5-9.5 9.5s-9.5-4.25-9.5-9.5S5.25 1 10 1s9.5 4.25 9.5 9.5zM10 3c-1.38 0-2.5 1.12-2.5 2.5s1.12 2.5 2.5 2.5 2.5-1.12 2.5-2.5S11.38 3 10 3zm0 15c-3.86 0-7-3.14-7-7s3.14-7 7-7 7 3.14 7 7-3.14 7-7 7zm0-11c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4z";
    // NOTE: Using w-12 h-12 for a larger size
    return <Icon path={trophyPath} className={`w-12 h-12 ${colors[metal] || 'text-gray-300'}`} />;
};

// A standard icon for Regional trophies
const RegionalTrophyIcon = ({ metal }) => {
    const colors = {
        gold: "text-yellow-500",
        silver: "text-gray-400",
        bronze: "text-orange-400",
    };
    const trophyPath = "M19.5 10.5c0 5.25-4.25 9.5-9.5 9.5s-9.5-4.25-9.5-9.5S5.25 1 10 1s9.5 4.25 9.5 9.5zM10 3c-1.38 0-2.5 1.12-2.5 2.5s1.12 2.5 2.5 2.5 2.5-1.12 2.5-2.5S11.38 3 10 3zm0 15c-3.86 0-7-3.14-7-7s3.14-7 7-7 7 3.14 7 7-3.14 7-7 7zm0-11c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4z";
    // NOTE: Using w-10 h-10 for the standard size
    return <Icon path={trophyPath} className={`w-10 h-10 ${colors[metal] || 'text-gray-300'}`} />;
};

// A new, simpler icon for Finalist medals
const FinalistMedalIcon = () => {
    const medalPath = "M16.5 18.5A2.5 2.5 0 0019 16V7a2 2 0 00-2-2h- verduras.5a2.5 2.5 0 00-5 0H9a2 2 0 00-2 2v9a2.5 2.5 0 002.5 2.5h7zM9 7h7v9a.5.5 0 01-.5.5h-6A.5.5 0 019 16V7zm1-1a1 1 0 00-1 1v1h2V7a1 1 0 00-1-1zm5 0a1 1 0 00-1 1v1h2V7a1 1 0 00-1-1z";
    return <Icon path={medalPath} className="w-8 h-8 text-blue-400" />;
};


const TrophyCase = ({ trophies }) => {
    // Ensure trophies object and its arrays exist to prevent errors
    const safeTrophies = trophies || {};
    const championships = safeTrophies.championships || [];
    const regionals = safeTrophies.regionals || [];
    const finalistMedals = safeTrophies.finalistMedals || [];

    return (
        <div>
            <h3 className="text-2xl font-bold text-primary dark:text-primary-dark mb-4">Trophy Case</h3>
            <div className="space-y-6">
                <div>
                    <h4 className="font-semibold text-text-primary dark:text-text-primary-dark text-lg">Championships</h4>
                    {championships.length > 0 ? (
                        <div className="flex flex-wrap gap-4 mt-2">
                            {championships.map((t, i) => <ChampionshipTrophyIcon key={`champ-${i}`} metal={t.metal} />)}
                        </div>
                    ) : (
                        <p className="text-sm text-text-secondary dark:text-text-secondary-dark mt-1 italic">No championships won yet.</p>
                    )}
                </div>

                <div>
                    <h4 className="font-semibold text-text-primary dark:text-text-primary-dark text-lg">Regionals</h4>
                    {regionals.length > 0 ? (
                        <div className="flex flex-wrap gap-2 mt-2">
                            {regionals.map((t, i) => <RegionalTrophyIcon key={`reg-${i}`} metal={t.metal} />)}
                        </div>
                    ) : (
                        <p className="text-sm text-text-secondary dark:text-text-secondary-dark mt-1 italic">No regional titles yet.</p>
                    )}
                </div>
                
                <div>
                    <h4 className="font-semibold text-text-primary dark:text-text-primary-dark text-lg">Finalist Medals</h4>
                    {finalistMedals.length > 0 ? (
                        <div className="flex flex-wrap gap-2 mt-2">
                            {finalistMedals.map((m, i) => <FinalistMedalIcon key={`medal-${i}`} />)}
                        </div>
                    ) : (
                        <p className="text-sm text-text-secondary dark:text-text-secondary-dark mt-1 italic">No finalist appearances yet.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TrophyCase;