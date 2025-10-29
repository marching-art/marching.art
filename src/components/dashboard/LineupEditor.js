import React, { useState, useEffect } from 'react';
import { validateAndSaveLineup } from '../../utils/api';

const CAPTIONS = ["GE1", "GE2", "VP", "VA", "CG", "B", "MA", "P"];

const LineupEditor = ({ profile, corpsData, pointCap, seasonSettings, corpsClass, corpsClassName, onCorpsCreated }) => {
    const [corpsName, setCorpsName] = useState('');
    const [lineup, setLineup] = useState({});
    const [originalLineup, setOriginalLineup] = useState({});
    const [totalPoints, setTotalPoints] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [tradesUsedThisWeek, setTradesUsedThisWeek] = useState(0);
    const [pendingTrades, setPendingTrades] = useState(0);
    const [tradeLimit, setTradeLimit] = useState(3);
    
    const isNewCorps = !profile || !profile.corpsName;
    
    useEffect(() => {
        if (profile) {
            setCorpsName(profile.corpsName || '');
            const currentLineup = profile.lineup || {};
            setLineup(currentLineup);
            setOriginalLineup(currentLineup);
        } else {
            setCorpsName('');
            setLineup({});
            setOriginalLineup({});
        }
    }, [profile, corpsClass]);

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

        if (profile) {
            const weeklyTrades = profile.weeklyTrades || { week: 0, used: 0 };
            if (weeklyTrades.seasonUid === seasonSettings.seasonUid && weeklyTrades.week === currentWeek) {
                setTradesUsedThisWeek(weeklyTrades.used);
            } else {
                setTradesUsedThisWeek(0);
            }
        }
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
        if (isNewCorps && !corpsName.trim()) {
            setMessage('Corps name is required!');
            return;
        }
        
        setMessage('');
        setIsLoading(true);
        try {
            const result = await validateAndSaveLineup({ 
                lineup: lineup,
                corpsName: corpsName.trim(),
                corpsClass: corpsClass
            });
            setMessage(result.data.message);
            
            if (isNewCorps && onCorpsCreated) {
                onCorpsCreated({
                    corpsName: corpsName.trim(),
                    lineup: lineup,
                    totalSeasonScore: 0,
                    selectedShows: {},
                    weeklyTrades: { used: 0 },
                    lastScoredDay: 0
                });
            }
        } catch (error) {
            console.error("Error saving lineup:", error);
            setMessage(error.message || "An error occurred while saving your lineup.");
        }
        setIsLoading(false);
    };

    if (!corpsData || corpsData.length === 0) {
        return (
            <div>
                <h2 className="text-xl sm:text-2xl font-bold text-primary dark:text-primary-dark">{corpsClassName} Lineup</h2>
                <p className="mt-4 text-text-secondary dark:text-text-secondary-dark">Corps data not available. Please check back later.</p>
            </div>
        );
    }

    const totalTradesUsed = tradesUsedThisWeek + pendingTrades;
    const tradesRemaining = tradeLimit === Infinity ? 'Unlimited' : tradeLimit - totalTradesUsed;
    const hasExceededTrades = !isNewCorps && tradeLimit !== Infinity && tradesRemaining < 0;
    const isLineupComplete = Object.keys(lineup).length === 8 && Object.values(lineup).every(Boolean);

    return (
        <div>
            <div className="border-b-theme border-accent dark:border-accent-dark pb-4 mb-4">
                <h2 className="text-xl sm:text-2xl font-bold text-primary dark:text-primary-dark">{corpsClassName} ({pointCap} pts max)</h2>
                {isNewCorps ? (
                    <div className="mt-2">
                        <input
                            type="text"
                            value={corpsName}
                            onChange={(e) => setCorpsName(e.target.value)}
                            placeholder={`Enter your ${corpsClassName} corps name`}
                            className="w-full sm:w-auto bg-background dark:bg-background-dark border-theme border-accent dark:border-accent-dark rounded-theme p-2 text-text-primary dark:text-text-primary-dark focus:ring-2 focus:ring-primary focus:border-primary"
                        />
                    </div>
                ) : (
                    <h3 className="text-lg font-semibold text-secondary dark:text-secondary-dark">{profile.corpsName}</h3>
                )}
                <p className="text-sm text-text-secondary dark:text-text-secondary-dark mt-1">Lineups lock each Saturday at 12:00 PM EST.</p>
            </div>
            
            {!isNewCorps && (
                <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4 gap-2">
                    <div className={`text-base sm:text-xl font-bold p-2 rounded-theme ${hasExceededTrades ? 'text-red-500 bg-red-500/10' : 'text-text-primary dark:text-text-primary-dark'}`}>Trades Remaining: {tradesRemaining}</div>
                    <div className={`text-base sm:text-xl font-bold p-2 rounded-theme ${totalPoints > pointCap ? 'text-red-500 bg-red-500/10' : 'text-text-primary dark:text-text-primary-dark'}`}>Total Points: {totalPoints} / {pointCap}</div>
                </div>
            )}

            {isNewCorps && (
                <div className="flex justify-end mb-4">
                    <div className={`text-base sm:text-xl font-bold p-2 rounded-theme ${totalPoints > pointCap ? 'text-red-500 bg-red-500/10' : 'text-text-primary dark:text-text-primary-dark'}`}>Total Points: {totalPoints} / {pointCap}</div>
                </div>
            )}

            <div className="grid grid-cols-1 gap-4">
                {CAPTIONS.map(caption => (
                    <div key={caption} className="flex items-center">
                        <label className="w-12 font-semibold text-text-primary dark:text-text-primary-dark">{caption}:</label>
                        <select 
                            value={lineup[caption] || ''} 
                            onChange={(e) => setLineup(prev => ({...prev, [caption]: e.target.value}))}
                            className="flex-grow bg-background dark:bg-background-dark border-theme border-accent dark:border-accent-dark rounded-theme p-2 text-text-primary dark:text-text-primary-dark focus:ring-2 focus:ring-primary focus:border-primary"
                        >
                            <option value="">-- Select a Corps --</option>
                            {corpsData
                                .filter(corps => corps.points <= pointCap)
                                .map(corps => {
                                    const uniqueValue = `${corps.corpsName}|${corps.points}|${corps.sourceYear}`;
                                    return (
                                        <option key={uniqueValue} value={uniqueValue}>
                                            {corps.corpsName} ({corps.sourceYear}) - {corps.points} pts
                                        </option>
                                    );
                                })
                            }
                        </select>
                    </div>
                ))}
            </div>

            <div className="mt-6 flex justify-end items-center space-x-4">
                {message && (
                    <p className={`text-sm font-semibold ${message.toLowerCase().includes('successfully') || message.toLowerCase().includes('saved') ? 'text-green-600' : 'text-red-600'}`}>{message}</p>
                )}
                <button 
                    onClick={handleSave} 
                    disabled={isLoading || totalPoints > pointCap || (!isNewCorps && pendingTrades === 0) || (!isNewCorps && hasExceededTrades) || (isNewCorps && (!isLineupComplete || !corpsName.trim()))}
                    className="bg-primary hover:opacity-90 text-on-primary font-bold py-2 px-6 rounded-theme disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isLoading ? 'Saving...' : isNewCorps ? 'Create Corps & Join Season' : 'Save Lineup Changes'}
                </button>
            </div>
        </div>
    );
};

export default LineupEditor;