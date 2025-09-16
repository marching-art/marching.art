import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../firebase';

const LoginForm = ({ onLoginSuccess, switchToSignUp }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        try {
            await signInWithEmailAndPassword(auth, email, password);
            onLoginSuccess();
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <form onSubmit={handleLogin} className="space-y-4">
            {error && <p className="bg-red-100 dark:bg-red-900 border border-red-500 text-red-700 dark:text-red-300 p-2 rounded-theme text-sm">{error}</p>}
            
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
                Log In
            </button>
            
            <p className="text-center pt-2 text-sm text-text-secondary">
                Don't have an account?{' '}
                <button 
                    type="button" 
                    onClick={switchToSignUp} 
                    className="font-semibold text-secondary dark:text-secondary-dark hover:underline"
                >
                    Sign Up
                </button>
            </p>
        </form>
    );
};

export default LoginForm;