import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db, dataNamespace } from '../firebase';
import { getAllUserCorps, CORPS_CLASSES, CORPS_CLASS_ORDER } from '../utils/profileCompatibility';
import UniformDisplay from '../components/profile/UniformDisplay';
import TrophyCase from '../components/profile/TrophyCase';
import AchievementsCase from '../components/profile/AchievementsCase';
import SeasonArchive from '../components/profile/SeasonArchive';
import UniformBuilder from '../components/profile/UniformBuilder';
import CommentsSection from '../components/profile/CommentsSection';
import GameTabPanel from '../components/ui/GameTabPanel';

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
                <p className="text-text-secondary dark:text-text-secondary-dark">No shows selected.</p>
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
                                        {corps.corpsName}
                                    </h4>
                                </div>
                                {!corps.selectedShows || Object.keys(corps.selectedShows).length === 0 ? (
                                    <p className="text-sm text-text-secondary dark:text-text-secondary-dark italic">No shows selected.</p>
                                ) : (
                                    <ol className="space-y-2">
                                        {Object.entries(corps.selectedShows).sort(([a], [b]) => parseInt(a) - parseInt(b)).map(([day, show]) => (
                                            <li key={day} className="flex items-center text-sm">
                                                <span className="font-mono text-text-secondary dark:text-text-secondary-dark w-16">Day {day}:</span>
                                                <span className="text-text-primary dark:text-text-primary-dark ml-2">{show.showName}</span>
                                            </li>
                                        ))}
                                    </ol>
                                )}
                            </div>
                        );
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
                    );
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
    const profileUserId = viewingUserId || loggedInUserId;

    useEffect(() => {
        const fetchProfileData = async () => {
            setIsLoading(true);
            const targetUserId = viewingUserId || loggedInUserId;

            if (!targetUserId) {
                setIsLoading(false);
                setProfile(null);
                return;
            }
            
            if (isOwner && loggedInProfile) {
                setProfile({ userId: targetUserId, ...loggedInProfile });
                setIsLoading(false);
            } else {
                const profileRef = doc(db, 'artifacts', dataNamespace, 'users', targetUserId, 'profile', 'data');
                const profileSnap = await getDoc(profileRef);
                if (profileSnap.exists()) {
                    setProfile({ userId: targetUserId, ...profileSnap.data() });
                } else {
                    setProfile(null);
                }
                setIsLoading(false);
            }
        };

        fetchProfileData();

        const seasonRef = doc(db, 'game-settings', 'season');
        const unsubSeason = onSnapshot(seasonRef, (snap) => {
            if (snap.exists()) setSeasonSettings({ id: snap.id, ...snap.data() });
        });

        return () => unsubSeason();
    }, [viewingUserId, loggedInUserId, loggedInProfile, isOwner]);

    useEffect(() => {
        if (profile?.lastActive) {
            setTimeSinceActive(timeSince(profile.lastActive));
        }
    }, [profile]);

    const handleBioSave = async () => {
        if (!loggedInUserId) return;
        const profileRef = doc(db, 'artifacts', dataNamespace, 'users', loggedInUserId, 'profile', 'data');
        await setDoc(profileRef, { bio: bioText }, { merge: true });
        setIsEditingBio(false);
    };

    const handleBioEdit = () => {
        setBioText(profile.bio || '');
        setIsEditingBio(true);
    };

    const handleUniformUpdate = async (newUniform) => {
        if (!loggedInUserId) return;
        const profileRef = doc(db, 'artifacts', dataNamespace, 'users', loggedInUserId, 'profile', 'data');
        await setDoc(profileRef, { uniform: newUniform }, { merge: true });
        setIsBuildingUniform(false);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <p className="text-lg font-semibold text-primary dark:text-primary-dark">Loading Profile...</p>
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="flex items-center justify-center h-full">
                <p className="text-lg text-text-secondary dark:text-text-secondary-dark">Profile not found.</p>
            </div>
        );
    }

    const tabs = [
        {
            label: 'Overview',
            icon: '👤',
            content: (
                <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
                    <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border-theme border-accent dark:border-accent-dark shadow-theme">
                        <div className="flex flex-col lg:flex-row gap-6">
                            <div className="flex-shrink-0">
                                <div className="w-48 h-48 mx-auto lg:mx-0">
                                    <UniformDisplay uniform={profile.uniform} />
                                </div>
                                {isOwner && (
                                    <button 
                                        onClick={() => setIsBuildingUniform(true)} 
                                        className="mt-4 w-full bg-primary hover:opacity-90 text-on-primary font-bold py-2 px-4 rounded-theme"
                                    >
                                        Edit Uniform
                                    </button>
                                )}
                            </div>
                            
                            <div className="flex-1 space-y-4">
                                <div>
                                    <h1 className="text-3xl font-bold text-text-primary dark:text-text-primary-dark">{profile.username}</h1>
                                    <p className="text-sm text-text-secondary dark:text-text-secondary-dark mt-1">
                                        Last active {timeSinceActive}
                                    </p>
                                </div>
                                
                                {isEditingBio ? (
                                    <div className="space-y-2">
                                        <textarea
                                            value={bioText}
                                            onChange={(e) => setBioText(e.target.value)}
                                            className="w-full p-3 bg-background dark:bg-background-dark border-theme border-accent dark:border-accent-dark rounded-theme text-text-primary dark:text-text-primary-dark"
                                            rows={4}
                                            maxLength={200}
                                        />
                                        <div className="flex gap-2">
                                            <button onClick={handleBioSave} className="bg-primary hover:opacity-90 text-on-primary font-bold py-2 px-4 rounded-theme">Save</button>
                                            <button onClick={() => setIsEditingBio(false)} className="bg-surface dark:bg-surface-dark hover:bg-accent dark:hover:bg-accent-dark/20 text-text-primary dark:text-text-primary-dark font-bold py-2 px-4 rounded-theme border-theme border-accent dark:border-accent-dark">Cancel</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-start">
                                        <p className="text-text-secondary dark:text-text-secondary-dark italic flex-1">"{profile.bio || 'No bio yet.'}"</p>
                                        {isOwner && (
                                            <button onClick={handleBioEdit} className="ml-4 text-sm text-primary dark:text-primary-dark hover:underline flex-shrink-0">Edit</button>
                                        )}
                                    </div>
                                )}
                                <CorpsSummary profile={profile} />
                            </div>
                        </div>
                    </div>
                    
                    <div className="grid lg:grid-cols-3 gap-6">
                        <MySchedule profile={profile} />
                    </div>
                </div>
            )
        },
        {
            label: 'Awards',
            icon: '🏅',
            content: (
                <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
                    <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border-theme border-accent dark:border-accent-dark shadow-theme">
                        <AchievementsCase achievements={profile.achievements} />
                    </div>
                    <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border-theme border-accent dark:border-accent-dark shadow-theme">
                        <TrophyCase trophies={profile.trophies} />
                    </div>
                </div>
            )
        },
        {
            label: 'Archive',
            icon: '📊',
            content: (
                <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
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
            )
        }
    ];

    return (
        <>
            {isBuildingUniform && (
                <UniformBuilder
                    initialUniform={profile.uniform}
                    onSave={handleUniformUpdate}
                    onClose={() => setIsBuildingUniform(false)}
                />
            )}
            <div className="page-content">
                <GameTabPanel tabs={tabs} defaultTab={0} />
            </div>
        </>
    );
};

export default ProfilePage;
