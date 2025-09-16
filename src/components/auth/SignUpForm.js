import React, { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db, appId } from '../../firebase';

const SignUpForm = ({ onSignUpSuccess, switchToLogin }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [error, setError] = useState('');

    const handleSignUp = async (e) => {
        e.preventDefault();
        setError('');
        if (!username.trim()) {
            setError("Please enter a username.");
            return;
        }
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            
            const userDocRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data');
            await setDoc(userDocRef, {
                username: username,
                email: user.email,
                createdAt: new Date(),
                lastActive: new Date(),
                bio: `Welcome to my marching.art profile!`,
                uniform: { jacketStyle: "classic", jacketColor1: "#000000", jacketColor2: "#ffffff", plumeStyle: "standard", plumeColor: "#ffffff", hatStyle: "shako", hatColor: "#000000" },
                trophies: { championships: [], regionals: [] },
                seasons: [],
                lineup: {}
            });
            
            onSignUpSuccess();
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <form onSubmit={handleSignUp} className="space-y-4">
            {error && <p className="bg-red-100 dark:bg-red-900 border border-red-500 text-red-700 dark:text-red-300 p-2 rounded-theme text-sm">{error}</p>}
            
            <input 
                type="text" 
                value={username} 
                onChange={(e) => setUsername(e.target.value)} 
                placeholder="Username"
                className="w-full bg-surface dark:bg-surface-dark border-theme border-accent rounded-theme p-2 text-text-primary dark:text-text-primary-dark placeholder:text-text-secondary focus:outline-none focus:border-primary transition-colors" 
            />
            
            <input 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                placeholder="Email" 
                className="w-full bg-surface dark:bg-surface-dark border-theme border-accent rounded-theme p-2 text-text-primary dark:text-text-primary-dark placeholder:text-text-secondary focus:outline-none focus:border-primary transition-colors" 
            />
            
            <input 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                placeholder="Password" 
                className="w-full bg-surface dark:bg-surface-dark border-theme border-accent rounded-theme p-2 text-text-primary dark:text-text-primary-dark placeholder:text-text-secondary focus:outline-none focus:border-primary transition-colors" 
            />
            
            <button 
                type="submit" 
                className="w-full bg-primary hover:bg-primary/80 text-on-primary font-bold py-2 px-4 rounded-theme transition-all"
            >
                Sign Up
            </button>
            
            <p className="text-center pt-2 text-sm text-text-secondary">
                Already have an account?{' '}
                <button 
                    type="button" 
                    onClick={switchToLogin} 
                    className="font-semibold text-secondary dark:text-secondary-dark hover:underline"
                >
                    Log In
                </button>
            </p>
        </form>
    );
};

export default SignUpForm;