import React, { useState } from 'react';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../firebase';

const LoginForm = ({ onLoginSuccess, switchToSignUp }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [view, setView] = useState('login'); // 'login' or 'reset'

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        setIsLoading(true);
        try {
            await signInWithEmailAndPassword(auth, email, password);
            onLoginSuccess();
        } catch (err) {
            setError(err.message);
        }
        setIsLoading(false);
    };

    const handlePasswordReset = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        setIsLoading(true);
        try {
            await sendPasswordResetEmail(auth, email);
            setMessage("Password reset link sent! Please check your email inbox (and spam folder).");
            setView('login'); // Switch back to login view after success
        } catch (err) {
            setError(err.message);
        }
        setIsLoading(false);
    };

    if (view === 'reset') {
        return (
            <form onSubmit={handlePasswordReset} className="space-y-4">
                <h3 className="text-lg font-semibold text-text-primary dark:text-text-primary-dark">Reset Password</h3>
                {error && <p className="bg-red-500/10 border border-red-500 text-red-700 dark:text-red-300 p-3 rounded-theme text-sm">{error}</p>}
                {message && <p className="bg-green-500/10 border border-green-500 text-green-700 dark:text-green-300 p-3 rounded-theme text-sm">{message}</p>}
                
                <input 
                    type="email" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    placeholder="Enter your account email"
                    className="w-full bg-background dark:bg-background-dark border-theme border-accent dark:border-accent-dark rounded-theme p-2 text-text-primary dark:text-text-primary-dark placeholder:text-text-secondary focus:ring-2 focus:ring-primary focus:border-primary" 
                />
                
                <button 
                    type="submit" 
                    disabled={isLoading}
                    className="w-full bg-primary hover:opacity-90 text-on-primary font-bold py-2 px-4 rounded-theme transition-all disabled:opacity-50"
                >
                    {isLoading ? 'Sending...' : 'Send Reset Link'}
                </button>
                
                <p className="text-center pt-2 text-sm text-text-secondary dark:text-text-secondary-dark">
                    Remembered your password?{' '}
                    <button 
                        type="button" 
                        onClick={() => { setView('login'); setError(''); setMessage(''); }}
                        className="font-semibold text-primary dark:text-primary-dark hover:underline"
                    >
                        Back to Login
                    </button>
                </p>
            </form>
        );
    }

    return (
        <form onSubmit={handleLogin} className="space-y-4">
            {error && <p className="bg-red-500/10 border border-red-500 text-red-700 dark:text-red-300 p-3 rounded-theme text-sm">{error}</p>}
            {message && <p className="bg-green-500/10 border border-green-500 text-green-700 dark:text-green-300 p-3 rounded-theme text-sm">{message}</p>}
            
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

            <div className="text-right">
                <button 
                    type="button" 
                    onClick={() => { setView('reset'); setError(''); setMessage(''); }}
                    className="text-sm font-semibold text-primary dark:text-primary-dark hover:underline"
                >
                    Forgot Password?
                </button>
            </div>
            
            <button 
                type="submit" 
                disabled={isLoading}
                className="w-full bg-primary hover:opacity-90 text-on-primary font-bold py-2 px-4 rounded-theme transition-all disabled:opacity-50"
            >
                {isLoading ? 'Logging In...' : 'Log In'}
            </button>
            
            <p className="text-center pt-2 text-sm text-text-secondary dark:text-text-secondary-dark">
                Don't have an account?{' '}
                <button 
                    type="button" 
                    onClick={switchToSignUp} 
                    className="font-semibold text-primary dark:text-primary-dark hover:underline"
                >
                    Sign Up
                </button>
            </p>
        </form>
    );
};

export default LoginForm;