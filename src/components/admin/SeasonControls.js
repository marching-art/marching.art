import React, { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db, functions } from '../../firebase';
import { httpsCallable } from 'firebase/functions';

const DEFAULT_POINT_CAP = 150;

const SeasonControls = () => {
    const [seasonSettings, setSeasonSettings] = useState(null);
    const [pointCap, setPointCap] = useState(DEFAULT_POINT_CAP);
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        const docRef = doc(db, 'game-settings', 'season');
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setSeasonSettings(data);
                setPointCap(data.nextPointCap || data.currentPointCap || DEFAULT_POINT_CAP);
            } else {
                setSeasonSettings({ status: 'inactive' });
            }
        });
        return () => unsubscribe();
    }, []);

    const handleSavePointCap = async () => {
        setMessage('');
        const newCap = parseInt(pointCap, 10);
        if (isNaN(newCap) || newCap <= 0) {
            setMessage("Invalid point cap.");
            return;
        }
        try {
            await setDoc(doc(db, 'game-settings', 'season'), { nextPointCap: newCap }, { merge: true });
            setMessage("Next season's point cap updated!");
        } catch (error) {
            setMessage("Error updating point cap.");
            console.error(error);
        }
    };

    const handleForceStartOffSeason = async () => {
        if (!window.confirm('Are you sure you want to end any active season and start a new 7-week off-season? This will generate a new random corps list and schedule.')) return;
        setIsLoading(true);
        setMessage('');
        try {
            const startNewOffSeason = httpsCallable(functions, 'startNewOffSeason');
            const result = await startNewOffSeason();
            setMessage(result.data.message);
        } catch (error) {
            setMessage(error.message);
            console.error(error);
        }
        setIsLoading(false);
    };
    
    const handleForceStartLiveSeason = () => {
        // This logic would calculate the correct start day based on the DCI calendar
        // For now, it's a placeholder.
        const today = new Date();
        const secondSaturdayOfAugust = new Date(); // Placeholder for calculation
        const diff = today - secondSaturdayOfAugust;
        const startDay = Math.floor(diff / (1000 * 60 * 60 * 24)) + 70; // Example calculation
        
        alert(`This would force start the live season on day ${startDay}. Backend logic to be implemented.`);
    };

    return (
        <div>
            <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-2">Season Status & Controls</h3>
            <div className="p-4 bg-background dark:bg-background-dark rounded-theme space-y-3 border-theme border-accent dark:border-accent-dark">
                <p className="text-text-primary dark:text-text-primary-dark">Current Status: <span className="font-bold text-lg capitalize">{seasonSettings?.status || 'Loading...'}</span></p>
                <div className="flex items-center space-x-2">
                    <label htmlFor="point-cap" className="font-semibold text-text-primary dark:text-text-primary-dark">Point Cap:</label>
                    <input 
                        id="point-cap"
                        type="number"
                        value={pointCap}
                        onChange={(e) => setPointCap(e.target.value)}
                        className="w-24 bg-surface dark:bg-surface-dark border-theme border-accent dark:border-accent-dark rounded-theme p-2 text-text-primary dark:text-text-primary-dark focus:ring-2 focus:ring-primary focus:border-primary"
                    />
                    <button onClick={handleSavePointCap} className="border-theme border-accent dark:border-accent-dark hover:bg-accent dark:hover:bg-accent-dark/20 text-sm font-bold py-2 px-3 rounded-theme transition-colors text-text-primary dark:text-text-primary-dark">Save Cap</button>
                </div>
                {seasonSettings?.nextPointCap && seasonSettings.nextPointCap !== seasonSettings.currentPointCap &&
                    <p className="text-sm text-primary dark:text-primary-dark">A new point cap of {seasonSettings.nextPointCap} will be applied at the start of the next season.</p>
                }
                <p className="text-sm text-text-secondary dark:text-text-secondary-dark">Automatic season transitions are configured in the backend. These controls are for manual overrides.</p>
                <div className="flex space-x-4 pt-2">
                    <button onClick={handleForceStartLiveSeason} disabled={isLoading} className="bg-primary hover:opacity-90 text-on-primary font-bold py-2 px-4 rounded-theme disabled:opacity-50">Force Start Live Season</button>
                    <button onClick={handleForceStartOffSeason} disabled={isLoading} className="bg-secondary hover:opacity-90 text-on-secondary font-bold py-2 px-4 rounded-theme disabled:opacity-50">Force Start Off-Season</button>
                </div>
                {message && <p className="mt-2 text-sm font-semibold">{message}</p>}
            </div>
        </div>
    );
};

export default SeasonControls;