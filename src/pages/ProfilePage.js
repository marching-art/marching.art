import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, dataNamespace } from '../firebase';
import { getAllUserCorps, CORPS_CLASSES, CORPS_CLASS_ORDER } from '../utils/profileCompatibility';
import Icon from '../components/ui/Icon';
import UniformDisplay from '../components/profile/UniformDisplay';
import TrophyCase from '../components/profile/TrophyCase';
import AchievementsCase from '../components/profile/AchievementsCase';
import SeasonArchive from '../components/profile/SeasonArchive';
import UniformBuilder from '../components/profile/UniformBuilder';
import CommentsSection from '../components/profile/CommentsSection';

const timeSince = (date) => {
    if (!date) return 'never';
    const dateObj = date.toDate ? date.toDate() : new Date(date);
    const seconds = Math.floor((new Date() - dateObj) / 1000);
    let interval = seconds / 31536000; if (interval > 1) return Math.floor(interval) + " years ago";
    interval = seconds / 2592000; if (interval > 1) return Math.floor(interval) + " months ago";
    interval = seconds / 86400; if (interval > 1) return Math.floor(interval) + " days ago";
    interval = seconds / 3600; if (interval > 1) return Math.floor(interval) + " hours ago";
    interval = seconds / 60; if (interval > 1) return Math.floor(interval) + " minutes ago";
    return "a moment ago";
};


const MySchedule = ({ profile }) => {
    const userCorps = getAllUserCorps(profile);
    return (
        <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border-theme border-accent dark:border-accent-dark shadow-theme">
            <h3 className="text-2xl font-bold text-primary dark:text-primary-dark mb-4">Season Schedule</h3>
            {Object.keys(userCorps).length === 0 || !profile.activeSeasonId ? (
                <p className="text-text-secondary dark:text-text-secondary-dark">No shows have been selected for the current season.</p>
            ) : (
                <div className="space-y-6">
                    {CORPS_CLASS_ORDER.map(corpsClassKey => {
                        const corps = userCorps[corpsClassKey];
                        if (!corps) return null;

                        return (
                            <div key={corpsClassKey}>
                                <div className="flex items-center gap-2 mb-3">
                                    <div className={`w-3 h-3 rounded-full ${CORPS_CLASSES[corpsClassKey]?.color || 'bg-gray-400'}`}></div>
                                    <h4 className="font-semibold text-text-primary dark:text-text-primary-dark">
                                        {corps.corpsName} ({CORPS_CLASSES[corpsClassKey]?.name || corpsClassKey})
                                    </h4>
                                </div>
                                {!corps.selectedShows || Object.keys(corps.selectedShows).length === 0 ? (
                                    <p className="text-sm text-text-secondary dark:text-text-secondary-dark italic pl-5">No shows selected</p>
                                ) : (
                                    <div className="space-y-3 pl-5">
                                        {Object.keys(corps.selectedShows).sort((a, b) => parseInt(a.replace('week', '')) - parseInt(b.replace('week', ''))).map(weekKey => {
                                            const weekNum = weekKey.replace('week', '');
                                            const shows = corps.selectedShows[weekKey];
                                            return (
                                                <div key={weekKey}>
                                                    <h5 className="font-medium text-text-primary dark:text-text-primary-dark text-sm">Week {weekNum}</h5>
                                                    {shows && shows.length > 0 ? (
                                                        <ul className="list-disc list-inside pl-2 mt-1 text-xs text-text-secondary dark:text-text-secondary-dark space-y-1">
                                                            {shows.map((show, index) => (
                                                                <li key={index}>{show.eventName.replace(/DCI/g, 'marching.art')} - <em className="text-text-secondary/80 dark:text-text-secondary-dark/80">{show.location}</em></li>
                                                            ))}
                                                        </ul>
                                                    ) : (
                                                        <p className="pl-2 mt-1 text-xs text-text-secondary dark:text-text-secondary-dark italic">No shows selected</p>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    );
};

const CorpsSummary = ({ profile }) => {
    const userCorps = getAllUserCorps(profile);
    if (Object.keys(userCorps).length === 0) return null;
    return (
        <div className="bg-surface dark:bg-surface-dark p-4 rounded-theme border-theme border-accent dark:border-accent-dark mt-4">
            <h4 className="font-semibold text-text-primary dark:text-text-primary-dark mb-3">Current Season Corps</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {CORPS_CLASS_ORDER.map(corpsClassKey => {
                    const corps = userCorps[corpsClassKey];
                    if (!corps) return null; 

                    return (
                        <div key={corpsClassKey} className="text-center p-3 bg-background dark:bg-background-dark rounded-theme">
                            <div className={`w-4 h-4 rounded-full ${CORPS_CLASSES[corpsClassKey]?.color || 'bg-gray-400'} mx-auto mb-2`}></div>
                            <div className="font-medium text-sm">{CORPS_CLASSES[corpsClassKey]?.name || corpsClassKey}</div>
                            <div className="font-semibold text-text-primary dark:text-text-primary-dark">{corps.corpsName}</div>
                            <div className="text-sm text-text-secondary dark:text-text-secondary-dark">{(corps.totalSeasonScore || 0).toFixed(3)} pts</div>
                        </div>
                    )
                })}
            </div>
        </div>
    );
};


const ProfilePage = ({ loggedInProfile, loggedInUserId, viewingUserId }) => {
    const [profile, setProfile] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isEditingBio, setIsEditingBio] = useState(false);
    const [bioText, setBioText] = useState('');
    const [isBuildingUniform, setIsBuildingUniform] = useState(false);
    const [timeSinceActive, setTimeSinceActive] = useState('');
    const [seasonSettings, setSeasonSettings] = useState(null);
    const [fantasyRecaps, setFantasyRecaps] = useState(null);

    const isOwner = loggedInUserId && viewingUserId === loggedInUserId;

    useEffect(() => {
        const fetchProfileData = async () => {
            setIsLoading(true);
            const targetUserId = viewingUserId || loggedInUserId;

            if (!targetUserId) {
                // ...
                return;
            }
            
            if (isOwner) {
                // ...
            } else {
                try {
                    const userDocRef = doc(db, 'artifacts', dataNamespace, 'users', targetUserId, 'profile', 'data');
                    const docSnap = await getDoc(userDocRef);
                    if (docSnap.exists()) {
                        setProfile({ userId: targetUserId, ...docSnap.data() });
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
        };

        fetchProfileData();
    }, [viewingUserId, loggedInUserId, loggedInProfile, isOwner]);

    useEffect(() => {
        if (isOwner) {
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
        }
    }, [isOwner]);
    
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

    const handleSaveBio = async () => {
        if (!isOwner || !loggedInUserId) return;
        const userDocRef = doc(db, 'artifacts', dataNamespace, 'users', loggedInUserId, 'profile', 'data');
        try {
            await setDoc(userDocRef, { bio: bioText }, { merge: true });
            setProfile(p => ({ ...p, bio: bioText }));
            setIsEditingBio(false);
        } catch (error) { console.error("Error updating bio:", error); }
    };
    
    const handleSaveUniform = async (newUniform) => {
        if (!isOwner || !loggedInUserId) return;
        const userDocRef = doc(db, 'artifacts', dataNamespace, 'users', loggedInUserId, 'profile', 'data');
        try {
            await setDoc(userDocRef, { uniform: newUniform }, { merge: true });
            setProfile(p => ({ ...p, uniform: newUniform }));
            setIsBuildingUniform(false);
        } catch (error) { console.error("Error saving uniform:", error); }
    };

    if (isLoading) {
        return <div className="p-8 text-center text-text-secondary dark:text-text-secondary-dark">Loading profile...</div>;
    }
    if (!profile) {
        return <div className="p-8 text-center text-text-secondary dark:text-text-secondary-dark">Profile not found.</div>;
    }

    const defaultUniform = {
      skinTone: '#d8aa7c', headwear: { style: 'shako', colors: { hat: '#1a1a1a', trim: '#ffffff' } }, plume: { style: 'fountain', colors: { plume: '#ff0000' } }, jacket: { style: 'sash', colors: { base: '#000080', accent: '#ffffff', trim: '#ffd700' } }, pants: { style: 'stripe', colors: { base: '#ffffff', stripe: '#000080' } }, shoes: { style: 'white' },
    };
    const userUniform = profile?.uniform ? { ...defaultUniform, ...profile.uniform } : defaultUniform;
    const profileUserId = viewingUserId || loggedInUserId;

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
            <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
                    <div className="relative flex-shrink-0">
                        <UniformDisplay uniform={userUniform} />
                        {isOwner && (
                            <button onClick={() => setIsBuildingUniform(true)} className="absolute top-2 right-2 bg-primary/80 hover:bg-primary text-on-primary p-2 rounded-full shadow-lg backdrop-blur-sm transition-all" aria-label="Edit Uniform">
                               <Icon path="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                    <div className="flex-grow text-center md:text-left">
                        <h1 className="text-4xl md:text-5xl font-bold text-text-primary dark:text-text-primary-dark">{profile.username}</h1>
                        <p className="text-text-secondary dark:text-text-secondary-dark mt-1">Member since {profile.createdAt?.toDate().toLocaleDateString()}</p>
                        <p className="text-text-secondary dark:text-text-secondary-dark">Last active: {timeSinceActive}</p>
                        <div className="mt-4 bg-surface dark:bg-surface-dark p-4 rounded-theme border-l-4 border-primary dark:border-primary-dark">
                            {isEditingBio ? (
                                <div className="space-y-2">
                                    <textarea value={bioText} onChange={(e) => setBioText(e.target.value)} className="w-full bg-background dark:bg-background-dark border-theme border-accent dark:border-accent-dark rounded-theme p-2" rows="4"></textarea>
                                    <div className="flex justify-end space-x-2">
                                        <button onClick={() => setIsEditingBio(false)} className="border-theme border-accent dark:border-accent-dark hover:bg-accent dark:hover:bg-accent-dark/20 font-bold py-1 px-3 rounded-theme text-sm">Cancel</button>
                                        <button onClick={handleSaveBio} className="bg-primary hover:opacity-90 text-on-primary font-bold py-1 px-3 rounded-theme text-sm">Save</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex justify-between items-start">
                                    <p className="text-text-secondary dark:text-text-secondary-dark italic">{profile.bio || 'No bio has been set.'}</p>
                                    {isOwner && (
                                        <button onClick={() => setIsEditingBio(true)} className="ml-4 text-sm text-primary dark:text-primary-dark hover:underline flex-shrink-0">Edit</button>
                                    )}
                                </div>
                            )}
                        </div>
                        <CorpsSummary profile={profile} />
                    </div>
                </div>
                <div className="grid lg:grid-cols-3 gap-8 items-start">                
                    <div className="lg:col-span-1">
                        <MySchedule profile={profile} />
                    </div>
                    <div className="lg:col-span-2 space-y-8">
                        <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border-theme border-accent dark:border-accent-dark shadow-theme">
                            <AchievementsCase achievements={profile.achievements} />
                        </div>
                        <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border-theme border-accent dark:border-accent-dark shadow-theme">
                            <TrophyCase trophies={profile.trophies} />
                        </div>
                        <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border-theme border-accent dark:border-accent-dark shadow-theme">
                             <SeasonArchive 
                                seasons={profile.seasons} 
                                userId={profileUserId}
                                seasonSettings={seasonSettings}
                                fantasyRecaps={fantasyRecaps}
                            />               
                        </div>
                        <CommentsSection
                            profileOwnerId={profileUserId}
                            loggedInProfile={loggedInProfile}
                        />
                    </div> 
                </div>
            </div>
        </>
    );
};
export default ProfilePage;
