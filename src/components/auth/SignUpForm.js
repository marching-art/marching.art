// src/components/auth/SignUpForm.js - Enhanced UX with improved validation and onboarding
import React, { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../firebase';
import { checkUsername, createUserProfile } from '../../utils/api';
import Icon from '../ui/Icon';

const SignUpForm = ({ onSignUpSuccess, switchToLogin }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [username, setUsername] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [passwordStrength, setPasswordStrength] = useState(0);
    const [fieldValidation, setFieldValidation] = useState({
        username: null,
        email: null,
        password: null,
        confirmPassword: null
    });
    const [step, setStep] = useState(1); // 1: Account details, 2: Welcome onboarding

    // Password strength calculation
    const calculatePasswordStrength = (pwd) => {
        let strength = 0;
        if (pwd.length >= 8) strength++;
        if (/[a-z]/.test(pwd)) strength++;
        if (/[A-Z]/.test(pwd)) strength++;
        if (/\d/.test(pwd)) strength++;
        if (/[!@#$%^&*(),.?":{}|<>]/.test(pwd)) strength++;
        return strength;
    };

    const handlePasswordChange = (value) => {
        setPassword(value);
        setPasswordStrength(calculatePasswordStrength(value));
        
        if (value.length > 0) {
            setFieldValidation(prev => ({
                ...prev,
                password: value.length >= 6 ? 'valid' : 'invalid'
            }));
        } else {
            setFieldValidation(prev => ({ ...prev, password: null }));
        }
    };

    const handleConfirmPasswordChange = (value) => {
        setConfirmPassword(value);
        if (value.length > 0) {
            setFieldValidation(prev => ({
                ...prev,
                confirmPassword: value === password ? 'valid' : 'invalid'
            }));
        } else {
            setFieldValidation(prev => ({ ...prev, confirmPassword: null }));
        }
    };

    const handleUsernameChange = (value) => {
        const cleaned = value.replace(/[^a-zA-Z0-9_]/g, '');
        setUsername(cleaned);
        
        if (cleaned.length >= 3 && cleaned.length <= 15) {
            setFieldValidation(prev => ({ ...prev, username: 'checking' }));
            // Debounce username check
            const timeoutId = setTimeout(async () => {
                try {
                    await checkUsername({ username: cleaned });
                    setFieldValidation(prev => ({ ...prev, username: 'valid' }));
                } catch (err) {
                    setFieldValidation(prev => ({ ...prev, username: 'invalid' }));
                }
            }, 500);
            return () => clearTimeout(timeoutId);
        } else if (cleaned.length > 0) {
            setFieldValidation(prev => ({ ...prev, username: 'invalid' }));
        } else {
            setFieldValidation(prev => ({ ...prev, username: null }));
        }
    };

    const handleEmailChange = (value) => {
        setEmail(value);
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (value.length > 0) {
            setFieldValidation(prev => ({
                ...prev,
                email: emailRegex.test(value) ? 'valid' : 'invalid'
            }));
        } else {
            setFieldValidation(prev => ({ ...prev, email: null }));
        }
    };

    const handleSignUp = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        const trimmedUsername = username.trim();

        // Validation checks
        if (!trimmedUsername || trimmedUsername.length < 3) {
            setError("Username must be at least 3 characters long.");
            setIsLoading(false);
            return;
        }

        if (password.length < 6) {
            setError("Password must be at least 6 characters long.");
            setIsLoading(false);
            return;
        }

        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            setIsLoading(false);
            return;
        }

        try {
            // Final username check
            await checkUsername({ username: trimmedUsername });

            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            
            await createUserProfile({ 
                username: trimmedUsername,
                email: user.email 
            });
            
            setStep(2); // Move to welcome step

        } catch (err) {
            console.error('Sign up error:', err);
            if (err.message.includes('already-exists')) {
                setError("This username is already taken. Please choose another one.");
            } else if (err.message.includes('email-already-in-use')) {
                setError("An account with this email already exists.");
            } else {
                setError(err.message || 'An error occurred during sign up. Please try again.');
            }
        }
        setIsLoading(false);
    };

    const getFieldIcon = (field) => {
        const status = fieldValidation[field];
        if (status === 'valid') return <Icon path="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" className="w-4 h-4 text-green-500" />;
        if (status === 'invalid') return <Icon path="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" className="w-4 h-4 text-red-500" />;
        if (status === 'checking') return <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>;
        return null;
    };

    const getPasswordStrengthColor = () => {
        if (passwordStrength >= 4) return 'bg-green-500';
        if (passwordStrength >= 3) return 'bg-yellow-500';
        if (passwordStrength >= 2) return 'bg-orange-500';
        return 'bg-red-500';
    };

    const getPasswordStrengthText = () => {
        if (passwordStrength >= 4) return 'Very Strong';
        if (passwordStrength >= 3) return 'Strong';
        if (passwordStrength >= 2) return 'Moderate';
        if (passwordStrength >= 1) return 'Weak';
        return 'Very Weak';
    };

    if (step === 2) {
        return (
            <div className="space-y-6 text-center">
                <div className="mb-8">
                    <div className="w-20 h-20 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Icon path="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" className="w-10 h-10 text-green-600 dark:text-green-400" />
                    </div>
                    <h2 className="text-3xl font-bold text-text-primary dark:text-text-primary-dark mb-2">
                        Welcome to marching.art!
                    </h2>
                    <p className="text-lg text-text-secondary dark:text-text-secondary-dark">
                        Your account has been created successfully, {username}!
                    </p>
                </div>

                <div className="bg-primary/10 dark:bg-primary/20 rounded-2xl p-6 text-left">
                    <h3 className="font-bold text-text-primary dark:text-text-primary-dark mb-4 text-lg">
                        🎉 What's Next?
                    </h3>
                    <div className="space-y-3 text-sm">
                        <div className="flex items-start gap-3">
                            <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center text-white text-xs font-bold">1</div>
                            <div>
                                <p className="font-semibold text-text-primary dark:text-text-primary-dark">Create Your First Corps</p>
                                <p className="text-text-secondary dark:text-text-secondary-dark">Choose from World Class, Open Class, A Class, or try SoundSport!</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center text-white text-xs font-bold">2</div>
                            <div>
                                <p className="font-semibold text-text-primary dark:text-text-primary-dark">Build Your Dream Lineup</p>
                                <p className="text-text-secondary dark:text-text-secondary-dark">Select performers for 8 captions within your point budget</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center text-white text-xs font-bold">3</div>
                            <div>
                                <p className="font-semibold text-text-primary dark:text-text-primary-dark">Join Leagues & Compete</p>
                                <p className="text-text-secondary dark:text-text-secondary-dark">Create or join leagues with friends for epic showdowns!</p>
                            </div>
                        </div>
                    </div>
                </div>

                <button 
                    onClick={onSignUpSuccess}
                    className="w-full bg-primary hover:opacity-90 text-on-primary font-bold py-3 px-6 rounded-theme transition-all text-lg"
                >
                    Enter marching.art Dashboard
                </button>
                
                <p className="text-xs text-text-secondary dark:text-text-secondary-dark">
                    Your adventure in drum corps fantasy begins now! 🥁
                </p>
            </div>
        );
    }

    return (
        <form onSubmit={handleSignUp} className="space-y-4">
            <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark mb-2">
                    Join marching.art
                </h2>
                <p className="text-text-secondary dark:text-text-secondary-dark">
                    Create your account and start building your dream corps
                </p>
            </div>

            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 p-3 rounded-theme text-sm flex items-start gap-2">
                    <Icon path="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    {error}
                </div>
            )}
            
            {/* Username Field */}
            <div>
                <label className="block text-sm font-semibold text-text-primary dark:text-text-primary-dark mb-1">
                    Username
                </label>
                <div className="relative">
                    <input 
                        type="text" 
                        value={username} 
                        onChange={(e) => handleUsernameChange(e.target.value)} 
                        placeholder="Choose a unique username"
                        className="w-full bg-background dark:bg-background-dark border-theme border-accent dark:border-accent-dark rounded-theme p-3 pr-10 text-text-primary dark:text-text-primary-dark placeholder:text-text-secondary focus:ring-2 focus:ring-primary focus:border-primary" 
                        maxLength={15}
                    />
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        {getFieldIcon('username')}
                    </div>
                </div>
                <p className="text-xs text-text-secondary dark:text-text-secondary-dark mt-1">
                    3-15 characters, letters, numbers, and underscores only
                </p>
            </div>
            
            {/* Email Field */}
            <div>
                <label className="block text-sm font-semibold text-text-primary dark:text-text-primary-dark mb-1">
                    Email Address
                </label>
                <div className="relative">
                    <input 
                        type="email" 
                        value={email} 
                        onChange={(e) => handleEmailChange(e.target.value)} 
                        placeholder="your.email@example.com" 
                        className="w-full bg-background dark:bg-background-dark border-theme border-accent dark:border-accent-dark rounded-theme p-3 pr-10 text-text-primary dark:text-text-primary-dark placeholder:text-text-secondary focus:ring-2 focus:ring-primary focus:border-primary" 
                    />
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        {getFieldIcon('email')}
                    </div>
                </div>
            </div>
            
            {/* Password Field */}
            <div>
                <label className="block text-sm font-semibold text-text-primary dark:text-text-primary-dark mb-1">
                    Password
                </label>
                <div className="relative">
                    <input 
                        type={showPassword ? "text" : "password"} 
                        value={password} 
                        onChange={(e) => handlePasswordChange(e.target.value)} 
                        placeholder="Create a strong password" 
                        className="w-full bg-background dark:bg-background-dark border-theme border-accent dark:border-accent-dark rounded-theme p-3 pr-20 text-text-primary dark:text-text-primary-dark placeholder:text-text-secondary focus:ring-2 focus:ring-primary focus:border-primary" 
                    />
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
                        {getFieldIcon('password')}
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark"
                        >
                            <Icon path={showPassword ? "M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" : "M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z M15 12a3 3 0 11-6 0 3 3 0 016 0z"} className="w-4 h-4" />
                        </button>
                    </div>
                </div>
                {password.length > 0 && (
                    <div className="mt-2">
                        <div className="flex items-center gap-2 mb-1">
                            <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div 
                                    className={`h-full transition-all duration-300 ${getPasswordStrengthColor()}`}
                                    style={{ width: `${(passwordStrength / 5) * 100}%` }}
                                />
                            </div>
                            <span className="text-xs font-semibold text-text-secondary dark:text-text-secondary-dark">
                                {getPasswordStrengthText()}
                            </span>
                        </div>
                        <p className="text-xs text-text-secondary dark:text-text-secondary-dark">
                            Use 8+ characters with uppercase, lowercase, numbers & symbols
                        </p>
                    </div>
                )}
            </div>

            {/* Confirm Password Field */}
            <div>
                <label className="block text-sm font-semibold text-text-primary dark:text-text-primary-dark mb-1">
                    Confirm Password
                </label>
                <div className="relative">
                    <input 
                        type="password" 
                        value={confirmPassword} 
                        onChange={(e) => handleConfirmPasswordChange(e.target.value)} 
                        placeholder="Confirm your password" 
                        className="w-full bg-background dark:bg-background-dark border-theme border-accent dark:border-accent-dark rounded-theme p-3 pr-10 text-text-primary dark:text-text-primary-dark placeholder:text-text-secondary focus:ring-2 focus:ring-primary focus:border-primary" 
                    />
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        {getFieldIcon('confirmPassword')}
                    </div>
                </div>
            </div>
            
            <button 
                type="submit" 
                disabled={isLoading || Object.values(fieldValidation).some(v => v === 'invalid') || !Object.values(fieldValidation).every(v => v === 'valid')}
                className="w-full bg-primary hover:opacity-90 text-on-primary font-bold py-3 px-4 rounded-theme transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {isLoading ? (
                    <div className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Creating Account...
                    </div>
                ) : 'Create Account'}
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