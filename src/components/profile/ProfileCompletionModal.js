import React, { useState } from 'react';
import Modal from '../ui/Modal';
import { doc, setDoc } from 'firebase/firestore';
import { db, dataNamespace } from '../../firebase';

const ProfileCompletionModal = ({ isOpen, userId, existingProfile, onComplete }) => {
    const [username, setUsername] = useState(existingProfile?.username || '');
    const [bio, setBio] = useState(existingProfile?.bio || '');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        
        if (!username.trim()) {
            setError('Username is required');
            return;
        }

        if (username.length < 3 || username.length > 15) {
            setError('Username must be between 3 and 15 characters');
            return;
        }

        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            setError('Username can only contain letters, numbers, and underscores');
            return;
        }

        setIsLoading(true);

        try {
            const userProfileRef = doc(db, 'artifacts', dataNamespace, 'users', userId, 'profile', 'data');
            
            await setDoc(userProfileRef, {
                username: username.trim(),
                bio: bio.trim() || 'Welcome to my marching.art profile!',
                lastActive: new Date(),
            }, { merge: true });

            onComplete();
        } catch (err) {
            console.error('Error completing profile:', err);
            setError(err.message || 'Failed to save profile');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={() => {}} title="Complete Your Profile">
            <form onSubmit={handleSubmit} className="space-y-4">
                <p className="text-sm text-text-secondary dark:text-text-secondary-dark">
                    Please complete your profile to continue using marching.art
                </p>

                {error && (
                    <div className="bg-red-500/10 border border-red-500 text-red-700 dark:text-red-300 p-3 rounded-theme text-sm">
                        {error}
                    </div>
                )}

                <div>
                    <label htmlFor="username" className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                        Username *
                    </label>
                    <input
                        id="username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Choose a username"
                        className="w-full bg-background dark:bg-background-dark border-theme border-accent dark:border-accent-dark rounded-theme p-2 text-text-primary dark:text-text-primary-dark placeholder:text-text-secondary focus:ring-2 focus:ring-primary focus:border-primary"
                        disabled={isLoading}
                        required
                    />
                    <p className="text-xs text-text-secondary dark:text-text-secondary-dark mt-1">
                        3-15 characters, letters, numbers, and underscores only
                    </p>
                </div>

                <div>
                    <label htmlFor="bio" className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                        Bio (Optional)
                    </label>
                    <textarea
                        id="bio"
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        placeholder="Tell us about yourself..."
                        rows={3}
                        className="w-full bg-background dark:bg-background-dark border-theme border-accent dark:border-accent-dark rounded-theme p-2 text-text-primary dark:text-text-primary-dark placeholder:text-text-secondary focus:ring-2 focus:ring-primary focus:border-primary"
                        disabled={isLoading}
                    />
                </div>

                <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-primary hover:opacity-90 text-on-primary font-bold py-3 px-4 rounded-theme transition-all disabled:opacity-50"
                >
                    {isLoading ? 'Saving...' : 'Complete Profile'}
                </button>
            </form>
        </Modal>
    );
};

export default ProfileCompletionModal;