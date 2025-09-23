// src/components/auth/AuthModal.js - Enhanced Authentication Modal
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Icon from '../ui/Icon';
import toast from 'react-hot-toast';

const AuthModal = ({ isOpen, onClose, initialView = 'login', onAuthSuccess }) => {
    const { signUp, signIn, resetPassword, checkUsername, loading } = useAuth();
    
    const [currentView, setCurrentView] = useState(initialView);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [validationErrors, setValidationErrors] = useState({});
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [usernameAvailable, setUsernameAvailable] = useState(null);
    const [checkingUsername, setCheckingUsername] = useState(false);
    
    // Form data
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        username: '',
        confirmPassword: '',
        displayName: '',
        agreedToTerms: false
    });

    // Reset form when modal opens/closes or view changes
    useEffect(() => {
        if (isOpen) {
            setCurrentView(initialView);
            setFormData({
                email: '',
                password: '',
                username: '',
                confirmPassword: '',
                displayName: '',
                agreedToTerms: false
            });
            setError('');
            setValidationErrors({});
            setShowPassword(false);
            setShowConfirmPassword(false);
            setUsernameAvailable(null);
        }
    }, [isOpen, initialView]);

    // Username availability check with debouncing
    useEffect(() => {
        if (currentView === 'signup' && formData.username.length >= 3) {
            const timeoutId = setTimeout(async () => {
                await handleUsernameCheck(formData.username);
            }, 500);
            
            return () => clearTimeout(timeoutId);
        } else {
            setUsernameAvailable(null);
        }
    }, [formData.username, currentView]);

    // Check username availability
    const handleUsernameCheck = async (username) => {
        if (!username || username.length < 3) {
            setUsernameAvailable(null);
            return;
        }
        
        // Validate username format
        if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
            setUsernameAvailable(false);
            return;
        }
        
        setCheckingUsername(true);
        try {
            const available = await checkUsername(username);
            setUsernameAvailable(available);
        } catch (error) {
            setUsernameAvailable(false);
        } finally {
            setCheckingUsername(false);
        }
    };

    // Form validation
    const validateForm = () => {
        const errors = {};
        
        // Email validation
        if (!formData.email.trim()) {
            errors.email = 'Email is required';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            errors.email = 'Please enter a valid email address';
        }
        
        // Password validation
        if (!formData.password) {
            errors.password = 'Password is required';
        } else if (currentView === 'signup' && formData.password.length < 6) {
            errors.password = 'Password must be at least 6 characters';
        }
        
        // Signup-specific validation
        if (currentView === 'signup') {
            // Username validation
            if (!formData.username.trim()) {
                errors.username = 'Username is required';
            } else if (formData.username.length < 3) {
                errors.username = 'Username must be at least 3 characters';
            } else if (formData.username.length > 20) {
                errors.username = 'Username must be less than 20 characters';
            } else if (!/^[a-zA-Z0-9_-]+$/.test(formData.username)) {
                errors.username = 'Username can only contain letters, numbers, hyphens, and underscores';
            } else if (usernameAvailable === false) {
                errors.username = 'This username is already taken';
            }
            
            // Confirm password validation
            if (!formData.confirmPassword) {
                errors.confirmPassword = 'Please confirm your password';
            } else if (formData.password !== formData.confirmPassword) {
                errors.confirmPassword = 'Passwords do not match';
            }
            
            // Terms agreement
            if (!formData.agreedToTerms) {
                errors.agreedToTerms = 'You must agree to the terms and conditions';
            }
        }
        
        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    };

    // Handle form input changes
    const handleInputChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        
        // Clear validation error for this field
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
            await signUp(
                formData.email.trim(),
                formData.password,
                formData.username.trim(),
                {
                    displayName: formData.displayName.trim() || formData.username.trim(),
                    bio: `Welcome to my marching.art profile!`,
                    joinedAt: new Date(),
                    settings: {
                        emailNotifications: true,
                        profileVisibility: 'public',
                        showStats: true
                    }
                }
            );
            
            toast.success('Account created successfully! Please verify your email.');
            onAuthSuccess?.();
            
        } catch (err) {
            console.error('Sign up error:', err);
            setError(err.message);
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
            await signIn(formData.email.trim(), formData.password);
            toast.success('Welcome back!');
            onAuthSuccess?.();
            
        } catch (err) {
            console.error('Sign in error:', err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    // Handle password reset
    const handlePasswordReset = async (e) => {
        e.preventDefault();
        
        if (!formData.email.trim()) {
            setError('Please enter your email address.');
            return;
        }
        
        setIsLoading(true);
        setError('');
        
        try {
            await resetPassword(formData.email.trim());
            setCurrentView('login');
        } catch (err) {
            console.error('Password reset error:', err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    // Close modal
    const handleClose = () => {
        if (!isLoading) {
            onClose?.();
        }
    };

    // Handle backdrop click
    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) {
            handleClose();
        }
    };

    // Password strength indicator
    const getPasswordStrength = (password) => {
        if (!password) return { strength: 0, text: '', color: '' };
        
        let strength = 0;
        if (password.length >= 6) strength++;
        if (password.length >= 8) strength++;
        if (/[A-Z]/.test(password)) strength++;
        if (/[a-z]/.test(password)) strength++;
        if (/[0-9]/.test(password)) strength++;
        if (/[^A-Za-z0-9]/.test(password)) strength++;
        
        const levels = [
            { strength: 0, text: '', color: '' },
            { strength: 1, text: 'Very Weak', color: 'text-red-500' },
            { strength: 2, text: 'Weak', color: 'text-orange-500' },
            { strength: 3, text: 'Fair', color: 'text-yellow-500' },
            { strength: 4, text: 'Good', color: 'text-blue-500' },
            { strength: 5, text: 'Strong', color: 'text-green-500' },
            { strength: 6, text: 'Very Strong', color: 'text-green-600' }
        ];
        
        return levels[Math.min(strength, 6)];
    };

    if (!isOpen) return null;

    const passwordStrength = getPasswordStrength(formData.password);

    return (
        <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            onClick={handleBackdropClick}
        >
            <div className="bg-surface dark:bg-surface-dark rounded-2xl border border-accent/20 dark:border-accent-dark/20 shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-accent/10 dark:border-accent-dark/10">
                    <div>
                        <h2 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
                            {currentView === 'signup' ? 'Join marching.art' : 
                             currentView === 'reset' ? 'Reset Password' : 'Welcome Back'}
                        </h2>
                        <p className="text-sm text-text-secondary dark:text-text-secondary-dark mt-1">
                            {currentView === 'signup' ? 'Start your drum corps fantasy journey' : 
                             currentView === 'reset' ? 'Enter your email to reset your password' :
                             'Sign in to continue your journey'}
                        </p>
                    </div>
                    <button
                        onClick={handleClose}
                        className="p-2 hover:bg-accent/10 dark:hover:bg-accent-dark/10 rounded-full transition-colors"
                        disabled={isLoading}
                    >
                        <Icon path="M6 18L18 6M6 6l12 12" className="w-5 h-5 text-text-secondary dark:text-text-secondary-dark" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    {/* General Error */}
                    {error && (
                        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                            <div className="flex items-center gap-2">
                                <Icon path="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" className="w-5 h-5 text-red-500" />
                                <span className="text-red-700 dark:text-red-300 text-sm">{error}</span>
                            </div>
                        </div>
                    )}

                    {/* Sign Up Form */}
                    {currentView === 'signup' && (
                        <form onSubmit={handleSignUp} className="space-y-4">
                            {/* Email */}
                            <div>
                                <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                                    Email Address
                                </label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => handleInputChange('email', e.target.value)}
                                    className={`w-full px-4 py-3 bg-background dark:bg-background-dark border rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-colors ${
                                        validationErrors.email ? 'border-red-500' : 'border-accent dark:border-accent-dark'
                                    }`}
                                    placeholder="your@email.com"
                                    autoComplete="email"
                                />
                                {validationErrors.email && (
                                    <p className="text-red-500 text-sm mt-1">{validationErrors.email}</p>
                                )}
                            </div>

                            {/* Username */}
                            <div>
                                <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                                    Username
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={formData.username}
                                        onChange={(e) => handleInputChange('username', e.target.value)}
                                        className={`w-full px-4 py-3 pr-10 bg-background dark:bg-background-dark border rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-colors ${
                                            validationErrors.username ? 'border-red-500' : 
                                            usernameAvailable === true ? 'border-green-500' :
                                            usernameAvailable === false ? 'border-red-500' :
                                            'border-accent dark:border-accent-dark'
                                        }`}
                                        placeholder="Choose a unique username"
                                        autoComplete="username"
                                    />
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                        {checkingUsername ? (
                                            <Icon path="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25z" className="w-5 h-5 text-text-secondary dark:text-text-secondary-dark animate-spin" />
                                        ) : usernameAvailable === true ? (
                                            <Icon path="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" className="w-5 h-5 text-green-500" />
                                        ) : usernameAvailable === false ? (
                                            <Icon path="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" className="w-5 h-5 text-red-500" />
                                        ) : null}
                                    </div>
                                </div>
                                {validationErrors.username ? (
                                    <p className="text-red-500 text-sm mt-1">{validationErrors.username}</p>
                                ) : usernameAvailable === true ? (
                                    <p className="text-green-500 text-sm mt-1">Username is available!</p>
                                ) : usernameAvailable === false ? (
                                    <p className="text-red-500 text-sm mt-1">Username is already taken</p>
                                ) : null}
                            </div>

                            {/* Display Name */}
                            <div>
                                <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                                    Display Name (Optional)
                                </label>
                                <input
                                    type="text"
                                    value={formData.displayName}
                                    onChange={(e) => handleInputChange('displayName', e.target.value)}
                                    className="w-full px-4 py-3 bg-background dark:bg-background-dark border border-accent dark:border-accent-dark rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
                                    placeholder="How others will see your name"
                                    autoComplete="name"
                                />
                            </div>

                            {/* Password */}
                            <div>
                                <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                                    Password
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={formData.password}
                                        onChange={(e) => handleInputChange('password', e.target.value)}
                                        className={`w-full px-4 py-3 pr-10 bg-background dark:bg-background-dark border rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-colors ${
                                            validationErrors.password ? 'border-red-500' : 'border-accent dark:border-accent-dark'
                                        }`}
                                        placeholder="Create a strong password"
                                        autoComplete="new-password"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-accent/10 dark:hover:bg-accent-dark/10 rounded"
                                    >
                                        <Icon path={showPassword ? "M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" : "M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z M15 12a3 3 0 11-6 0 3 3 0 016 0z"} className="w-5 h-5 text-text-secondary dark:text-text-secondary-dark" />
                                    </button>
                                </div>
                                {validationErrors.password && (
                                    <p className="text-red-500 text-sm mt-1">{validationErrors.password}</p>
                                )}
                                {formData.password && passwordStrength.text && (
                                    <p className={`text-sm mt-1 ${passwordStrength.color}`}>
                                        Password strength: {passwordStrength.text}
                                    </p>
                                )}
                            </div>

                            {/* Confirm Password */}
                            <div>
                                <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                                    Confirm Password
                                </label>
                                <div className="relative">
                                    <input
                                        type={showConfirmPassword ? 'text' : 'password'}
                                        value={formData.confirmPassword}
                                        onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                                        className={`w-full px-4 py-3 pr-10 bg-background dark:bg-background-dark border rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-colors ${
                                            validationErrors.confirmPassword ? 'border-red-500' : 'border-accent dark:border-accent-dark'
                                        }`}
                                        placeholder="Confirm your password"
                                        autoComplete="new-password"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-accent/10 dark:hover:bg-accent-dark/10 rounded"
                                    >
                                        <Icon path={showConfirmPassword ? "M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" : "M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z M15 12a3 3 0 11-6 0 3 3 0 016 0z"} className="w-5 h-5 text-text-secondary dark:text-text-secondary-dark" />
                                    </button>
                                </div>
                                {validationErrors.confirmPassword && (
                                    <p className="text-red-500 text-sm mt-1">{validationErrors.confirmPassword}</p>
                                )}
                            </div>

                            {/* Terms Agreement */}
                            <div className="flex items-start gap-3">
                                <input
                                    type="checkbox"
                                    id="terms"
                                    checked={formData.agreedToTerms}
                                    onChange={(e) => handleInputChange('agreedToTerms', e.target.checked)}
                                    className="mt-1 w-4 h-4 text-primary bg-background dark:bg-background-dark border-accent dark:border-accent-dark rounded focus:ring-primary focus:ring-2"
                                />
                                <label htmlFor="terms" className="text-sm text-text-secondary dark:text-text-secondary-dark">
                                    I agree to the <a href="/terms" className="text-primary hover:underline">Terms of Service</a> and <a href="/privacy" className="text-primary hover:underline">Privacy Policy</a>
                                </label>
                            </div>
                            {validationErrors.agreedToTerms && (
                                <p className="text-red-500 text-sm">{validationErrors.agreedToTerms}</p>
                            )}

                            {/* Sign Up Button */}
                            <button
                                type="submit"
                                disabled={isLoading || loading || usernameAvailable === false}
                                className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-on-primary font-semibold py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2"
                            >
                                {isLoading ? (
                                    <>
                                        <Icon path="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25z" className="w-5 h-5 animate-spin" />
                                        Creating Account...
                                    </>
                                ) : (
                                    'Create Account'
                                )}
                            </button>

                            {/* Switch to Login */}
                            <p className="text-center text-sm text-text-secondary dark:text-text-secondary-dark">
                                Already have an account?{' '}
                                <button
                                    type="button"
                                    onClick={() => setCurrentView('login')}
                                    className="text-primary hover:underline font-medium"
                                >
                                    Sign In
                                </button>
                            </p>
                        </form>
                    )}

                    {/* Login Form */}
                    {currentView === 'login' && (
                        <form onSubmit={handleSignIn} className="space-y-4">
                            {/* Email */}
                            <div>
                                <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                                    Email Address
                                </label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => handleInputChange('email', e.target.value)}
                                    className={`w-full px-4 py-3 bg-background dark:bg-background-dark border rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-colors ${
                                        validationErrors.email ? 'border-red-500' : 'border-accent dark:border-accent-dark'
                                    }`}
                                    placeholder="your@email.com"
                                    autoComplete="email"
                                />
                                {validationErrors.email && (
                                    <p className="text-red-500 text-sm mt-1">{validationErrors.email}</p>
                                )}
                            </div>

                            {/* Password */}
                            <div>
                                <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                                    Password
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={formData.password}
                                        onChange={(e) => handleInputChange('password', e.target.value)}
                                        className={`w-full px-4 py-3 pr-10 bg-background dark:bg-background-dark border rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-colors ${
                                            validationErrors.password ? 'border-red-500' : 'border-accent dark:border-accent-dark'
                                        }`}
                                        placeholder="Enter your password"
                                        autoComplete="current-password"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-accent/10 dark:hover:bg-accent-dark/10 rounded"
                                    >
                                        <Icon path={showPassword ? "M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" : "M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z M15 12a3 3 0 11-6 0 3 3 0 016 0z"} className="w-5 h-5 text-text-secondary dark:text-text-secondary-dark" />
                                    </button>
                                </div>
                                {validationErrors.password && (
                                    <p className="text-red-500 text-sm mt-1">{validationErrors.password}</p>
                                )}
                            </div>

                            {/* Forgot Password */}
                            <div className="flex justify-end">
                                <button
                                    type="button"
                                    onClick={() => setCurrentView('reset')}
                                    className="text-sm text-primary hover:underline"
                                >
                                    Forgot password?
                                </button>
                            </div>

                            {/* Sign In Button */}
                            <button
                                type="submit"
                                disabled={isLoading || loading}
                                className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-on-primary font-semibold py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2"
                            >
                                {isLoading ? (
                                    <>
                                        <Icon path="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25z" className="w-5 h-5 animate-spin" />
                                        Signing In...
                                    </>
                                ) : (
                                    'Sign In'
                                )}
                            </button>

                            {/* Switch to Sign Up */}
                            <p className="text-center text-sm text-text-secondary dark:text-text-secondary-dark">
                                Don't have an account?{' '}
                                <button
                                    type="button"
                                    onClick={() => setCurrentView('signup')}
                                    className="text-primary hover:underline font-medium"
                                >
                                    Join Now
                                </button>
                            </p>
                        </form>
                    )}

                    {/* Password Reset Form */}
                    {currentView === 'reset' && (
                        <form onSubmit={handlePasswordReset} className="space-y-4">
                            {/* Email */}
                            <div>
                                <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                                    Email Address
                                </label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => handleInputChange('email', e.target.value)}
                                    className={`w-full px-4 py-3 bg-background dark:bg-background-dark border rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-colors ${
                                        validationErrors.email ? 'border-red-500' : 'border-accent dark:border-accent-dark'
                                    }`}
                                    placeholder="Enter your account email"
                                    autoComplete="email"
                                />
                                {validationErrors.email && (
                                    <p className="text-red-500 text-sm mt-1">{validationErrors.email}</p>
                                )}
                            </div>

                            {/* Reset Button */}
                            <button
                                type="submit"
                                disabled={isLoading || loading}
                                className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-on-primary font-semibold py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2"
                            >
                                {isLoading ? (
                                    <>
                                        <Icon path="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25z" className="w-5 h-5 animate-spin" />
                                        Sending Reset Link...
                                    </>
                                ) : (
                                    'Send Reset Link'
                                )}
                            </button>

                            {/* Back to Login */}
                            <p className="text-center text-sm text-text-secondary dark:text-text-secondary-dark">
                                Remember your password?{' '}
                                <button
                                    type="button"
                                    onClick={() => setCurrentView('login')}
                                    className="text-primary hover:underline font-medium"
                                >
                                    Sign In
                                </button>
                            </p>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AuthModal;