import React, { useState, useEffect } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../firebase';
import { checkUsername, createUserProfile } from '../../utils/api';
import Icon from '../ui/Icon';
import toast from 'react-hot-toast';

const AuthModal = ({ isOpen, onClose, initialView = 'login', onAuthSuccess }) => {
    const [currentView, setCurrentView] = useState(initialView);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [validationErrors, setValidationErrors] = useState({});
    const [showPassword, setShowPassword] = useState(false);
    
    // Form data
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        username: '',
        confirmPassword: ''
    });

    // Reset form and errors when modal opens/closes or view changes
    useEffect(() => {
        if (isOpen) {
            setCurrentView(initialView);
            setFormData({ email: '', password: '', username: '', confirmPassword: '' });
            setError('');
            setValidationErrors({});
            setShowPassword(false);
        }
    }, [isOpen, initialView]);

    // Form validation
    const validateForm = () => {
        const errors = {};
        
        if (currentView === 'signup') {
            if (!formData.username.trim()) {
                errors.username = 'Username is required';
            } else if (formData.username.length < 3) {
                errors.username = 'Username must be at least 3 characters';
            } else if (!/^[a-zA-Z0-9_-]+$/.test(formData.username)) {
                errors.username = 'Username can only contain letters, numbers, hyphens, and underscores';
            }
            
            if (!formData.confirmPassword) {
                errors.confirmPassword = 'Please confirm your password';
            } else if (formData.password !== formData.confirmPassword) {
                errors.confirmPassword = 'Passwords do not match';
            }
        }
        
        if (!formData.email.trim()) {
            errors.email = 'Email is required';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            errors.email = 'Please enter a valid email address';
        }
        
        if (!formData.password) {
            errors.password = 'Password is required';
        } else if (currentView === 'signup' && formData.password.length < 6) {
            errors.password = 'Password must be at least 6 characters';
        }
        
        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    };

    // Handle form input changes
    const handleInputChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        // Clear validation error for this field when user starts typing
        if (validationErrors[field]) {
            setValidationErrors(prev => ({ ...prev, [field]: '' }));
        }
        // Clear general error
        if (error) setError('');
    };

    // Handle sign up
    const handleSignUp = async (e) => {
        e.preventDefault();
        if (!validateForm()) return;
        
        setIsLoading(true);
        setError('');
        
        try {
            // Check username availability
            await checkUsername({ username: formData.username.trim() });
            
            // Create user account
            const userCredential = await createUserWithEmailAndPassword(
                auth, 
                formData.email.trim(), 
                formData.password
            );
            
            // Create user profile
            await createUserProfile({
                username: formData.username.trim(),
                email: userCredential.user.email
            });
            
            toast.success('Account created successfully! Welcome to marching.art!');
            onAuthSuccess();
            
        } catch (err) {
            console.error('Sign up error:', err);
            
            // Handle specific Firebase auth errors
            let errorMessage = 'An error occurred during sign up. Please try again.';
            
            if (err.code === 'auth/email-already-in-use') {
                errorMessage = 'This email is already registered. Try signing in instead.';
            } else if (err.code === 'auth/weak-password') {
                errorMessage = 'Password is too weak. Please choose a stronger password.';
            } else if (err.code === 'auth/invalid-email') {
                errorMessage = 'Please enter a valid email address.';
            } else if (err.message?.includes('username')) {
                errorMessage = 'This username is already taken. Please choose another.';
            }
            
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    // Handle sign in
    const handleSignIn = async (e) => {
        e.preventDefault();
        if (!validateForm()) return;
        
        setIsLoading(true);
        setError('');
        
        try {
            await signInWithEmailAndPassword(auth, formData.email.trim(), formData.password);
            toast.success('Welcome back!');
            onAuthSuccess();
            
        } catch (err) {
            console.error('Sign in error:', err);
            
            let errorMessage = 'Failed to sign in. Please check your credentials.';
            
            if (err.code === 'auth/user-not-found') {
                errorMessage = 'No account found with this email. Try signing up instead.';
            } else if (err.code === 'auth/wrong-password') {
                errorMessage = 'Incorrect password. Please try again.';
            } else if (err.code === 'auth/invalid-email') {
                errorMessage = 'Please enter a valid email address.';
            } else if (err.code === 'auth/too-many-requests') {
                errorMessage = 'Too many failed attempts. Please try again later.';
            }
            
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    // Handle password reset
    const handlePasswordReset = async () => {
        if (!formData.email.trim()) {
            setError('Please enter your email address first.');
            return;
        }
        
        setIsLoading(true);
        setError('');
        
        try {
            await sendPasswordResetEmail(auth, formData.email.trim());
            toast.success('Password reset email sent! Check your inbox.');
            setCurrentView('login');
        } catch (err) {
            console.error('Password reset error:', err);
            setError('Failed to send password reset email. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    // Close modal
    const handleClose = () => {
        if (!isLoading) {
            onClose();
        }
    };

    // Handle backdrop click
    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) {
            handleClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={handleBackdropClick}
        >
            <div className="bg-surface dark:bg-surface-dark rounded-theme border border-accent dark:border-accent-dark shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-accent/20 dark:border-accent-dark/20">
                    <div>
                        <h2 className="text-xl font-bold text-text-primary dark:text-text-primary-dark">
                            {currentView === 'signup' ? 'Join marching.art' : 
                             currentView === 'reset' ? 'Reset Password' : 'Welcome Back'}
                        </h2>
                        <p className="text-sm text-text-secondary dark:text-text-secondary-dark mt-1">
                            {currentView === 'signup' ? 'Start your drum corps fantasy journey' : 
                             currentView === 'reset' ? 'Enter your email to reset your password' : 'Sign in to your account'}
                        </p>
                    </div>
                    <button
                        onClick={handleClose}
                        disabled={isLoading}
                        className="p-2 hover:bg-background dark:hover:bg-background-dark rounded-full transition-colors"
                    >
                        <Icon path="M6 18L18 6M6 6l12 12" className="w-5 h-5 text-text-secondary" />
                    </button>
                </div>

                {/* Form */}
                <div className="p-6">
                    {/* Global Error */}
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-theme">
                            <div className="flex items-center gap-2">
                                <Icon path="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" 
                                      className="w-4 h-4 text-red-500 flex-shrink-0" />
                                <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
                            </div>
                        </div>
                    )}

                    <form onSubmit={currentView === 'signup' ? handleSignUp : handleSignIn} className="space-y-4">
                        {/* Username (Sign Up Only) */}
                        {currentView === 'signup' && (
                            <div>
                                <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                                    Username
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={formData.username}
                                        onChange={(e) => handleInputChange('username', e.target.value)}
                                        className={`w-full px-3 py-2 pr-10 bg-background dark:bg-background-dark border rounded-theme text-text-primary dark:text-text-primary-dark placeholder:text-text-secondary focus:ring-2 focus:ring-primary focus:border-primary transition-colors ${
                                            validationErrors.username ? 'border-red-500' : 'border-accent dark:border-accent-dark'
                                        }`}
                                        placeholder="Choose a username"
                                        autoComplete="username"
                                        disabled={isLoading}
                                    />
                                    <Icon path="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" 
                                          className="absolute right-3 top-2.5 w-4 h-4 text-text-secondary" />
                                </div>
                                {validationErrors.username && (
                                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">{validationErrors.username}</p>
                                )}
                            </div>
                        )}

                        {/* Email */}
                        <div>
                            <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                                Email
                            </label>
                            <div className="relative">
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => handleInputChange('email', e.target.value)}
                                    className={`w-full px-3 py-2 pr-10 bg-background dark:bg-background-dark border rounded-theme text-text-primary dark:text-text-primary-dark placeholder:text-text-secondary focus:ring-2 focus:ring-primary focus:border-primary transition-colors ${
                                        validationErrors.email ? 'border-red-500' : 'border-accent dark:border-accent-dark'
                                    }`}
                                    placeholder="Enter your email"
                                    autoComplete="email"
                                    disabled={isLoading}
                                />
                                <Icon path="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" 
                                      className="absolute right-3 top-2.5 w-4 h-4 text-text-secondary" />
                            </div>
                            {validationErrors.email && (
                                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{validationErrors.email}</p>
                            )}
                        </div>

                        {/* Password (Login & Sign Up) */}
                        {currentView !== 'reset' && (
                            <div>
                                <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                                    Password
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={formData.password}
                                        onChange={(e) => handleInputChange('password', e.target.value)}
                                        className={`w-full px-3 py-2 pr-20 bg-background dark:bg-background-dark border rounded-theme text-text-primary dark:text-text-primary-dark placeholder:text-text-secondary focus:ring-2 focus:ring-primary focus:border-primary transition-colors ${
                                            validationErrors.password ? 'border-red-500' : 'border-accent dark:border-accent-dark'
                                        }`}
                                        placeholder={currentView === 'signup' ? 'Create a password' : 'Enter your password'}
                                        autoComplete={currentView === 'signup' ? 'new-password' : 'current-password'}
                                        disabled={isLoading}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-2.5 text-text-secondary hover:text-text-primary transition-colors"
                                        disabled={isLoading}
                                    >
                                        <Icon path={showPassword ? 
                                            "M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 11-4.243-4.243m4.242 4.242L9.88 9.88" :
                                            "M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                        } className="w-4 h-4" />
                                    </button>
                                </div>
                                {validationErrors.password && (
                                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">{validationErrors.password}</p>
                                )}
                            </div>
                        )}

                        {/* Confirm Password (Sign Up Only) */}
                        {currentView === 'signup' && (
                            <div>
                                <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                                    Confirm Password
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={formData.confirmPassword}
                                        onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                                        className={`w-full px-3 py-2 pr-10 bg-background dark:bg-background-dark border rounded-theme text-text-primary dark:text-text-primary-dark placeholder:text-text-secondary focus:ring-2 focus:ring-primary focus:border-primary transition-colors ${
                                            validationErrors.confirmPassword ? 'border-red-500' : 'border-accent dark:border-accent-dark'
                                        }`}
                                        placeholder="Confirm your password"
                                        autoComplete="new-password"
                                        disabled={isLoading}
                                    />
                                    <Icon path="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" 
                                          className="absolute right-3 top-2.5 w-4 h-4 text-text-secondary" />
                                </div>
                                {validationErrors.confirmPassword && (
                                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">{validationErrors.confirmPassword}</p>
                                )}
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-primary text-on-primary py-3 rounded-theme font-bold text-lg hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isLoading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin"></div>
                                    {currentView === 'signup' ? 'Creating Account...' : 'Signing In...'}
                                </>
                            ) : (
                                <>
                                    {currentView === 'signup' ? 'Create Account' : 'Sign In'}
                                    <Icon path="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    </form>

                    {/* Password Reset Button (Login Only) */}
                    {currentView === 'login' && (
                        <div className="mt-4 text-center">
                            <button
                                onClick={handlePasswordReset}
                                disabled={isLoading}
                                className="text-sm text-primary hover:text-primary-dark font-medium disabled:opacity-50"
                            >
                                Forgot your password?
                            </button>
                        </div>
                    )}

                    {/* Reset Password Action (Reset View) */}
                    {currentView === 'reset' && (
                        <button
                            onClick={handlePasswordReset}
                            disabled={isLoading || !formData.email.trim()}
                            className="w-full bg-primary text-on-primary py-3 rounded-theme font-bold text-lg hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4"
                        >
                            {isLoading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin"></div>
                                    Sending Reset Email...
                                </>
                            ) : (
                                <>
                                    Send Reset Email
                                    <Icon path="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" 
                                          className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    )}

                    {/* View Switcher */}
                    <div className="mt-6 pt-6 border-t border-accent/20 dark:border-accent-dark/20 text-center">
                        {currentView === 'signup' ? (
                            <p className="text-sm text-text-secondary dark:text-text-secondary-dark">
                                Already have an account?{' '}
                                <button
                                    onClick={() => setCurrentView('login')}
                                    disabled={isLoading}
                                    className="font-medium text-primary hover:text-primary-dark disabled:opacity-50"
                                >
                                    Sign in here
                                </button>
                            </p>
                        ) : currentView === 'reset' ? (
                            <p className="text-sm text-text-secondary dark:text-text-secondary-dark">
                                Remember your password?{' '}
                                <button
                                    onClick={() => setCurrentView('login')}
                                    disabled={isLoading}
                                    className="font-medium text-primary hover:text-primary-dark disabled:opacity-50"
                                >
                                    Back to sign in
                                </button>
                            </p>
                        ) : (
                            <p className="text-sm text-text-secondary dark:text-text-secondary-dark">
                                New to marching.art?{' '}
                                <button
                                    onClick={() => setCurrentView('signup')}
                                    disabled={isLoading}
                                    className="font-medium text-primary hover:text-primary-dark disabled:opacity-50"
                                >
                                    Create an account
                                </button>
                            </p>
                        )}
                    </div>

                    {/* Benefits Footer (Sign Up View) */}
                    {currentView === 'signup' && (
                        <div className="mt-6 p-4 bg-primary/5 rounded-theme">
                            <h4 className="font-semibold text-text-primary dark:text-text-primary-dark mb-2">
                                Join the Community
                            </h4>
                            <ul className="text-sm text-text-secondary dark:text-text-secondary-dark space-y-1">
                                <li className="flex items-center gap-2">
                                    <Icon path="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
                                          className="w-3 h-3 text-green-500 flex-shrink-0" />
                                    Track your favorite corps and shows
                                </li>
                                <li className="flex items-center gap-2">
                                    <Icon path="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
                                          className="w-3 h-3 text-green-500 flex-shrink-0" />
                                    Join fantasy leagues with friends
                                </li>
                                <li className="flex items-center gap-2">
                                    <Icon path="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
                                          className="w-3 h-3 text-green-500 flex-shrink-0" />
                                    Access exclusive schedule features
                                </li>
                            </ul>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AuthModal;