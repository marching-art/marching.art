// src/components/auth/ProfileSetup.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase';
import { useUserStore } from '../../store/userStore';
import toast from 'react-hot-toast';
import Icon from '../ui/Icon';

const ProfileSetup = () => {
    const navigate = useNavigate();
    const { user, loadUserProfile } = useUserStore();
    
    const [formData, setFormData] = useState({
        username: '',
        displayName: '',
        bio: ''
    });
    
    const [isLoading, setIsLoading] = useState(false);
    const [errors, setErrors] = useState({});
    const [usernameAvailable, setUsernameAvailable] = useState(null);
    const [checkingUsername, setCheckingUsername] = useState(false);

    // Initialize Cloud Functions
    const checkUsernameFunc = httpsCallable(functions, 'checkUsername');
    const createUserProfileFunc = httpsCallable(functions, 'createUserProfile');

    const handleInputChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        
        // Clear errors when user starts typing
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: '' }));
        }
        
        // Check username availability
        if (field === 'username') {
            setUsernameAvailable(null);
            checkUsernameAvailability(value);
        }
    };

    const checkUsernameAvailability = async (username) => {
        const trimmedUsername = username.trim();
        
        if (trimmedUsername.length < 3) {
            setUsernameAvailable(null);
            return;
        }

        setCheckingUsername(true);
        
        try {
            await checkUsernameFunc({ username: trimmedUsername });
            setUsernameAvailable(true);
        } catch (error) {
            if (error.code === 'functions/already-exists') {
                setUsernameAvailable(false);
            } else {
                console.error('Error checking username:', error);
                setUsernameAvailable(null);
            }
        } finally {
            setCheckingUsername(false);
        }
    };

    const validateForm = () => {
        const newErrors = {};
        
        if (!formData.username.trim()) {
            newErrors.username = 'Username is required';
        } else if (formData.username.trim().length < 3) {
            newErrors.username = 'Username must be at least 3 characters';
        } else if (formData.username.trim().length > 20) {
            newErrors.username = 'Username must be 20 characters or less';
        } else if (!/^[a-zA-Z0-9_-]+$/.test(formData.username.trim())) {
            newErrors.username = 'Username can only contain letters, numbers, hyphens, and underscores';
        } else if (usernameAvailable === false) {
            newErrors.username = 'Username is already taken';
        }

        if (formData.displayName.length > 50) {
            newErrors.displayName = 'Display name must be 50 characters or less';
        }

        if (formData.bio.length > 500) {
            newErrors.bio = 'Bio must be 500 characters or less';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!validateForm()) {
            return;
        }

        if (checkingUsername || usernameAvailable !== true) {
            toast.error('Please wait for username validation to complete');
            return;
        }

        setIsLoading(true);

        try {
            const profileData = {
                username: formData.username.trim(),
                email: user.email,
                displayName: formData.displayName.trim() || formData.username.trim(),
                bio: formData.bio.trim()
            };

            console.log('Creating profile with data:', profileData);
            
            const result = await createUserProfileFunc(profileData);
            
            if (result.data.success) {
                toast.success('Profile created successfully!');
                
                // Reload user profile to update the state
                await loadUserProfile(user.uid);
                
                // Navigate to dashboard
                navigate('/dashboard', { replace: true });
            } else {
                throw new Error(result.data.message || 'Failed to create profile');
            }
        } catch (error) {
            console.error('Profile creation error:', error);
            
            let errorMessage = 'Failed to create profile';
            
            if (error.code === 'functions/already-exists') {
                errorMessage = 'A profile already exists for this account';
            } else if (error.code === 'functions/invalid-argument') {
                errorMessage = error.message;
            } else if (error.message) {
                errorMessage = error.message;
            }
            
            toast.error(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    if (!user) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <Icon path="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25z" className="w-8 h-8 text-primary dark:text-primary-dark animate-spin mx-auto mb-4" />
                    <p className="text-text-secondary dark:text-text-secondary-dark">Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background dark:bg-background-dark flex items-center justify-center p-4">
            <div className="max-w-md w-full">
                <div className="bg-surface dark:bg-surface-dark rounded-2xl shadow-xl p-8 border border-accent dark:border-accent-dark">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-primary/10 dark:bg-primary-dark/10 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Icon 
                                path="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" 
                                className="w-8 h-8 text-primary dark:text-primary-dark" 
                            />
                        </div>
                        
                        <h1 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark mb-2">
                            Complete Your Profile
                        </h1>
                        
                        <p className="text-text-secondary dark:text-text-secondary-dark">
                            Just a few details to get you started on marching.art
                        </p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Username Field */}
                        <div>
                            <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                                Username *
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={formData.username}
                                    onChange={(e) => handleInputChange('username', e.target.value)}
                                    className={`w-full px-4 py-3 bg-background dark:bg-background-dark border rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-colors pr-10 ${
                                        errors.username ? 'border-red-500' : 'border-accent dark:border-accent-dark'
                                    }`}
                                    placeholder="Choose a unique username"
                                    autoComplete="username"
                                    disabled={isLoading}
                                />
                                
                                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                    {checkingUsername ? (
                                        <Icon path="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25z" className="w-5 h-5 text-text-secondary dark:text-text-secondary-dark animate-spin" />
                                    ) : usernameAvailable === true ? (
                                        <Icon path="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" className="w-5 h-5 text-green-500" />
                                    ) : usernameAvailable === false ? (
                                        <Icon path="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" className="w-5 h-5 text-red-500" />
                                    ) : null}
                                </div>
                            </div>
                            
                            {errors.username ? (
                                <p className="text-red-500 text-sm mt-1">{errors.username}</p>
                            ) : usernameAvailable === true ? (
                                <p className="text-green-500 text-sm mt-1">Username is available!</p>
                            ) : usernameAvailable === false ? (
                                <p className="text-red-500 text-sm mt-1">Username is already taken</p>
                            ) : (
                                <p className="text-text-secondary dark:text-text-secondary-dark text-sm mt-1">
                                    3-20 characters, letters, numbers, hyphens, and underscores only
                                </p>
                            )}
                        </div>

                        {/* Display Name Field */}
                        <div>
                            <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                                Display Name (Optional)
                            </label>
                            <input
                                type="text"
                                value={formData.displayName}
                                onChange={(e) => handleInputChange('displayName', e.target.value)}
                                className={`w-full px-4 py-3 bg-background dark:bg-background-dark border rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-colors ${
                                    errors.displayName ? 'border-red-500' : 'border-accent dark:border-accent-dark'
                                }`}
                                placeholder="How others will see your name"
                                autoComplete="name"
                                disabled={isLoading}
                            />
                            
                            {errors.displayName && (
                                <p className="text-red-500 text-sm mt-1">{errors.displayName}</p>
                            )}
                        </div>

                        {/* Bio Field */}
                        <div>
                            <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                                Bio (Optional)
                            </label>
                            <textarea
                                value={formData.bio}
                                onChange={(e) => handleInputChange('bio', e.target.value)}
                                rows={3}
                                className={`w-full px-4 py-3 bg-background dark:bg-background-dark border rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-colors resize-none ${
                                    errors.bio ? 'border-red-500' : 'border-accent dark:border-accent-dark'
                                }`}
                                placeholder="Tell us about yourself and your drum corps experience..."
                                disabled={isLoading}
                            />
                            
                            <div className="flex justify-between items-center mt-1">
                                {errors.bio ? (
                                    <p className="text-red-500 text-sm">{errors.bio}</p>
                                ) : (
                                    <span></span>
                                )}
                                <p className="text-text-secondary dark:text-text-secondary-dark text-sm">
                                    {formData.bio.length}/500
                                </p>
                            </div>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={isLoading || checkingUsername || usernameAvailable !== true}
                            className="w-full bg-primary hover:bg-primary/90 dark:bg-primary-dark dark:hover:bg-primary-dark/90 text-white font-semibold py-3 px-4 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                        >
                            {isLoading ? (
                                <>
                                    <Icon path="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25z" className="w-5 h-5 animate-spin mr-2" />
                                    Creating Profile...
                                </>
                            ) : (
                                'Complete Setup'
                            )}
                        </button>
                    </form>

                    {/* User Info */}
                    <div className="mt-6 pt-6 border-t border-accent dark:border-accent-dark">
                        <p className="text-sm text-text-secondary dark:text-text-secondary-dark text-center">
                            Signed in as: <span className="font-medium">{user.email}</span>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProfileSetup;