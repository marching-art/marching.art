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
            <div className="bg-surface dark:bg-surface-dark w-full max-w-md rounded-theme shadow-theme p-6 border-theme border-accent dark:border-accent-dark">
                <h2 className="text-2xl font-bold text-primary dark:text-primary-dark mb-4">Create a New League</h2>
                <form onSubmit={handleSubmit}>
                    <p className="text-text-secondary dark:text-text-secondary-dark mb-3">Give your league a name to get started.</p>
                    <input
                        type="text"
                        value={leagueName}
                        onChange={(e) => setLeagueName(e.target.value)}
                        placeholder="e.g., The Brass Masters"
                        className="w-full bg-background dark:bg-background-dark border-theme border-accent dark:border-accent-dark rounded-theme p-2 text-text-primary dark:text-text-primary-dark mb-4 focus:ring-2 focus:ring-primary focus:border-primary"
                        autoFocus
                    />
                    <div className="flex justify-end space-x-2">
                        <button type="button" onClick={onClose} className="border-theme border-accent dark:border-accent-dark hover:bg-accent dark:hover:bg-accent-dark/20 text-text-primary dark:text-text-primary-dark font-bold py-2 px-4 rounded-theme transition-colors">
                            Cancel
                        </button>
                        <button type="submit" disabled={isLoading || !leagueName.trim()} className="bg-primary hover:opacity-90 text-on-primary font-bold py-2 px-4 rounded-theme disabled:opacity-50">
                            {isLoading ? 'Creating...' : 'Create League'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateLeagueModal;