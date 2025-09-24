// src/pages/ProfilePage.js - UPDATED: Enhanced profile display with uniform showcase integration
import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { db, dataNamespace } from '../firebase';
import { getAllUserCorps, CORPS_CLASSES, CORPS_CLASS_ORDER } from '../utils/profileCompatibility';
import LoadingScreen from '../components/ui/LoadingScreen';
import Icon from '../components/ui/Icon';
import UniformDisplay from '../components/profile/UniformDisplay';
import CommentsSection from '../components/profile/CommentsSection';

// Enhanced Corps Profile Card with Uniform Display
const CorpsProfileCard = ({ corpsClass, corps, classConfig, selectedUniform, onUniformChange }) => {
    const uniforms = corps?.uniforms || {};
    const uniformSlots = [0, 1, 2, 3].map(slot => uniforms[slot.toString()] || null);
    const activeUniform = uniformSlots[selectedUniform] || null;
    const uniformCount = uniformSlots.filter(u => u !== null).length;

    return (
        <div className="bg-surface dark:bg-surface-dark rounded-theme border border-accent dark:border-accent-dark shadow-theme overflow-hidden">
            <div className="bg-gradient-to-r from-primary/10 to-accent/10 dark:from-primary-dark/10 dark:to-accent-dark/10 p-4 border-b border-accent dark:border-accent-dark">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-full ${classConfig?.color || 'bg-gray-400'} opacity-80 flex items-center justify-center`}>
                            <span className="text-white font-bold text-lg">
                                {corps.corpsName?.charAt(0) || 'C'}
                            </span>
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark">
                                {corps.corpsName}
                            </h3>
                            <p className="text-text-secondary dark:text-text-secondary-dark">
                                {classConfig?.name || 'Unknown Class'}
                            </p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-sm text-text-secondary dark:text-text-secondary-dark">
                            {uniformCount}/4 uniforms
                        </p>
                        <div className="flex gap-1 mt-1">
                            {uniformSlots.map((uniform, index) => (
                                <div
                                    key={index}
                                    className={`w-2 h-2 rounded-full ${
                                        uniform ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'
                                    }`}
                                />
                            ))}
                        </div>
                    </div>
                </div>

                {/* Uniform Selector */}
                {uniformCount > 0 && (
                    <div className="mt-4">
                        <div className="flex flex-wrap gap-2">
                            {uniformSlots.map((uniform, index) => (
                                uniform && (
                                    <button
                                        key={index}
                                        onClick={() => onUniformChange(index)}
                                        className={`px-3 py-1 rounded-theme text-xs font-medium transition-colors ${
                                            selectedUniform === index
                                                ? 'bg-primary text-on-primary'
                                                : 'bg-accent dark:bg-accent-dark/20 text-text-secondary dark:text-text-secondary-dark hover:bg-accent-dark dark:hover:bg-accent-dark/40'
                                        }`}
                                    >
                                        {uniform.name || `Uniform ${index + 1}`}
                                    </button>
                                )
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Uniform Display */}
            <div className="p-4">
                {activeUniform ? (
                    <div className="flex justify-center">
                        <div className="transform scale-75">
                            <UniformDisplay uniform={activeUniform} />
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-8 text-text-secondary dark:text-text-secondary-dark">
                        <div className="text-4xl mb-2">🎨</div>
                        <p>No uniforms designed yet</p>
                    </div>
                )}
            </div>

            {/* Corps Stats */}
            <div className="border-t border-accent dark:border-accent-dark p-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                        <p className="text-lg font-bold text-primary dark:text-primary-dark">
                            {corps.members?.length || 0}
                        </p>
                        <p className="text-xs text-text-secondary dark:text-text-secondary-dark">Members</p>
                    </div>
                    <div>
                        <p className="text-lg font-bold text-primary dark:text-primary-dark">
                            {corps.totalPoints || 0}
                        </p>
                        <p className="text-xs text-text-secondary dark:text-text-secondary-dark">Points Used</p>
                    </div>
                    <div>
                        <p className="text-lg font-bold text-primary dark:text-primary-dark">
                            {classConfig?.pointCap || 0}
                        </p>
                        <p className="text-xs text-text-secondary dark:text-text-secondary-dark">Point Cap</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

const CorpsUniformShowcase = ({ profile, isOwner }) => {
    const [selectedCorps, setSelectedCorps] = useState(null);
    const [selectedUniforms, setSelectedUniforms] = useState({}); // Track uniform selection per corps
    
    const userCorps = getAllUserCorps(profile);
    const hasAnyCorps = Object.values(userCorps).some(corps => corps && corps.corpsName);

    if (!hasAnyCorps) {
        return (
            <div className="bg-surface dark:bg-surface-dark rounded-theme border border-accent dark:border-accent-dark shadow-theme p-8 text-center">
                <div className="text-6xl mb-4">🥁</div>
                <h3 className="text-xl font-semibold text-text-primary dark:text-text-primary-dark mb-2">
                    No Corps Yet
                </h3>
                <p className="text-text-secondary dark:text-text-secondary-dark">
                    {isOwner ? "Start your drum corps journey on your dashboard!" : "This director hasn't created any corps yet."}
                </p>
            </div>
        );
    }

    // Get corps with data, prioritize those with uniforms
    const corpsWithData = Object.entries(userCorps)
        .filter(([_, corps]) => corps && corps.corpsName)
        .sort(([a, corpsA], [b, corpsB]) => {
            const uniformsA = corpsA?.uniforms ? Object.keys(corpsA.uniforms).length : 0;
            const uniformsB = corpsB?.uniforms ? Object.keys(corpsB.uniforms).length : 0;
            return uniformsB - uniformsA; // Sort by uniform count descending
        });
    
    // Initialize selected uniforms for each corps
    useEffect(() => {
        const initialSelections = {};
        corpsWithData.forEach(([corpsClass, corps]) => {
            if (!selectedUniforms[corpsClass] && corps?.uniforms) {
                // Select the first available uniform
                const firstUniformSlot = Object.keys(corps.uniforms).find(slot => corps.uniforms[slot]);
                if (firstUniformSlot !== undefined) {
                    initialSelections[corpsClass] = parseInt(firstUniformSlot);
                } else {
                    initialSelections[corpsClass] = 0;
                }
            }
        });
        if (Object.keys(initialSelections).length > 0) {
            setSelectedUniforms(prev => ({ ...prev, ...initialSelections }));
        }
    }, [userCorps]);

    const handleUniformChange = (corpsClass, uniformIndex) => {
        setSelectedUniforms(prev => ({
            ...prev,
            [corpsClass]: uniformIndex
        }));
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-gradient-to-r from-primary/10 to-accent/10 dark:from-primary-dark/10 dark:to-accent-dark/10 rounded-theme p-6 border border-accent dark:border-accent-dark">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark mb-2">
                            Corps Collection
                        </h3>
                        <p className="text-text-secondary dark:text-text-secondary-dark">
                            {isOwner ? "Your custom corps and uniform designs" : `${profile?.username || 'Director'}'s corps and uniform designs`}
                        </p>
                    </div>
                    <div className="text-center">
                        <p className="text-2xl font-bold text-primary dark:text-primary-dark">
                            {corpsWithData.length}
                        </p>
                        <p className="text-sm text-text-secondary dark:text-text-secondary-dark">
                            Active Corps
                        </p>
                    </div>
                </div>
            </div>

            {/* Corps Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {corpsWithData.map(([corpsClass, corps]) => {
                    const classConfig = CORPS_CLASSES[corpsClass];
                    return (
                        <CorpsProfileCard
                            key={corpsClass}
                            corpsClass={corpsClass}
                            corps={corps}
                            classConfig={classConfig}
                            selectedUniform={selectedUniforms[corpsClass] || 0}
                            onUniformChange={(uniformIndex) => handleUniformChange(corpsClass, uniformIndex)}
                        />
                    );
                })}
            </div>

            {/* Summary Stats */}
            <div className="bg-surface dark:bg-surface-dark rounded-theme border border-accent dark:border-accent-dark p-6">
                <h4 className="text-lg font-bold text-text-primary dark:text-text-primary-dark mb-4">
                    Collection Statistics
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div>
                        <p className="text-2xl font-bold text-primary dark:text-primary-dark">
                            {corpsWithData.length}
                        </p>
                        <p className="text-sm text-text-secondary dark:text-text-secondary-dark">Corps Created</p>
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-primary dark:text-primary-dark">
                            {corpsWithData.reduce((total, [_, corps]) => {
                                return total + (corps?.uniforms ? Object.keys(corps.uniforms).length : 0);
                            }, 0)}
                        </p>
                        <p className="text-sm text-text-secondary dark:text-text-secondary-dark">Total Uniforms</p>
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-primary dark:text-primary-dark">
                            {corpsWithData.reduce((total, [_, corps]) => {
                                return total + (corps?.members?.length || 0);
                            }, 0)}
                        </p>
                        <p className="text-sm text-text-secondary dark:text-text-secondary-dark">Total Members</p>
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-primary dark:text-primary-dark">
                            {Math.round(corpsWithData.reduce((total, [_, corps]) => {
                                return total + (corps?.totalPoints || 0);
                            }, 0) / corpsWithData.length) || 0}
                        </p>
                        <p className="text-sm text-text-secondary dark:text-text-secondary-dark">Avg Points Used</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

const ProfilePage = ({ loggedInProfile, loggedInUserId, viewingUserId }) => {
    const [profile, setProfile] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [seasonStats, setSeasonStats] = useState({});
    
    const profileUserId = viewingUserId || loggedInUserId;
    const isOwner = !viewingUserId || loggedInUserId === viewingUserId;

    useEffect(() => {
        const fetchProfileData = async () => {
            setIsLoading(true);
            
            if (!profileUserId) {
                setProfile(null);
                setIsLoading(false);
                return;
            }
            
            if (isOwner && loggedInProfile) {
                setProfile(loggedInProfile);
                await loadDirectorStats(loggedInProfile);
            } else {
                try {
                    const userDocRef = doc(db, 'artifacts', dataNamespace, 'users', profileUserId, 'profile', 'data');
                    const docSnap = await getDoc(userDocRef);
                    if (docSnap.exists()) {
                        const profileData = { userId: profileUserId, ...docSnap.data() };
                        setProfile(profileData);
                        await loadDirectorStats(profileData);
                    } else {
                        setProfile(null);
                    }
                } catch (error) {
                    console.error("Error fetching user profile:", error);
                    setProfile(null);
                }
            }
            
            setIsLoading(false);
        };

        fetchProfileData();
    }, [viewingUserId, loggedInUserId, loggedInProfile, isOwner, profileUserId]);

    const loadDirectorStats = async (profileData) => {
        if (!profileData) return;

        try {
            // Load season settings
            const seasonRef = doc(db, 'game-settings', 'season');
            const seasonSnap = await getDoc(seasonRef);
            
            if (seasonSnap.exists()) {
                const seasonData = seasonSnap.data();
                // Add season-specific stats loading here if needed
                setSeasonStats({}); // Placeholder for future implementation
            }
        } catch (error) {
            console.error("Error loading director stats:", error);
        }
    };

    if (isLoading) {
        return <LoadingScreen />;
    }

    if (!profile) {
        return (
            <div className="p-8 text-center">
                <h2 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark mb-4">
                    Profile Not Found
                </h2>
                <p className="text-text-secondary dark:text-text-secondary-dark">
                    {viewingUserId ? "The requested profile could not be found." : "Please sign in to view your profile."}
                </p>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
            {/* Profile Header */}
            <div className="bg-gradient-to-r from-primary/20 to-accent/20 dark:from-primary-dark/20 dark:to-accent-dark/20 rounded-theme p-8 text-center">
                <div className="flex flex-col items-center space-y-4">
                    <div className="w-24 h-24 bg-primary rounded-full flex items-center justify-center text-4xl font-bold text-on-primary">
                        {profile.username?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-text-primary dark:text-text-primary-dark">
                            {profile.username || 'Anonymous Director'}
                        </h1>
                        <p className="text-text-secondary dark:text-text-secondary-dark mt-2">
                            Fantasy Drum Corps Director
                        </p>
                    </div>
                    {profile.bio && (
                        <p className="text-text-secondary dark:text-text-secondary-dark max-w-2xl">
                            {profile.bio}
                        </p>
                    )}
                </div>
            </div>

            {/* Corps & Uniforms Showcase */}
            <CorpsUniformShowcase 
                profile={profile} 
                isOwner={isOwner}
            />

            {/* Comments Section */}
            {!isOwner && (
                <CommentsSection 
                    profileUserId={profileUserId}
                    loggedInUserId={loggedInUserId}
                    loggedInProfile={loggedInProfile}
                />
            )}
        </div>
    );
};

export default ProfilePage;