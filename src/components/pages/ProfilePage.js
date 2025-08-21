import React, { useState, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db, appId } from '../../firebase';
import UniformDisplay from '../profile/UniformDisplay';
import TrophyCase from '../profile/TrophyCase';
import SeasonArchive from '../profile/SeasonArchive';

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