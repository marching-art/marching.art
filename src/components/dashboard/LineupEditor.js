import React, { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions, appId } from '../../firebase';

const CAPTIONS = ["GE1", "GE2", "VP", "VA", "CG", "B", "MA", "P"];
const DEFAULT_POINT_CAP = 150;

const LineupEditor = ({ profile, corpsData }) => {
    const [lineup, setLineup] = useState(profile?.lineup || {});
    const [totalPoints, setTotalPoints] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        const points = CAPTIONS.reduce((sum, caption) => {
            const corpsName = lineup[caption];
            if (corpsName) {
                const corps = corpsData.find(c => c.corpsName === corpsName);
                return sum + (corps?.points || 0);
            }
            return sum;
        }, 0);
        setTotalPoints(points);
    }, [lineup, corpsData]);

    const handleSelect = (caption, corpsName) => {
        setLineup(prev => ({ ...prev, [caption]: corpsName }));
    };

    const handleSave = async () => {
        setMessage('');
        setIsLoading(true);
        try {
            const saveLineupFunc = httpsCallable(functions, 'saveLineup');
            const result = await saveLineupFunc({ lineup, totalPoints, appId });
            setMessage(result.data.message);
        } catch (error) {
            console.error("Error saving lineup:", error);
            setMessage(error.message);
        }
        setIsLoading(false);
    };

    if (!corpsData || corpsData.length === 0) {
        return (
             <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-md border-2 border-yellow-500 shadow-lg">
                <h2 className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">My Lineup</h2>
                <p className="mt-4">Corps data for the current season is not available yet. Please check back later.</p>
            </div>
        )
    }

    return (
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-md border-2 border-yellow-500 shadow-lg">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4 gap-2">
                <h2 className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">My Lineup</h2>
                <div className={`text-xl font-bold ${totalPoints > DEFAULT_POINT_CAP ? 'text-red-500' : 'text-gray-800 dark:text-gray-200'}`}>
                    Total Points: {totalPoints} / {DEFAULT_POINT_CAP}
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {CAPTIONS.map(caption => (
                    <div key={caption} className="flex items-center">
                        <label className="w-12 font-semibold">{caption}:</label>
                        <select 
                            value={lineup[caption] || ''} 
                            onChange={(e) => handleSelect(caption, e.target.value)}
                            className="flex-grow bg-gray-100 dark:bg-gray-900 border border-gray-400 dark:border-yellow-500 rounded p-2 text-gray-800 dark:text-yellow-300"
                        >
                            <option value="">-- Select a Corps --</option>
                            {corpsData.map(corps => (
                                <option key={corps.corpsName} value={corps.corpsName}>{corps.corpsName} ({corps.points})</option>
                            ))}
                        </select>
                    </div>
                ))}
            </div>
             <div className="mt-6 flex justify-end items-center space-x-4">
                {message && <p className="text-sm font-semibold">{message}</p>}
                <button 
                    onClick={handleSave} 
                    disabled={isLoading || totalPoints > DEFAULT_POINT_CAP || Object.values(lineup).length < 8 || Object.values(lineup).some(c => !c)}
                    className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-6 rounded disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                    {isLoading ? 'Saving...' : 'Save Lineup'}
                </button>
            </div>
        </div>
    );
};
export default LineupEditor;