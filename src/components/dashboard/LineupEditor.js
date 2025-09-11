import React, { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase';

const CAPTIONS = ["GE1", "GE2", "VP", "VA", "CG", "B", "MA", "P"];

const LineupEditor = ({ profile, corpsData, pointCap, seasonSettings }) => {
    const [lineup, setLineup] = useState(profile?.lineup || {});
    const [originalLineup, setOriginalLineup] = useState(profile?.lineup || {});
    const [totalPoints, setTotalPoints] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState('');

    const [tradesUsedThisWeek, setTradesUsedThisWeek] = useState(0);
    const [pendingTrades, setPendingTrades] = useState(0);
    const [tradeLimit, setTradeLimit] = useState(3);
    
    useEffect(() => {
        const seasonStartDate = seasonSettings?.schedule?.startDate?.toDate();
        if (!seasonStartDate) return;

        const diffInMillis = new Date().getTime() - seasonStartDate.getTime();
        const currentDay = Math.floor(diffInMillis / (1000 * 60 * 60 * 24)) + 1;
        const currentWeek = Math.ceil(currentDay / 7);

        let limit = 3;
        if (seasonSettings.status === 'off-season' && currentWeek === 1) limit = Infinity;
        if (seasonSettings.status === 'live-season' && [1, 2, 3].includes(currentWeek)) limit = Infinity;
        setTradeLimit(limit);

        const weeklyTrades = profile.weeklyTrades || { week: 0, used: 0 };
        if (weeklyTrades.seasonUid === seasonSettings.seasonUid && weeklyTrades.week === currentWeek) {
            setTradesUsedThisWeek(weeklyTrades.used);
        } else {
            setTradesUsedThisWeek(0);
        }

        setOriginalLineup(profile.lineup || {});
        setLineup(profile.lineup || {});
    }, [profile, seasonSettings]);

    useEffect(() => {
        let points = 0;
        let tradesInThisEdit = 0;
        
        CAPTIONS.forEach(caption => {
            const selectedValue = lineup[caption];
            if (selectedValue) {
                const [_corpsName, corpsPoints] = selectedValue.split('|');
                points += Number(corpsPoints) || 0;
                if (originalLineup[caption] !== selectedValue) {
                    tradesInThisEdit++;
                }
            }
        });
        
        setTotalPoints(points);
        setPendingTrades(tradesInThisEdit);
    }, [lineup, originalLineup]);

    const handleSave = async () => {
        setMessage('');
        setIsLoading(true);
        try {
            const validateAndSaveLineup = httpsCallable(functions, 'validateAndSaveLineup');
            const result = await validateAndSaveLineup({ lineup: lineup });
            setMessage(result.data.message);
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
                <p className="mt-4">Corps data not available. Please check back later.</p>
            </div>
        )
    }

    const totalTradesUsed = tradesUsedThisWeek + pendingTrades;
    const tradesRemaining = tradeLimit === Infinity ? 'Unlimited' : tradeLimit - totalTradesUsed;
    const hasExceededTrades = tradeLimit !== Infinity && tradesRemaining < 0;

    return (
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-md border-2 border-yellow-500 shadow-lg">
            <div className="border-b-2 border-gray-200 dark:border-gray-700 pb-4 mb-4">
                <h2 className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">{profile.corpsName}</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Lineups lock each Saturday at 12:00 PM EST.</p>
            </div>
            
            <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4 gap-2">
                <div className={`text-xl font-bold px-3 py-1 rounded ${hasExceededTrades ? 'text-red-500 bg-red-100 dark:bg-red-900' : 'text-gray-800 dark:text-gray-200'}`}>
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
                            onChange={(e) => setLineup(prev => ({...prev, [caption]: e.target.value}))}
                            className="flex-grow bg-gray-100 dark:bg-gray-900 border border-gray-400 dark:border-yellow-500 rounded p-2 text-gray-800 dark:text-yellow-300"
                        >
                            <option value="">-- Select a Corps --</option>
                            {corpsData.map(corps => {
                                const uniqueValue = `${corps.corpsName}|${corps.points}|${corps.sourceYear}`;
                                return (
                                    <option key={uniqueValue} value={uniqueValue}>
                                        {corps.corpsName} ({corps.sourceYear}) - {corps.points} pts
                                    </option>
                                );
                            })}
                        </select>
                    </div>
                ))}
            </div>

             <div className="mt-6 flex justify-end items-center space-x-4">
                {message && <p className="text-sm font-semibold">{message}</p>}
                <button 
                    onClick={handleSave} 
                    disabled={isLoading || totalPoints > pointCap || pendingTrades === 0 || hasExceededTrades}
                    className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-6 rounded disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                    {isLoading ? 'Saving...' : 'Save Lineup'}
                </button>
            </div>
        </div>
    );
};

export default LineupEditor;