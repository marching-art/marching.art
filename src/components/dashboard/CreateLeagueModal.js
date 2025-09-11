import React, { useState } from 'react';

const CreateLeagueModal = ({ isOpen, onClose, onCreate, isLoading }) => {
    const [leagueName, setLeagueName] = useState('');

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (leagueName.trim()) {
            onCreate(leagueName.trim());
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
            <div className="bg-brand-surface dark:bg-brand-surface-dark w-full max-w-md rounded-lg shadow-lg p-6 border-2 border-brand-secondary">
                <h2 className="text-2xl font-bold text-brand-primary dark:text-brand-secondary-dark mb-4">Create a New League</h2>
                <form onSubmit={handleSubmit}>
                    <p className="text-brand-text-secondary dark:text-brand-text-secondary-dark mb-3">Give your league a name to get started.</p>
                    <input
                        type="text"
                        value={leagueName}
                        onChange={(e) => setLeagueName(e.target.value)}
                        placeholder="e.g., The Brass Masters"
                        className="w-full bg-white dark:bg-brand-background-dark border border-brand-accent rounded p-2 text-brand-text-primary dark:text-brand-text-primary-dark mb-4"
                        autoFocus
                    />
                    <div className="flex justify-end space-x-2">
                        <button type="button" onClick={onClose} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded">
                            Cancel
                        </button>
                        <button type="submit" disabled={isLoading || !leagueName.trim()} className="bg-brand-primary hover:bg-blue-800 text-white font-bold py-2 px-4 rounded disabled:bg-gray-400">
                            {isLoading ? 'Creating...' : 'Create League'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateLeagueModal;