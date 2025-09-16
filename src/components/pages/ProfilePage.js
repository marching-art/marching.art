import React, { useState, useEffect } from 'react';
import { doc, updateDoc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db, appId } from '../../firebase';
import Icon from '../ui/Icon';
import UniformDisplay from '../profile/UniformDisplay';
import TrophyCase from '../profile/TrophyCase';
import SeasonArchive from '../profile/SeasonArchive';
import UniformBuilder from '../profile/UniformBuilder'; // Import the new builder

// This function calculates the difference between a given date and now,
// returning a human-readable string like "5 minutes ago".
const timeSince = (date) => {
    if (!date) return 'never';

    // Handle Firebase Timestamp objects by converting them to JS Date objects
    const dateObj = date.toDate ? date.toDate() : new Date(date);
    const seconds = Math.floor((new Date() - dateObj) / 1000);

    let interval = seconds / 31536000; // years
    if (interval > 1) return Math.floor(interval) + " years ago";
    
    interval = seconds / 2592000; // months
    if (interval > 1) return Math.floor(interval) + " months ago";

    interval = seconds / 86400; // days
    if (interval > 1) return Math.floor(interval) + " days ago";

    interval = seconds / 3600; // hours
    if (interval > 1) return Math.floor(interval) + " hours ago";

    interval = seconds / 60; // minutes
    if (interval > 1) return Math.floor(interval) + " minutes ago";

    return "a moment ago";
};

// --- Child Components ---

const MySchedule = ({ profile }) => {
    if (!profile.activeSeasonId || !profile.selectedShows) {
        return (
            <div className="bg-brand-surface dark:bg-brand-surface-dark p-6 rounded-lg border-2 border-brand-secondary shadow-lg">
                <h3 className="text-2xl font-bold text-brand-primary dark:text-brand-secondary-dark mb-4">My Season Schedule</h3>
                <p className="text-brand-text-secondary dark:text-brand-text-secondary-dark">No shows have been selected for the current season.</p>
            </div>
        );
    }
    
    const weeks = Object.keys(profile.selectedShows).sort((a, b) => parseInt(a.replace('week', '')) - parseInt(b.replace('week', '')));

    return (
        <div className="bg-brand-surface dark:bg-brand-surface-dark p-6 rounded-lg border-2 border-brand-secondary shadow-lg">
            <h3 className="text-2xl font-bold text-brand-primary dark:text-brand-secondary-dark mb-4">My Season Schedule</h3>
            <div className="space-y-4">
                {weeks.map(weekKey => {
                    const weekNum = weekKey.replace('week', '');
                    const shows = profile.selectedShows[weekKey];
                    return (
                        <div key={weekKey}>
                            <h4 className="font-semibold text-brand-text-primary dark:text-brand-text-primary-dark">Week {weekNum}</h4>
                            {shows && shows.length > 0 ? (
                                <ul className="list-disc list-inside pl-2 mt-1 text-sm text-brand-text-secondary dark:text-brand-text-secondary-dark">
                                    {shows.map((show, index) => (
                                        <li key={index}>{show.eventName.replace(/DCI/g, 'marching.art')} - <em className="text-brand-accent dark:text-brand-accent-dark">{show.location}</em></li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="pl-2 mt-1 text-sm text-brand-text-secondary dark:text-brand-text-secondary-dark">No shows selected for this week.</p>
                            )}
                        </div>
                    );
                })}
                 {weeks.length === 0 && <p className="text-brand-text-secondary dark:text-brand-text-secondary-dark">No shows have been selected for the current season.</p>}
            </div>
        </div>
    );
};

// --- Main ProfilePage Component ---

const ProfilePage = ({ profile, userId }) => {
    const isOwner = auth.currentUser?.uid === userId;
    const [isEditingBio, setIsEditingBio] = useState(false);
    const [bioText, setBioText] = useState(profile?.bio || '');
    const [isBuildingUniform, setIsBuildingUniform] = useState(false);
    const [timeSinceActive, setTimeSinceActive] = useState('');
    const [seasonSettings, setSeasonSettings] = useState(null);
    const [fantasyRecaps, setFantasyRecaps] = useState(null);

    const defaultUniform = {
      skinTone: '#d8aa7c',
      headwear: { style: 'shako', colors: { hat: '#1a1a1a', trim: '#ffffff' } },
      plume: { style: 'fountain', colors: { plume: '#ff0000' } },
      jacket: { style: 'sash', colors: { base: '#000080', accent: '#ffffff', trim: '#ffd700' } },
      pants: { style: 'stripe', colors: { base: '#ffffff', stripe: '#000080' } },
      shoes: { style: 'white' },
    };

    const userUniform = profile?.uniform ? { ...defaultUniform, ...profile.uniform } : defaultUniform;
    
    useEffect(() => {
        const fetchCurrentSeasonData = async () => {
            const seasonRef = doc(db, 'game-settings', 'season');
            const seasonSnap = await getDoc(seasonRef);
            if (seasonSnap.exists()) {
                const settings = seasonSnap.data();
                setSeasonSettings(settings);

                const recapRef = doc(db, 'fantasy_recaps', settings.seasonUid);
                const recapSnap = await getDoc(recapRef);
                if (recapSnap.exists()) {
                    setFantasyRecaps(recapSnap.data());
                }
            }
        };

        fetchCurrentSeasonData();
    }, []);
    
    useEffect(() => {
        setBioText(profile?.bio || '');
    }, [profile]);

    useEffect(() => {
        if (profile?.lastActive) {
            const updateLastActive = () => {
                setTimeSinceActive(timeSince(profile.lastActive));
            };

            updateLastActive();

            const intervalId = setInterval(updateLastActive, 60000);

            return () => clearInterval(intervalId);
        } else {
            setTimeSinceActive('never');
        }
    }, [profile?.lastActive]);

    const handleSaveBio = async () => {
        if (!userId) return;
        const userDocRef = doc(db, 'artifacts', appId, 'users', userId, 'profile', 'data');
        try {
            await updateDoc(userDocRef, {
                bio: bioText
            });
            setIsEditingBio(false);
        } catch (error) {
            console.error("Error updating bio:", error);
        }
    };
    
    const handleSaveUniform = async (newUniform) => {
        if (!userId) return;
        const userDocRef = doc(db, 'artifacts', appId, 'users', userId, 'profile', 'data');
        try {
            await setDoc(userDocRef, { uniform: newUniform }, { merge: true });
            setIsBuildingUniform(false);
        } catch (error) {
            console.error("Error saving uniform:", error);
        }
    };


    if (!profile) {
        return <div className="p-8 text-center text-text-secondary">Loading profile...</div>;
    }

    return (
        <>
            {isBuildingUniform && (
                <UniformBuilder 
                    uniform={userUniform}
                    onSave={handleSaveUniform}
                    onCancel={() => setIsBuildingUniform(false)}
                    UniformDisplayComponent={UniformDisplay}
                />
            )}
            <div className="p-4 md:p-8 space-y-8">
                <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
                    <div className="relative">
                        <UniformDisplay uniform={userUniform} />
                        {isOwner && (
                            <button 
                                onClick={() => setIsBuildingUniform(true)} 
                                className="absolute top-2 right-2 bg-primary/80 hover:bg-primary text-on-primary p-2 rounded-full shadow-lg backdrop-blur-sm transition-all"
                                aria-label="Edit Uniform"
                            >
                               <Icon path="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                    <div className="flex-grow text-center md:text-left">
                         <h1 className="text-4xl md:text-5xl font-bold text-text-primary">{profile.username}</h1>
                        {profile.corpsName && (
                            <h2 className="text-2xl font-semibold text-secondary dark:text-secondary-dark mt-1">{profile.corpsName}</h2>
                        )}
                        <p className="text-text-secondary mt-1">
                            Member since {profile.createdAt?.toDate().toLocaleDateString()}
                        </p>
                         <p className="text-text-secondary">
                            Last active: {timeSinceActive}
                        </p>
                        <div className="mt-4 bg-surface dark:bg-surface-dark p-4 rounded-theme border-l-4 border-secondary">
                            {isEditingBio ? (
                                <div className="space-y-2">
                                    <textarea 
                                        value={bioText}
                                        onChange={(e) => setBioText(e.target.value)}
                                        className="w-full bg-background dark:bg-background-dark border-theme border-accent rounded-theme p-2 text-text-primary"
                                        rows="4"
                                    ></textarea>
                                    <div className="flex justify-end space-x-2">
                                        <button onClick={() => setIsEditingBio(false)} className="border-theme border-accent hover:bg-accent/20 text-text-primary font-bold py-1 px-3 rounded-theme text-sm transition-colors">Cancel</button>
                                        <button onClick={handleSaveBio} className="bg-primary hover:bg-primary/80 text-on-primary font-bold py-1 px-3 rounded-theme text-sm">Save</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex justify-between items-start">
                                    <p className="text-text-secondary">{profile.bio || 'No bio has been set.'}</p>
                                    {isOwner && (
                                        <button onClick={() => setIsEditingBio(true)} className="ml-4 text-sm text-secondary hover:underline flex-shrink-0">Edit</button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <div className="grid lg:grid-cols-3 gap-8">                
                    <MySchedule profile={profile} />
                    <TrophyCase trophies={profile.trophies} />
                    <SeasonArchive 
                        seasons={profile.seasons} 
                        userId={userId}
                        seasonSettings={seasonSettings}
                        fantasyRecaps={fantasyRecaps}
                    />                
                </div>
            </div>
        </>
    );
};
export default ProfilePage;