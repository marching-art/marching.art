import React, { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, writeBatch } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
// MODIFIED: Import dataNamespace instead of appId
import { auth, db, functions, dataNamespace } from '../../firebase';

const SignUpForm = ({ onSignUpSuccess, switchToLogin }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSignUp = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        const trimmedUsername = username.trim();

        if (!trimmedUsername) {
            setError("Please enter a username.");
            setIsLoading(false);
            return;
        }

        try {
            const checkUsername = httpsCallable(functions, 'checkUsername');
            await checkUsername({ username: trimmedUsername });

            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            
            const batch = writeBatch(db);

            // MODIFIED: Use the clear dataNamespace variable to build the path
            const userDocRef = doc(db, 'artifacts', dataNamespace, 'users', user.uid, 'profile', 'data');
            const usernameDocRef = doc(db, 'usernames', trimmedUsername.toLowerCase());

            batch.set(userDocRef, {
                username: trimmedUsername,
                email: user.email,
                createdAt: new Date(),
                lastActive: new Date(),
                bio: `Welcome to my marching.art profile!`,
                uniform: {
                  skinTone: '#d8aa7c',
                  headwear: { style: 'shako', colors: { hat: '#1a1a1a', trim: '#ffffff' } },
                  plume: { style: 'fountain', colors: { plume: '#ff0000' } },
                  jacket: { style: 'sash', colors: { base: '#000080', accent: '#ffffff', trim: '#ffd700' } },
                  pants: { style: 'stripe', colors: { base: '#ffffff', stripe: '#000080' } },
                  shoes: { style: 'white' },
                },
                trophies: { championships: [], regionals: [], finalistMedals: [] },
                seasons: [],
                lineup: {}
            });
            
            batch.set(usernameDocRef, { uid: user.uid });

            await batch.commit();
            
            onSignUpSuccess();

        } catch (err) {
            setError(err.message);
        }
        setIsLoading(false);
    };

    return (
        <form onSubmit={handleSignUp} className="space-y-4">
            {error && <p className="bg-red-500/10 border border-red-500 text-red-700 dark:text-red-300 p-3 rounded-theme text-sm">{error}</p>}
            
            <input 
                type="text" 
                value={username} 
                onChange={(e) => setUsername(e.target.value)} 
                placeholder="Username"
                className="w-full bg-background dark:bg-background-dark border-theme border-accent dark:border-accent-dark rounded-theme p-2 text-text-primary dark:text-text-primary-dark placeholder:text-text-secondary focus:ring-2 focus:ring-primary focus:border-primary" 
            />
            
            <input 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                placeholder="Email" 
                className="w-full bg-background dark:bg-background-dark border-theme border-accent dark:border-accent-dark rounded-theme p-2 text-text-primary dark:text-text-primary-dark placeholder:text-text-secondary focus:ring-2 focus:ring-primary focus:border-primary" 
            />
            
            <input 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                placeholder="Password" 
                className="w-full bg-background dark:bg-background-dark border-theme border-accent dark:border-accent-dark rounded-theme p-2 text-text-primary dark:text-text-primary-dark placeholder:text-text-secondary focus:ring-2 focus:ring-primary focus:border-primary" 
            />
            
            <button 
                type="submit" 
                disabled={isLoading}
                className="w-full bg-primary hover:opacity-90 text-on-primary font-bold py-2 px-4 rounded-theme transition-all disabled:opacity-50"
            >
                {isLoading ? 'Signing Up...' : 'Sign Up'}
            </button>
            
            <p className="text-center pt-2 text-sm text-text-secondary dark:text-text-secondary-dark">
                Already have an account?{' '}
                <button 
                    type="button" 
                    onClick={switchToLogin} 
                    className="font-semibold text-primary dark:text-primary-dark hover:underline"
                >
                    Log In
                </button>
            </p>
        </form>
    );
};

export default SignUpForm;