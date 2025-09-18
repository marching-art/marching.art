import React, { useState, useEffect } from 'react';
import { validateAndSaveLineup } from '../../utils/api';
import { CORPS_CLASSES } from '../../utils/profileCompatibility';
import { useUserStore } from '../../store/userStore';

const CAPTIONS = ["GE1", "GE2", "VP", "VA", "CG", "B", "MA", "P"];

const SeasonSignup = ({ seasonSettings, corpsData }) => {
    const { loggedInProfile: profile } = useUserStore();
    const userId = profile?.userId;
    const [step, setStep] = useState(1);
    const [corpsName, setCorpsName] = useState('');
    const [lineup, setLineup] = useState({});
    const [totalPoints, setTotalPoints] = useState(0);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [selectedCorpsClass, setSelectedCorpsClass] = useState('worldClass');

    const pointCap = CORPS_CLASSES[selectedCorpsClass]?.pointCap || 150;

    useEffect(() => {
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

    const handleSelectCorps = (caption, selectedValue) => {
        setLineup(prev => ({ ...prev, [caption]: selectedValue }));
    };

    const handleCreateCorps = async () => {
        if (!corpsName.trim()) {
            setMessage("Your corps needs a name!");
            return;
        }
        setIsSaving(true);
        setStep(2);
        setIsSaving(false);
    };

    const handleJoinSeason = async () => {
        setIsSaving(true);
        setMessage('');
        try {
            const result = await validateAndSaveLineup({
                lineup: lineup,
                corpsName: corpsName.trim(),
                corpsClass: selectedCorpsClass
            });
            setMessage(result.data.message);
        } catch (error) {
            console.error("Error joining season:", error);
            setMessage(error.message || "An unknown error occurred. Please try again.");
        }
        setIsSaving(false);
    };

    const isLineupComplete = Object.keys(lineup).length === 8 && Object.values(lineup).every(Boolean);
    const uniqueCorpsValue = (corps) => `${corps.corpsName}|${corps.points}|${corps.sourceYear}`;

    const renderStepOne = () => (
        <div>
            <h3 className="text-2xl font-bold text-primary dark:text-primary-dark">Step 1: Choose Your Corps Class</h3>
            <p className="mt-2 mb-4 text-text-secondary dark:text-text-secondary-dark">Welcome to the {seasonSettings.name}! First, choose which class of corps you'd like to create.</p>
        
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {Object.entries(CORPS_CLASSES).map(([key, classInfo]) => (
                    <button
                        key={key}
                        onClick={() => setSelectedCorpsClass(key)}
                        className={`p-4 rounded-theme border-2 transition-all ${selectedCorpsClass === key ? 'border-primary bg-primary/10 text-primary dark:text-primary-dark' : 'border-accent dark:border-accent-dark text-text-secondary dark:text-text-secondary-dark hover:border-primary/50'}`}
                    >
                        <div className={`w-4 h-4 rounded-full ${classInfo.color} mx-auto mb-2`}></div>
                        <h4 className="font-bold text-lg">{classInfo.name}</h4>
                        <p className="text-sm opacity-75">{classInfo.pointCap} Point Limit</p>
                        <p className="text-xs mt-2">
                            {key === 'worldClass' && 'Elite competition with top-tier corps'}
                            {key === 'openClass' && 'Competitive tier with strong performers'}
                            {key === 'aClass' && 'Developing corps and budget-friendly option'}
                        </p>
                    </button>
                ))}
            </div>

            <div className="space-y-2">
                <label className="block text-sm font-semibold text-text-primary dark:text-text-primary-dark">Name Your {CORPS_CLASSES[selectedCorpsClass].name} Corps:</label>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <input
                        type="text"
                        value={corpsName}
                        onChange={(e) => setCorpsName(e.target.value)}
                        placeholder={`e.g., The Phantom Regiment ${CORPS_CLASSES[selectedCorpsClass].name}`}
                        className="flex-grow bg-background dark:bg-background-dark border-theme border-accent dark:border-accent-dark rounded-theme p-3 text-lg text-text-primary dark:text-text-primary-dark focus:ring-2 focus:ring-primary focus:border-primary"
                    />
                    <button onClick={handleCreateCorps} disabled={!corpsName.trim()} className="bg-secondary hover:opacity-90 text-on-secondary font-bold py-3 px-6 rounded-theme text-lg disabled:opacity-50 transition-colors">Next: Create Lineup</button>
                </div>
            </div>
        </div>
    );

    const renderStepTwo = () => (
        <div>
            <h3 className="text-2xl font-bold text-primary dark:text-primary-dark">Step 2: Create Your {CORPS_CLASSES[selectedCorpsClass].name} Lineup</h3>
            <div className="flex flex-col sm:flex-row justify-between sm:items-center my-4 gap-2">
                <div className="flex items-center space-x-2">
                    <div className={`w-3 h-3 rounded-full ${CORPS_CLASSES[selectedCorpsClass].color}`}></div>
                    <p className="text-text-secondary dark:text-text-secondary-dark">Select a corps for each caption. Stay under the {pointCap} point cap!</p>
                </div>
                <div className={`text-xl font-bold p-2 rounded-theme ${totalPoints > pointCap ? 'text-red-500 bg-red-500/10' : 'text-text-primary dark:text-text-primary-dark'}`}>Total Points: {totalPoints} / {pointCap}</div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {CAPTIONS.map(caption => (
                    <div key={caption} className="flex items-center">
                        <label className="w-12 font-semibold text-text-primary dark:text-text-primary-dark">{caption}:</label>
                        <select 
                            value={lineup[caption] || ''} 
                            onChange={(e) => handleSelectCorps(caption, e.target.value)}
                            className="flex-grow bg-background dark:bg-background-dark border-theme border-accent dark:border-accent-dark rounded-theme p-2 text-text-primary dark:text-text-primary-dark focus:ring-2 focus:ring-primary focus:border-primary"
                        >
                            <option value="">-- Select a Corps --</option>
                            {corpsData
                                .filter(corps => corps.points <= pointCap)
                                .map(corps => (
                                    <option key={uniqueCorpsValue(corps)} value={uniqueCorpsValue(corps)}>
                                        {corps.corpsName} ({corps.sourceYear}) - {corps.points} pts
                                    </option>
                                ))}
                        </select>
                    </div>
                ))}
            </div>
            <div className="flex justify-between items-center">
                <button onClick={() => setStep(1)} className="text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark font-semibold underline">← Back to Corps Selection</button>
                <button onClick={handleJoinSeason} disabled={isSaving || totalPoints > pointCap || !isLineupComplete} className="bg-primary hover:opacity-90 text-on-primary font-bold py-3 px-8 rounded-theme text-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                    {isSaving ? 'Joining...' : `Join Season with ${CORPS_CLASSES[selectedCorpsClass].name}`}
                </button>
            </div>
        </div>
    );

    return (
        <div className="bg-surface dark:bg-surface-dark p-8 rounded-theme border-theme border-accent dark:border-accent-dark shadow-theme max-w-3xl mx-auto">
            {step === 1 && renderStepOne()}
            {step === 2 && renderStepTwo()}
            {message && <p className="mt-4 text-sm font-semibold text-red-600 dark:text-red-400">{message}</p>}
        </div>
    );
};

export default SeasonSignup;