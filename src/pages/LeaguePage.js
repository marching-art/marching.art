import React, { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { doc, getDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { functions, db } from '../firebase';
import CreateLeagueModal from '../components/dashboard/CreateLeagueModal';

const LeaguePage = ({ profile, setPage, onViewLeague }) => {
    const [userLeagues, setUserLeagues] = useState([]);
    const [inviteCode, setInviteCode] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [newLeagueInfo, setNewLeagueInfo] = useState(null);

    useEffect(() => {
        if (!profile?.leagueIds || profile.leagueIds.length === 0) {
            setUserLeagues([]);
            return;
        }

        const q = query(collection(db, 'leagues'), where('__name__', 'in', profile.leagueIds));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const leagues = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setUserLeagues(leagues);
        });

        return () => unsubscribe();
    }, [profile]);

    const handleJoinLeague = async (e) => {
        e.preventDefault();
        if (!inviteCode.trim()) return;
        setIsLoading(true);
        setMessage({ type: '', text: '' });
        setNewLeagueInfo(null);
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
        <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-8">
            <CreateLeagueModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onCreate={handleCreateLeague}
                isLoading={isLoading}
            />
            <h1 className="text-4xl font-bold text-text-primary dark:text-text-primary-dark">
                My Leagues
            </h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                {/* Left Column: My Leagues List */}
                <div className="space-y-4">
                    <h2 className="text-2xl font-bold text-primary dark:text-primary-dark">Your Leagues</h2>
                    {userLeagues.length > 0 ? (
                        <ul className="space-y-3">
                            {userLeagues.map(league => (
                                <li key={league.id}>
                                    <button 
                                        onClick={() => onViewLeague(league.id)}
                                        className="w-full text-left p-4 bg-surface dark:bg-surface-dark rounded-theme border-theme border-accent dark:border-accent-dark shadow-theme hover:border-primary dark:hover:border-primary-dark transition-all"
                                    >
                                        <p className="font-semibold text-text-primary dark:text-text-primary-dark">{league.name}</p>
                                        <p className="text-sm text-text-secondary dark:text-text-secondary-dark">{league.members?.length || 0} Members</p>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-text-secondary dark:text-text-secondary-dark italic">You haven't joined any leagues yet.</p>
                    )}
                </div>

                {/* Right Column: Create/Join */}
                <div className="space-y-6 bg-surface dark:bg-surface-dark p-6 rounded-theme border-theme border-accent dark:border-accent-dark">
                    <form onSubmit={handleJoinLeague} className="space-y-2">
                        <h3 className="font-semibold text-lg text-text-primary dark:text-text-primary-dark">Join a League</h3>
                        <input
                            type="text"
                            value={inviteCode}
                            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                            placeholder="Enter Invite Code"
                            className="w-full bg-background dark:bg-background-dark border-theme border-accent dark:border-accent-dark rounded-theme p-2 text-text-primary dark:text-text-primary-dark font-mono uppercase focus:ring-2 focus:ring-primary focus:border-primary"
                        />
                        <button type="submit" disabled={isLoading} className="w-full bg-primary hover:opacity-90 text-on-primary font-bold py-2 px-4 rounded-theme disabled:opacity-50">
                            {isLoading ? 'Joining...' : 'Join'}
                        </button>
                    </form>

                    <div>
                        <button onClick={() => { setIsModalOpen(true); setNewLeagueInfo(null); }} className="w-full bg-secondary hover:opacity-90 text-on-secondary font-bold py-2 px-4 rounded-theme">
                            Create New League
                        </button>
                    </div>

                    {message.text && !newLeagueInfo && (
                        <p className={`mt-4 text-sm font-semibold text-center ${message.type === 'error' ? 'text-red-500' : 'text-green-500'}`}>
                            {message.text}
                        </p>
                    )}

                    {newLeagueInfo && (
                        <div className="mt-4 p-3 bg-green-500/10 dark:bg-green-500/20 border border-green-500 rounded-theme text-center">
                            <p className="font-semibold text-green-800 dark:text-green-200">Your new league "{newLeagueInfo.name}" is ready!</p>
                            <p className="text-sm text-green-700 dark:text-green-300 mt-1">Share this invite code with friends:</p>
                            <p className="text-xl font-bold text-green-800 dark:text-green-200 tracking-widest bg-background dark:bg-surface-dark mt-2 p-1 rounded-theme select-all">{newLeagueInfo.code}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LeaguePage;
