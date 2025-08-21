import React from 'react';
import Icon from '../ui/Icon';

const TrophyCase = ({ trophies }) => {
    const safeTrophies = trophies || { championships: [], regionals: [] };
    const TrophyIcon = ({ type }) => {
        const colors = {
            gold: "text-yellow-500",
            silver: "text-gray-400",
            bronze: "text-orange-500",
        };
        return <Icon path="M16.5 18.75h-9a9.75 9.75 0 001.05-3.055 9.75 9.75 0 00-1.05-3.055h9a9.75 9.75 0 00-1.05 3.055 9.75 9.75 0 001.05 3.055zM18.75 9.75h.008v.008h-.008V9.75z" className={`w-8 h-8 ${colors[type]}`} />;
    };

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-md border-2 border-yellow-500 shadow-lg">
            <h3 className="text-2xl font-bold text-yellow-700 dark:text-yellow-400 mb-4">Trophy Case</h3>
            <div className="space-y-4">
                <div>
                    <h4 className="font-semibold text-gray-800 dark:text-gray-200">Championships</h4>
                    <div className="flex space-x-2 mt-2">
                        {safeTrophies.championships.map((t, i) => <TrophyIcon key={`champ-${i}`} type={t} />)}
                    </div>
                </div>
                <div>
                    <h4 className="font-semibold text-gray-800 dark:text-gray-200">Regionals</h4>
                    <div className="flex space-x-2 mt-2">
                        {safeTrophies.regionals.map((t, i) => <TrophyIcon key={`reg-${i}`} type={t} />)}
                    </div>
                </div>
            </div>
        </div>
    );
};
export default TrophyCase;