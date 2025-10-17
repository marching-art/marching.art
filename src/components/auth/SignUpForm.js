import React, { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../firebase';
import { checkUsername, createUserProfile } from '../../utils/api';

const SignUpForm = ({ onSignUpSuccess, switchToLogin }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Check if user is already logged in but needs a profile
    const currentUser = auth.currentUser;
    const needsProfileOnly = currentUser !== null;

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
            // First, check if username is available
            await checkUsername({ username: trimmedUsername });

            // If user is already logged in, just create the profile
            if (needsProfileOnly) {
                await createUserProfile({ 
                    username: trimmedUsername
                });
                onSignUpSuccess();
            } else {
                // Otherwise, create new user account and profile
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;
                
                await createUserProfile({ 
                    username: trimmedUsername
                });
                
                onSignUpSuccess();
            }

        } catch (err) {
            console.error('Sign up error:', err);
            setError(err.message || 'An error occurred during sign up. Please try again.');
        }
        setIsLoading(false);
    };

    return (
        <form onSubmit={handleSignUp} className="space-y-4">
            {error && <p className="bg-red-500/10 border border-red-500 text-red-700 dark:text-red-300 p-3 rounded-theme text-sm">{error}</p>}
            
            {needsProfileOnly && (
                <div className="bg-blue-500/10 border border-blue-500 text-blue-700 dark:text-blue-300 p-3 rounded-theme text-sm">
                    <p className="font-semibold">Complete Your Profile</p>
                    <p className="text-xs mt-1">You're logged in as {currentUser.email}. Please choose a username to complete your profile setup.</p>
                </div>
            )}
            
            <input 
                type="text" 
                value={username} 
                onChange={(e) => setUsername(e.target.value)} 
                placeholder="Username"
                className="w-full bg-background dark:bg-background-dark border-theme border-accent dark:border-accent-dark rounded-theme p-2 text-text-primary dark:text-text-primary-dark placeholder:text-text-secondary focus:ring-2 focus:ring-primary focus:border-primary" 
            />
            
            {!needsProfileOnly && (
                <>
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
                </>
            )}
            
            <button 
                type="submit" 
                disabled={isLoading}
                className="w-full bg-primary hover:opacity-90 text-on-primary font-bold py-2 px-4 rounded-theme transition-all disabled:opacity-50"
            >
                {isLoading ? (needsProfileOnly ? 'Creating Profile...' : 'Signing Up...') : (needsProfileOnly ? 'Create Profile' : 'Sign Up')}
            </button>
            
            {!needsProfileOnly && (
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
            )}
        </form>
    );
};

export default SignUpForm;