import React, { useState, useEffect } from 'react';
import { doc, updateDoc, setDoc } from 'firebase/firestore';
import { auth, db, appId } from '../../firebase';
import Icon from '../ui/Icon';
import UniformDisplay from '../profile/UniformDisplay';
import TrophyCase from '../profile/TrophyCase';
import SeasonArchive from '../profile/SeasonArchive';
import UniformBuilder from '../profile/UniformBuilder'; // Import the new builder

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
                                        <li key={index}>{show.eventName} - <em className="text-brand-accent dark:text-brand-accent-dark">{show.location}</em></li>
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
    const [isBuildingUniform, setIsBuildingUniform] = useState(false); // State for builder modal

    // Default uniform structure to prevent errors on first load
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
        setBioText(profile?.bio || '');
    }, [profile]);

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
            // Using setDoc with merge: true will create or update the document
            await setDoc(userDocRef, { uniform: newUniform }, { merge: true });
            setIsBuildingUniform(false);
        } catch (error) {
            console.error("Error saving uniform:", error);
        }
    };


    if (!profile) {
        return <div className="p-8 text-center text-gray-600 dark:text-yellow-300">Loading profile...</div>;
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
                        <UniformDisplay uniform={profile.uniform} />
                        {isOwner && (
                            <button 
                                onClick={() => setIsBuildingUniform(true)} 
                                className="absolute top-2 right-2 bg-brand-primary/80 hover:bg-brand-primary text-white p-2 rounded-full shadow-lg backdrop-blur-sm transition-all"
                                aria-label="Edit Uniform"
                            >
                               <Icon path="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                    <div className="flex-grow text-center md:text-left">
                         <h1 className="text-4xl md:text-5xl font-bold text-brand-text-primary dark:text-brand-text-primary-dark">{profile.username}</h1>
                        {profile.corpsName && (
                            <h2 className="text-2xl font-semibold text-brand-primary dark:text-brand-secondary-dark mt-1">{profile.corpsName}</h2>
                        )}
                        <p className="text-brand-text-secondary dark:text-brand-text-secondary-dark mt-1">
                            Member since {profile.createdAt?.toDate().toLocaleDateString()}
                        </p>
                         <p className="text-brand-text-secondary dark:text-brand-text-secondary-dark">
                            Last active: {/* timeSince logic */}
                        </p>
                        <div className="mt-4 bg-brand-surface dark:bg-brand-surface-dark p-4 rounded-md border-l-4 border-brand-secondary">
                            {isEditingBio ? (
                                <div className="space-y-2">
                                    <textarea 
                                        value={bioText}
                                        onChange={(e) => setBioText(e.target.value)}
                                        className="w-full bg-white dark:bg-brand-background-dark border border-brand-accent dark:border-brand-accent-dark rounded p-2 text-brand-text-primary dark:text-brand-text-primary-dark"
                                        rows="4"
                                    ></textarea>
                                    <div className="flex justify-end space-x-2">
                                        <button onClick={() => setIsEditingBio(false)} className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-1 px-3 rounded text-sm">Cancel</button>
                                        <button onClick={handleSaveBio} className="bg-brand-primary hover:bg-blue-800 text-white font-bold py-1 px-3 rounded text-sm">Save</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex justify-between items-start">
                                    <p className="text-brand-text-secondary dark:text-brand-text-secondary-dark">{profile.bio || 'No bio has been set.'}</p>
                                    {isOwner && (
                                        <button onClick={() => setIsEditingBio(true)} className="ml-4 text-sm text-brand-primary dark:text-brand-secondary-dark hover:underline flex-shrink-0">Edit</button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="grid lg:grid-cols-3 gap-8">                
                    <MySchedule profile={profile} />
                    <TrophyCase trophies={profile.trophies} />
                    <SeasonArchive seasons={profile.seasons} />                
                </div>
            </div>
        </>
    );
};
export default ProfilePage;