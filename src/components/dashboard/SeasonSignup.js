import React, { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db, appId } from '../../firebase';

const SeasonSignup = ({ profile, userId, seasonSettings }) => {
    // This component guides the user through creating a corps and joining the season.
    const [step, setStep] = useState(1);
    const [corpsName, setCorpsName] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState('');

    // Step 1: Handle saving the user's chosen corps name to their profile.
    const handleCreateCorps = async () => {
        if (!corpsName.trim()) {
            setMessage("Your corps needs a name!");
            return;
        }
        setIsSaving(true);
        setMessage('');
        try {
            // Path to the user's specific profile document
            const userDocRef = doc(db, 'artifacts', appId, 'users', userId, 'profile', 'data');
            // Update their profile with the new corps name and join them to the current season.
            await updateDoc(userDocRef, {
                corpsName: corpsName.trim(),
                activeSeasonId: seasonSettings.id // e.g., 'off-season-2025'
            });
            // Move to the next step in the signup process
            setStep(2); 
        } catch (error) {
            console.error("Error creating corps:", error);
            setMessage("There was an error creating your corps. Please try again.");
        }
        setIsSaving(false);
    };

    // Render Step 1: Create Corps Name
    const renderStepOne = () => (
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
                    disabled={isSaving}
                    className="bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-3 px-6 rounded-md text-lg disabled:bg-gray-400 transition-colors"
                >
                    {isSaving ? 'Saving...' : 'Create Corps'}
                </button>
            </div>
        </div>
    );

    // Render Step 2: Welcome & Next Steps
    const renderStepTwo = () => (
        <div className="text-center">
            <h3 className="text-3xl font-bold text-green-600 dark:text-green-400">Welcome to the Season!</h3>
            <p className="mt-2 text-xl text-gray-800 dark:text-gray-200">
                Your corps, <span className="font-bold text-yellow-600 dark:text-yellow-400">{profile.corpsName || corpsName}</span>, has been officially registered.
            </p>
            <p className="mt-4 text-gray-600 dark:text-gray-300">
                The page will now reload to take you to your lineup editor. Good luck!
            </p>
        </div>
    );

    return (
        <div className="bg-white dark:bg-gray-800 p-8 rounded-md border-2 border-yellow-500 shadow-lg max-w-2xl mx-auto">
            {step === 1 && renderStepOne()}
            {step === 2 && renderStepTwo()}
            {message && <p className="mt-4 text-sm font-semibold text-red-600 dark:text-red-400">{message}</p>}
        </div>
    );
};

export default SeasonSignup;
