import React, { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { doc, updateDoc } from 'firebase/firestore';
import { db, appId, auth, functions } from '../../firebase';

const CAPTIONS = ["GE1", "GE2", "VP", "VA", "CG", "B", "MA", "P"];
const WEEKLY_TRADES_LIMIT = 3; // The number of trades a user gets each week.

const LineupEditor = ({ profile, corpsData, pointCap }) => {
    // 'originalLineup' stores the lineup as it was when the component loaded.
    const [originalLineup, setOriginalLineup] = useState(profile?.lineup || {});
    // 'lineup' stores the current state of the user's selections.
    const [lineup, setLineup] = useState(profile?.lineup || {});
    
    const [totalPoints, setTotalPoints] = useState(0);
    const [tradesUsed, setTradesUsed] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState('');

    // Effect to recalculate total points and trades used whenever the lineup changes.
    useEffect(() => {
        let points = 0;
        let trades = 0;
        
        CAPTIONS.forEach(caption => {
            const selectedCorpsName = lineup[caption];
            // If a corps is selected for the caption...
            if (selectedCorpsName) {
                const [_corpsName, corpsPoints] = selectedValue.split('|');
                points += Number(corpsPoints) || 0;

                // Compare the full unique value to detect a trade
                if (originalLineup[caption] !== selectedValue) {
                    trades++;
                }
            }
        });
        
        setTotalPoints(points);
        setTradesUsed(trades);
    }, [lineup, originalLineup]);

    const handleSelect = (caption, corpsName) => {
        setLineup(prev => ({ ...prev, [caption]: corpsName }));
    };

    const handleSave = async () => {
    if (tradesUsed > WEEKLY_TRADES_LIMIT) { // This local check is still useful
        setMessage("You have exceeded your trade limit for the week.");
        return;
    }

    setMessage('');
    setIsLoading(true);
    try {
        const validateAndSaveLineup = httpsCallable(functions, 'validateAndSaveLineup');
        const result = await validateAndSaveLineup({ lineup: lineup });

        setOriginalLineup(lineup); // Set the new saved lineup as the original
        setMessage(result.data.message); // Display success message from the function

    } catch (error) {
        console.error("Error saving lineup:", error);
        setMessage(error.message || "An error occurred while saving your lineup.");
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

    const uniqueCorpsValue = (corps) => `${corps.corpsName}|${corps.points}|${corps.sourceYear}`;
    const isLineupComplete = Object.keys(lineup).length === 8 && Object.values(lineup).every(Boolean);
    const tradesRemaining = WEEKLY_TRADES_LIMIT - tradesUsed;

    return (
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-md border-2 border-yellow-500 shadow-lg">
            <div className="border-b-2 border-gray-200 dark:border-gray-700 pb-4 mb-4">
                <h2 className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">{profile.corpsName}</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Lineups lock each Saturday at 12:00 PM EST.</p>
            </div>
            
            <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4 gap-2">
                <div className={`text-xl font-bold px-3 py-1 rounded ${tradesRemaining < 0 ? 'text-red-500 bg-red-100 dark:bg-red-900' : 'text-gray-800 dark:text-gray-200'}`}>
                    Trades Remaining: {tradesRemaining}
                </div>
                <div className={`text-xl font-bold px-3 py-1 rounded ${totalPoints > pointCap ? 'text-red-500 bg-red-100 dark:bg-red-900' : 'text-gray-800 dark:text-gray-200'}`}>
                    Total Points: {totalPoints} / {pointCap}
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
                                <option key={uniqueCorpsValue(corps)} value={uniqueCorpsValue(corps)}>
                                    {corps.corpsName} ({corps.sourceYear}) - {corps.points} pts
                                </option>
                            ))}
                        </select>
                    </div>
                ))}
            </div>

             <div className="mt-6 flex justify-end items-center space-x-4">
                {message && <p className="text-sm font-semibold">{message}</p>}
                <button 
                    onClick={handleSave} 
                    disabled={isLoading || totalPoints > pointCap || !isLineupComplete || tradesRemaining < 0}
                    className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-6 rounded disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                    {isLoading ? 'Saving...' : 'Save Lineup'}
                </button>
            </div>
        </div>
    );
};
export default LineupEditor;