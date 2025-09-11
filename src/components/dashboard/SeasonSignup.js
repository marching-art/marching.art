import React, { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { doc, updateDoc } from 'firebase/firestore';
import { db, appId, functions } from '../../firebase';

const CAPTIONS = ["GE1", "GE2", "VP", "VA", "CG", "B", "MA", "P"];

const SeasonSignup = ({ profile, userId, seasonSettings, corpsData }) => {
    const [step, setStep] = useState(1);
    const [corpsName, setCorpsName] = useState('');
    const [lineup, setLineup] = useState({});
    const [totalPoints, setTotalPoints] = useState(0);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState('');
    
    const pointCap = seasonSettings?.currentPointCap || 150;

    // Calculate total points whenever the lineup changes
    useEffect(() => {
        // --- MODIFICATION: Parse the unique value string to get points ---
        const points = CAPTIONS.reduce((sum, caption) => {
            const selectedValue = lineup[caption];
            if (selectedValue) {
                const [_corpsName, corpsPoints] = selectedValue.split('|');
                return sum + (Number(corpsPoints) || 0);
            }
            return sum;
        }, 0);
        setTotalPoints(points);
    }, [lineup]);

    // --- MODIFICATION: The handler now receives the full unique value ---
    const handleSelectCorps = (caption, selectedValue) => {
        setLineup(prev => ({ ...prev, [caption]: selectedValue }));
    };

    // Step 1: Save corps name and move to lineup selection
    const handleCreateCorps = async () => {
        if (!corpsName.trim()) {
            setMessage("Your corps needs a name!");
            return;
        }
        setIsSaving(true);
        setStep(2);
        setIsSaving(false);
    };

    // Step 2: Save the final lineup and join the season
    const handleJoinSeason = async () => {
        setIsSaving(true);
        setMessage('');
        try {
            const validateAndSaveLineup = httpsCallable(functions, 'validateAndSaveLineup');
            // This single backend call now handles everything atomically.
            const result = await validateAndSaveLineup({
                lineup: lineup,
                corpsName: corpsName.trim()
            });

            setMessage(result.data.message);
            // The main app's real-time listener will automatically detect the profile 
            // update from the backend and refresh the dashboard.

        } catch (error) {
            console.error("Error joining season:", error);
            setMessage(error.message || "An unknown error occurred. Please try again.");
        }
        setIsSaving(false);
    };

    const isLineupComplete = Object.keys(lineup).length === 8 && Object.values(lineup).every(Boolean);

    // --- MODIFICATION: Helper to create a unique value for each corps option ---
    const uniqueCorpsValue = (corps) => `${corps.corpsName}|${corps.points}|${corps.sourceYear}`;

    // --- RENDER FUNCTIONS ---

    const renderStepOne = () => (
        // This function does not need changes
        <div>
            <h3 className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">Step 1: Name Your Corps</h3>
            <p className="mt-2 mb-4 text-gray-600 dark:text-gray-300">
                Welcome to the {seasonSettings.name}! To get started, give your fantasy corps a name.
            </p>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <input
                    type="text"
                    value={corpsName}
                    onChange={(e) => setCorpsName(e.target.value)}
                    placeholder="e.g., The Phantom Regiment"
                    className="flex-grow bg-gray-100 dark:bg-gray-900 border-2 border-gray-300 dark:border-yellow-600 rounded p-3 text-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                />
                <button
                    onClick={handleCreateCorps}
                    disabled={!corpsName.trim()}
                    className="bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-3 px-6 rounded-md text-lg disabled:bg-gray-400 transition-colors"
                >
                    Next: Create Lineup
                </button>
            </div>
        </div>
    );

    const renderStepTwo = () => (
        <div>
            <h3 className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">Step 2: Create Your Starting Lineup</h3>
            <div className="flex flex-col sm:flex-row justify-between sm:items-center my-4 gap-2">
                <p className="text-gray-600 dark:text-gray-300">Select a corps for each caption. Stay under the point cap!</p>
                <div className={`text-xl font-bold px-3 py-1 rounded ${totalPoints > pointCap ? 'text-red-500 bg-red-100 dark:bg-red-900' : 'text-gray-800 dark:text-gray-200'}`}>
                    Total Points: {totalPoints} / {pointCap}
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {CAPTIONS.map(caption => (
                    <div key={caption} className="flex items-center">
                        <label className="w-12 font-semibold">{caption}:</label>
                        <select 
                            value={lineup[caption] || ''} 
                            onChange={(e) => handleSelectCorps(caption, e.target.value)}
                            className="flex-grow bg-gray-100 dark:bg-gray-900 border border-gray-400 dark:border-yellow-500 rounded p-2 text-gray-800 dark:text-yellow-300"
                        >
                            <option value="">-- Select a Corps --</option>
                            {/* --- MODIFICATION: Use the unique value for the key and value attributes --- */}
                            {corpsData.map(corps => (
                                <option key={uniqueCorpsValue(corps)} value={uniqueCorpsValue(corps)}>
                                    {corps.corpsName} ({corps.sourceYear}) - {corps.points} pts
                                </option>
                            ))}
                        </select>
                    </div>
                ))}
            </div>
            <div className="flex justify-end items-center">
                 <button 
                    onClick={handleJoinSeason} 
                    disabled={isSaving || totalPoints > pointCap || !isLineupComplete}
                    className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-8 rounded-md text-lg disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                    {isSaving ? 'Joining...' : 'Join Season'}
                </button>
            </div>
        </div>
    );

    return (
        <div className="bg-white dark:bg-gray-800 p-8 rounded-md border-2 border-yellow-500 shadow-lg max-w-3xl mx-auto">
            {step === 1 && renderStepOne()}
            {step === 2 && renderStepTwo()}
            {message && <p className="mt-4 text-sm font-semibold text-red-600 dark:text-red-400">{message}</p>}
        </div>
    );
};

export default SeasonSignup;