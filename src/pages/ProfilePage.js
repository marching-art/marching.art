import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, dataNamespace } from '../firebase';
import { useUserStore } from '../store/userStore'; // ADDED: Import the user store
import { getAllUserCorps, CORPS_CLASSES, CORPS_CLASS_ORDER } from '../utils/profileCompatibility';
import Icon from '../components/ui/Icon';
import UniformDisplay from '../components/profile/UniformDisplay';
import TrophyCase from '../components/profile/TrophyCase';
import AchievementsCase from '../components/profile/AchievementsCase';
import SeasonArchive from '../components/profile/SeasonArchive';
import UniformBuilder from '../components/profile/UniformBuilder';
import CommentsSection from '../components/profile/CommentsSection';

// ... (timeSince, MySchedule, and CorpsSummary components remain the same)
const timeSince = (date) => { /* ... */ };
const MySchedule = ({ profile }) => { /* ... */ };
const CorpsSummary = ({ profile }) => { /* ... */ };


// MODIFIED: Component now only needs viewingUserId and gets logged-in user from the store
const ProfilePage = ({ viewingUserId }) => {
    const { loggedInProfile } = useUserStore(); // ADDED: Get logged-in user's data from the store
    const loggedInUserId = loggedInProfile?.userId;

    const [profile, setProfile] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isEditingBio, setIsEditingBio] = useState(false);
    const [bioText, setBioText] = useState('');
    const [isBuildingUniform, setIsBuildingUniform] = useState(false);
    const [timeSinceActive, setTimeSinceActive] = useState('');
    const [seasonSettings, setSeasonSettings] = useState(null);
    const [fantasyRecaps, setFantasyRecaps] = useState(null);

    // MODIFIED: Determine if the viewer is the owner of the profile
    const isOwner = viewingUserId === loggedInUserId;
    const profileUserId = viewingUserId || loggedInUserId;

    useEffect(() => {
        const fetchProfileData = async () => {
            setIsLoading(true);

            if (!profileUserId) {
                setIsLoading(false);
                return;
            }
            
            // --- SOLUTION ---
            // This logic is now corrected
            if (isOwner && loggedInProfile) {
                // If you're viewing your own profile, use the data we already have from the store.
                setProfile(loggedInProfile);
                setIsLoading(false);
            } else {
                // If you're viewing someone else's profile, fetch it from Firestore.
                try {
                    const userDocRef = doc(db, 'artifacts', dataNamespace, 'users', profileUserId, 'profile', 'data');
                    const docSnap = await getDoc(userDocRef);
                    if (docSnap.exists()) {
                        setProfile({ userId: profileUserId, ...docSnap.data() });
                    } else {
                        setProfile(null);
                    }
                } catch (error) {
                    console.error("Error fetching user profile:", error);
                    setProfile(null);
                } finally {
                    setIsLoading(false);
                }
            }
            // --- END SOLUTION ---
        };

        fetchProfileData();
    }, [viewingUserId, loggedInUserId, loggedInProfile, isOwner, profileUserId]);

    useEffect(() => {
        // This effect now targets the specific profile being viewed, not just the owner
        const fetchCurrentSeasonData = async () => {
            if (!profile) return; // Don't run if there's no profile loaded
            
            const seasonRef = doc(db, 'game-settings', 'season');
            const seasonSnap = await getDoc(seasonRef);
            if (seasonSnap.exists()) {
                const settings = seasonSnap.data();
                setSeasonSettings(settings);

                // Only fetch recaps if the profile is for the active season
                if (profile.activeSeasonId === settings.seasonUid) {
                    const recapRef = doc(db, 'fantasy_recaps', settings.seasonUid);
                    const recapSnap = await getDoc(recapRef);
                    if (recapSnap.exists()) {
                        setFantasyRecaps(recapSnap.data());
                    }
                } else {
                    setFantasyRecaps(null);
                }
            }
        };
        fetchCurrentSeasonData();
    }, [profile]); // Re-run when the profile data is loaded
    
    // ... (rest of the component's functions and JSX are the same)
    
    useEffect(() => {
        setBioText(profile?.bio || '');
    }, [profile]);

    useEffect(() => {
        if (profile?.lastActive) {
            setTimeSinceActive(timeSince(profile.lastActive));
            const intervalId = setInterval(() => setTimeSinceActive(timeSince(profile.lastActive)), 60000);
            return () => clearInterval(intervalId);
        } else {
            setTimeSinceActive('never');
        }
    }, [profile?.lastActive]);

    const handleSaveBio = async () => { /* ... */ };
    const handleSaveUniform = async (newUniform) => { /* ... */ };

    if (isLoading) {
        return <div className="p-8 text-center text-text-secondary dark:text-text-secondary-dark">Loading profile...</div>;
    }
    if (!profile) {
        return <div className="p-8 text-center text-text-secondary dark:text-text-secondary-dark">Profile not found.</div>;
    }

    const defaultUniform = { /* ... */ };
    const userUniform = profile?.uniform ? { ...defaultUniform, ...profile.uniform } : defaultUniform;

    return (
        <>
           {/* ... Rest of JSX ... */}
           <CommentsSection
                profileOwnerId={profileUserId}
                // No longer need to pass loggedInProfile, the component gets it from the store
            />
           {/* ... */}
        </>
    );
};
export default ProfilePage;