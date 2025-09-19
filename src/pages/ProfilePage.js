import React, { useState, useEffect } from 'react';
import { doc, getDoc, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db, dataNamespace } from '../firebase';
import { useUserStore } from '../store/userStore';
import { getAllUserCorps } from '../utils/profileCompatibility';

// Import your profile components
import UniformDisplay from '../components/profile/UniformDisplay';
import UniformBuilderContainer from '../components/profile/UniformBuilderContainer';
import TrophyCase from '../components/profile/TrophyCase';
import AchievementsCase from '../components/profile/AchievementsCase';
import SeasonArchive from '../components/profile/SeasonArchive';
import CommentsSection from '../components/profile/CommentsSection';

const ProfilePage = ({ viewingUserId }) => {
    const { loggedInProfile, user, isLoadingAuth } = useUserStore();
    
    // Determine which user's profile we're viewing
    const targetUserId = viewingUserId || user?.uid;
    const isViewingOwnProfile = targetUserId === user?.uid;
    
    // Profile state
    const [viewingProfile, setViewingProfile] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isEditingUniform, setIsEditingUniform] = useState(false);
    
    // Season data state
    const [seasonSettings, setSeasonSettings] = useState(null);
    const [fantasyRecaps, setFantasyRecaps] = useState(null);

    useEffect(() => {
        const fetchProfileData = async () => {
            if (isLoadingAuth) return;
            
            if (!targetUserId) {
                setError('No user ID provided');
                setIsLoading(false);
                return;
            }

            setIsLoading(true);
            setError(null);

            try {
                // If viewing own profile, use data from store
                if (isViewingOwnProfile && loggedInProfile) {
                    setViewingProfile(loggedInProfile);
                } else {
                    // Fetch other user's profile
                    const profileRef = doc(db, `artifacts/${dataNamespace}/users/${targetUserId}/profile/data`);
                    const profileSnap = await getDoc(profileRef);
                    
                    if (profileSnap.exists()) {
                        setViewingProfile({ userId: targetUserId, ...profileSnap.data() });
                    } else {
                        setError('Profile not found');
                        setIsLoading(false);
                        return;
                    }
                }

                // Fetch season settings and fantasy recaps in parallel
                const [seasonDoc, recapsQuery] = await Promise.all([
                    getDoc(doc(db, 'game-settings', 'season')),
                    getDocs(query(collection(db, 'fantasy_recaps'), orderBy('seasonName', 'desc'), limit(10)))
                ]);

                if (seasonDoc.exists()) {
                    setSeasonSettings(seasonDoc.data());
                }

                const recapsData = recapsQuery.docs.find(doc => 
                    doc.data().recaps?.some(recap => 
                        recap.shows?.some(show => 
                            show.results?.some(result => result.uid === targetUserId)
                        )
                    )
                );

                if (recapsData) {
                    setFantasyRecaps(recapsData.data());
                }

            } catch (err) {
                console.error('Error fetching profile data:', err);
                setError('Failed to load profile data');
            } finally {
                setIsLoading(false);
            }
        };

        fetchProfileData();
    }, [targetUserId, isViewingOwnProfile, loggedInProfile, isLoadingAuth]);

    // Handle uniform save success - update local state
    const handleUniformSaveSuccess = (newUniform) => {
        setViewingProfile(prev => ({ ...prev, uniform: newUniform }));
        
        // If this is the logged-in user's profile, we should also refresh the store
        // This could be done by calling a refresh function from the store if needed
    };

    // Loading state
    if (isLoadingAuth || isLoading) {
        return (
            <div className="min-h-screen bg-background dark:bg-background-dark flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary dark:border-primary-dark"></div>
                    <p className="mt-4 text-text-secondary dark:text-text-secondary-dark">
                        {isLoadingAuth ? 'Loading...' : 'Loading profile...'}
                    </p>
                </div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="min-h-screen bg-background dark:bg-background-dark flex items-center justify-center p-8">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-red-600 mb-4">Profile Error</h2>
                    <p className="text-text-secondary dark:text-text-secondary-dark">{error}</p>
                </div>
            </div>
        );
    }

    // No profile found
    if (!viewingProfile) {
        return (
            <div className="min-h-screen bg-background dark:bg-background-dark flex items-center justify-center p-8">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark mb-4">Profile Not Found</h2>
                    <p className="text-text-secondary dark:text-text-secondary-dark">
                        The requested profile could not be found.
                    </p>
                </div>
            </div>
        );
    }

    const userCorps = getAllUserCorps(viewingProfile);
    const hasAnyCorps = Object.keys(userCorps).length > 0;

    return (
        <div className="min-h-screen bg-background dark:bg-background-dark">
            {/* Uniform Builder Modal - Now using the container component */}
            <UniformBuilderContainer
                isOpen={isEditingUniform}
                onClose={() => setIsEditingUniform(false)}
                initialUniform={viewingProfile.uniform}
                onSaveSuccess={handleUniformSaveSuccess}
            />

            <div className="container mx-auto px-4 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column - Profile Info */}
                    <div className="lg:col-span-1 space-y-6">
                        {/* Profile Header */}
                        <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark shadow-theme text-center">
                            <div className="flex flex-col items-center space-y-4">
                                {/* Avatar */}
                                <div className="relative">
                                    <UniformDisplay uniform={viewingProfile.uniform} />
                                    {isViewingOwnProfile && (
                                        <button
                                            onClick={() => setIsEditingUniform(true)}
                                            className="absolute bottom-2 right-2 bg-primary hover:opacity-90 text-on-primary p-2 rounded-full shadow-lg transition-all"
                                            title="Edit Uniform"
                                        >
                                            ✏️
                                        </button>
                                    )}
                                </div>

                                {/* User Info */}
                                <div>
                                    <h1 className="text-2xl font-bold text-primary dark:text-primary-dark">
                                        {viewingProfile.username || 'Unknown User'}
                                    </h1>
                                    {viewingProfile.bio && (
                                        <p className="text-text-secondary dark:text-text-secondary-dark mt-2 italic">
                                            {viewingProfile.bio}
                                        </p>
                                    )}
                                </div>

                                {/* Corps Summary */}
                                {hasAnyCorps && (
                                    <div className="w-full mt-4 pt-4 border-t border-accent dark:border-accent-dark">
                                        <h3 className="font-semibold text-text-primary dark:text-text-primary-dark mb-2">Active Corps</h3>
                                        <div className="space-y-2">
                                            {Object.entries(userCorps).map(([corpsClass, corps]) => (
                                                <div key={corpsClass} className="flex justify-between items-center text-sm">
                                                    <span className="text-text-secondary dark:text-text-secondary-dark">
                                                        {corps.corpsName}
                                                    </span>
                                                    <span className="font-bold text-primary dark:text-primary-dark">
                                                        {(corps.totalSeasonScore || 0).toFixed(3)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Trophy Case */}
                        <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark shadow-theme">
                            <TrophyCase trophies={viewingProfile.trophies} />
                        </div>

                        {/* Achievements */}
                        <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark shadow-theme">
                            <AchievementsCase achievements={viewingProfile.achievements || []} />
                        </div>
                    </div>

                    {/* Right Column - Activity */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Season Archive */}
                        <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark shadow-theme">
                            <SeasonArchive
                                seasons={viewingProfile.seasons || []}
                                userId={targetUserId}
                                seasonSettings={seasonSettings}
                                fantasyRecaps={fantasyRecaps}
                                theme="dark" // You might want to pass the actual theme
                            />
                        </div>

                        {/* Comments Section */}
                        <CommentsSection
                            profileOwnerId={targetUserId}
                            loggedInProfile={loggedInProfile}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProfilePage;