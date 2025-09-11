import React, { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { doc, getDoc } from 'firebase/firestore';
import { functions, db } from '../../firebase';
import CreateLeagueModal from './CreateLeagueModal'; // We will create this next

const LeagueManager = ({ profile }) => {
    const [userLeagues, setUserLeagues] = useState([]);
    const [inviteCode, setInviteCode] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [newLeagueInfo, setNewLeagueInfo] = useState(null);

    // This effect fetches the full league details (like the name)
    // using the leagueIds stored on the user's profile.
    useEffect(() => {
        const fetchLeagueDetails = async () => {
            if (profile?.leagueIds?.length > 0) {
                const leaguePromises = profile.leagueIds.map(id => getDoc(doc(db, 'leagues', id)));
                const leagueDocs = await Promise.all(leaguePromises);
                const leagues = leagueDocs
                    .filter(doc => doc.exists())
                    .map(doc => ({ id: doc.id, ...doc.data() }));
                setUserLeagues(leagues);
            } else {
                setUserLeagues([]);
            }
        };

        fetchLeagueDetails();
    }, [profile]);

    const handleJoinLeague = async (e) => {
        e.preventDefault();
        if (!inviteCode.trim()) return;
        setIsLoading(true);
        setMessage({ type: '', text: '' });
        try {
            const joinLeague = httpsCallable(functions, 'joinLeague');
            const result = await joinLeague({ inviteCode: inviteCode.trim() });
            setMessage({ type: 'success', text: result.data.message });
            setInviteCode('');
        } catch (error) {
            setMessage({ type: 'error', text: error.message });
        }
        setIsLoading(false);
    };

    const handleCreateLeague = async (leagueName) => {
        setIsLoading(true);
        setMessage({ type: '', text: '' });
        try {
            const createLeague = httpsCallable(functions, 'createLeague');
            const result = await createLeague({ leagueName });
            setNewLeagueInfo({ name: leagueName, code: result.data.inviteCode });
            setMessage({ type: 'success', text: result.data.message });
        } catch (error) {
            setMessage({ type: 'error', text: error.message });
        }
        setIsModalOpen(false);
        setIsLoading(false);
    };

    return (
        <div className="lg:col-span-1 bg-brand-surface dark:bg-brand-surface-dark p-6 rounded-lg border-2 border-brand-secondary shadow-lg">
            <CreateLeagueModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onCreate={handleCreateLeague}
                isLoading={isLoading}
            />
            <h2 className="text-2xl font-bold text-brand-primary dark:text-brand-secondary-dark mb-4">My Leagues</h2>
            
            {userLeagues.length > 0 ? (
                <ul className="space-y-2 mb-6">
                    {userLeagues.map(league => (
                        <li key={league.id} className="p-3 bg-brand-background dark:bg-brand-background-dark rounded-md font-semibold text-brand-text-primary dark:text-brand-text-primary-dark">
                            {league.name}
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-brand-text-secondary dark:text-brand-text-secondary-dark mb-6 italic">You haven't joined any leagues yet.</p>
            )}

            <div className="space-y-4">
                <form onSubmit={handleJoinLeague} className="space-y-2">
                    <h3 className="font-semibold text-lg text-brand-text-primary dark:text-brand-text-primary-dark">Join a League</h3>
                    <input
                        type="text"
                        value={inviteCode}
                        onChange={(e) => setInviteCode(e.target.value)}
                        placeholder="Enter Invite Code"
                        className="w-full bg-white dark:bg-brand-background-dark border border-brand-accent rounded p-2 text-brand-text-primary dark:text-brand-text-primary-dark"
                    />
                    <button type="submit" disabled={isLoading} className="w-full bg-brand-primary hover:bg-blue-800 text-white font-bold py-2 px-4 rounded disabled:bg-gray-400">
                        {isLoading ? 'Joining...' : 'Join'}
                    </button>
                </form>

                <div>
                    <h3 className="font-semibold text-lg text-brand-text-primary dark:text-brand-text-primary-dark mb-2">Create a League</h3>
                    <button onClick={() => setIsModalOpen(true)} className="w-full bg-brand-secondary hover:bg-amber-500 text-brand-text-primary font-bold py-2 px-4 rounded">
                        Create New League
                    </button>
                </div>
            </div>

            {message.text && (
                <p className={`mt-4 text-sm font-semibold text-center ${message.type === 'error' ? 'text-red-500' : 'text-green-500'}`}>
                    {message.text}
                </p>
            )}

            {newLeagueInfo && (
                <div className="mt-4 p-3 bg-green-100 dark:bg-green-900/50 border border-green-400 rounded-md text-center">
                    <p className="font-semibold text-green-800 dark:text-green-200">Your new league "{newLeagueInfo.name}" is ready!</p>
                    <p className="text-sm text-green-700 dark:text-green-300 mt-1">Share this invite code with friends:</p>
                    <p className="text-xl font-bold text-green-800 dark:text-green-200 tracking-widest bg-white dark:bg-brand-background-dark mt-2 p-1 rounded select-all">{newLeagueInfo.code}</p>
                </div>
            )}
        </div>
    );
};

export default LeagueManager;