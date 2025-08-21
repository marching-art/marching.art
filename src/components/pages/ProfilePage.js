import React, { useState, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db, appId } from '../../firebase';
import Icon from '../ui/Icon'; // Assuming Icon.js is at src/components/ui/Icon.js

// --- Child Components (made more robust) ---

const UniformDisplay = ({ uniform }) => {
    // This component is safe, but included for completeness.
    if (!uniform) {
        return <div className="w-48 h-64 bg-gray-200 dark:bg-gray-700 rounded-md flex-shrink-0"></div>;
    }
    return (
        <div className="w-48 h-64 bg-gray-200 dark:bg-gray-700 rounded-md flex flex-col items-center justify-center p-4 relative overflow-hidden flex-shrink-0">
            <div style={{ backgroundColor: uniform.hatColor }} className="w-16 h-10 rounded-t-md absolute top-8"></div>
            <div style={{ backgroundColor: uniform.plumeColor }} className="w-4 h-12 absolute top-0 left-1/2 -translate-x-1/2 rounded-t-full"></div>
            <div style={{ backgroundColor: uniform.jacketColor1 }} className="w-full h-32 absolute top-16">
                <div style={{ backgroundColor: uniform.jacketColor2 }} className="w-1/2 h-full absolute top-0 left-1/2 -translate-x-1/2"></div>
            </div>
        </div>
    );
};

const TrophyCase = ({ trophies }) => {
    // FIX: Ensure trophies and its properties are always arrays, even if the prop is null or undefined.
    const safeTrophies = trophies || { championships: [], regionals: [] };
    const championships = safeTrophies.championships || [];
    const regionals = safeTrophies.regionals || [];

    const TrophyIcon = ({ type }) => {
        const colors = {
            gold: "text-yellow-500",
            silver: "text-gray-400",
            bronze: "text-orange-500",
        };
        return <Icon path="M16.5 18.75h-9a9.75 9.75 0 001.05-3.055 9.75 9.75 0 00-1.05-3.055h9a9.75 9.75 0 00-1.05 3.055 9.75 9.75 0 001.05 3.055zM18.75 9.75h.008v.008h-.008V9.75z" className={`w-8 h-8 ${colors[type]}`} />;
    };

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-md border-2 border-yellow-500 shadow-lg">
            <h3 className="text-2xl font-bold text-yellow-700 dark:text-yellow-400 mb-4">Trophy Case</h3>
            <div className="space-y-4">
                <div>
                    <h4 className="font-semibold text-gray-800 dark:text-gray-200">Championships</h4>
                    <div className="flex space-x-2 mt-2">
                        {championships.map((t, i) => <TrophyIcon key={`champ-${i}`} type={t} />)}
                    </div>
                </div>
                <div>
                    <h4 className="font-semibold text-gray-800 dark:text-gray-200">Regionals</h4>
                    <div className="flex space-x-2 mt-2">
                        {regionals.map((t, i) => <TrophyIcon key={`reg-${i}`} type={t} />)}
                    </div>
                </div>
            </div>
        </div>
    );
};

const SeasonArchive = ({ seasons }) => {
    // FIX: Ensure seasons is always an array, even if the prop is null or undefined.
    const safeSeasons = seasons || [];
    const [seasonType, setSeasonType] = useState('Live');
    
    const filteredSeasons = safeSeasons.filter(s => s && s.type === seasonType);
    const [activeSeason, setActiveSeason] = useState(null);

    useEffect(() => {
        const newFiltered = safeSeasons.filter(s => s && s.type === seasonType);
        setActiveSeason(newFiltered.length > 0 ? newFiltered[0] : null);
    }, [seasonType, seasons]); // Rerun when seasons prop changes

    return (
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-md border-2 border-yellow-500 shadow-lg">
            <h3 className="text-2xl font-bold text-yellow-700 dark:text-yellow-400 mb-4">Season Archive</h3>
            <div className="flex border-b-2 border-gray-200 dark:border-gray-700 mb-2">
                <button onClick={() => setSeasonType('Live')} className={`py-2 px-4 text-lg font-bold transition-colors ${seasonType === 'Live' ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'}`}>Live Seasons</button>
                <button onClick={() => setSeasonType('Off')} className={`py-2 px-4 text-lg font-bold transition-colors ${seasonType === 'Off' ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'}`}>Off-Seasons</button>
            </div>
            
            <div className="flex border-b-2 border-gray-200 dark:border-gray-700 mb-4 overflow-x-auto">
                {filteredSeasons.map(season => (
                    <button 
                        key={season.name} 
                        onClick={() => setActiveSeason(season)}
                        className={`py-2 px-4 font-semibold transition-colors whitespace-nowrap ${activeSeason?.name === season.name ? 'border-b-2 border-yellow-500 text-yellow-600 dark:text-yellow-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'}`}
                    >
                        {season.name}
                    </button>
                ))}
            </div>

            {activeSeason ? (
                <div>
                    <h4 className="text-xl font-bold text-gray-800 dark:text-gray-200">{activeSeason.showTitle}</h4>
                    <p className="italic text-gray-600 dark:text-gray-400 mb-4">{activeSeason.repertoire}</p>
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-gray-200 dark:border-gray-700">
                                <th className="p-2">Event</th>
                                <th className="p-2">Rank</th>
                                <th className="p-2">Score</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(activeSeason.events || []).map((event, i) => (
                                <tr key={i} className="border-b border-gray-100 dark:border-gray-700">
                                    <td className="p-2">{event.eventName}</td>
                                    <td className="p-2">{event.rank}</td>
                                    <td className="p-2">{event.score?.toFixed(3)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : <p className="p-2 text-gray-500">No seasons of this type played.</p>}
        </div>
    );
};


// --- Main ProfilePage Component ---

const ProfilePage = ({ profile, userId }) => {
    const isOwner = auth.currentUser?.uid === userId;

    const [isEditingBio, setIsEditingBio] = useState(false);
    const [bioText, setBioText] = useState(profile?.bio || '');

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

    if (!profile) {
        return <div className="p-8 text-center text-gray-600 dark:text-yellow-300">Loading profile...</div>;
    }

    const timeSince = (date) => {
        if (!date?.toDate) return "a while ago";
        const seconds = Math.floor((new Date() - date.toDate()) / 1000);
        let interval = seconds / 31536000;
        if (interval > 1) return Math.floor(interval) + " years ago";
        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + " months ago";
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + " days ago";
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + " hours ago";
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + " minutes ago";
        return "just now";
    };

    return (
        <div className="p-4 md:p-8 space-y-8">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
                <UniformDisplay uniform={profile.uniform} />
                <div className="flex-grow text-center md:text-left">
                    <h1 className="text-4xl md:text-5xl font-bold text-gray-800 dark:text-white">{profile.username}</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                        Member since {profile.createdAt?.toDate().toLocaleDateString()}
                    </p>
                    <p className="text-gray-500 dark:text-gray-400">
                        Last active: {timeSince(profile.lastActive)}
                    </p>
                    <div className="mt-4 bg-gray-50 dark:bg-gray-800 p-4 rounded-md border-l-4 border-yellow-500">
                        {isEditingBio ? (
                            <div className="space-y-2">
                                <textarea 
                                    value={bioText}
                                    onChange={(e) => setBioText(e.target.value)}
                                    className="w-full bg-gray-100 dark:bg-gray-900 border border-gray-400 dark:border-yellow-500 rounded p-2 text-gray-800 dark:text-yellow-300"
                                    rows="4"
                                ></textarea>
                                <div className="flex justify-end space-x-2">
                                    <button onClick={() => setIsEditingBio(false)} className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-1 px-3 rounded text-sm">Cancel</button>
                                    <button onClick={handleSaveBio} className="bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-1 px-3 rounded text-sm">Save</button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex justify-between items-start">
                                <p className="text-gray-700 dark:text-gray-300">{profile.bio}</p>
                                {isOwner && (
                                    <button onClick={() => setIsEditingBio(true)} className="ml-4 text-sm text-yellow-600 dark:text-yellow-400 hover:underline flex-shrink-0">Edit</button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
                <TrophyCase trophies={profile.trophies} />
                <SeasonArchive seasons={profile.seasons} />
            </div>
        </div>
    );
};
export default ProfilePage;
