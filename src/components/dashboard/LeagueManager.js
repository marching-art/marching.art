import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { joinLeague, createLeague, leaveLeague } from '../../utils/api';
import CreateLeagueModal from './CreateLeagueModal';

const LeagueManager = ({ profile }) => {
    const [userLeagues, setUserLeagues] = useState([]);
    const [inviteCode, setInviteCode] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [newLeagueInfo, setNewLeagueInfo] = useState(null);
    const [copiedCode, setCopiedCode] = useState('');

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

    const handleCopyCode = (code) => {
        navigator.clipboard.writeText(code);
        setCopiedCode(code);
        setTimeout(() => setCopiedCode(''), 2000);
    };

    const handleJoinLeague = async (e) => {
        e.preventDefault();
        if (!inviteCode.trim()) return;
        setIsLoading(true);
        setMessage({ type: '', text: '' });
        setNewLeagueInfo(null);
        try {
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
            const result = await createLeague({ leagueName });
            setNewLeagueInfo({ name: leagueName, code: result.data.inviteCode });
            setMessage({ type: 'success', text: result.data.message });
        } catch (error) {
            setMessage({ type: 'error', text: error.message });
        }
        setIsModalOpen(false);
        setIsLoading(false);
    };

    const handleLeaveLeague = async (leagueId) => {
        if (window.confirm("Are you sure you want to leave this league? This action cannot be undone.")) {
            setIsLoading(true);
            setMessage({ type: '', text: '' });
            setNewLeagueInfo(null);
            try {
                const result = await leaveLeague({ leagueId });
                setMessage({ type: 'success', text: result.data.message });
            } catch (error) {
                setMessage({ type: 'error', text: error.message });
            }
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border-theme border-accent dark:border-accent-dark shadow-theme">
            <CreateLeagueModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onCreate={handleCreateLeague}
                isLoading={isLoading}
            />
            <h2 className="text-2xl font-bold text-primary dark:text-primary-dark mb-4">My Leagues</h2>
            
            {userLeagues.length > 0 ? (
                <ul className="space-y-3 mb-6">
                    {userLeagues.map(league => (
                        <li key={league.id} className="p-3 bg-background dark:bg-background-dark rounded-theme border-theme border-accent dark:border-accent-dark">
                            <div className="flex items-center justify-between">
                                <p className="font-semibold text-text-primary dark:text-text-primary-dark">{league.name}</p>
                                <button
                                    onClick={() => handleLeaveLeague(league.id)}
                                    disabled={isLoading}
                                    className="text-sm border-theme border-red-500 text-red-500 hover:bg-red-500 hover:text-white font-bold py-1 px-3 rounded-theme disabled:opacity-50 transition-colors"
                                >
                                    Leave
                                </button>
                            </div>
                            <div className="flex items-center justify-between mt-2">
                                <p className="text-sm text-text-secondary dark:text-text-secondary-dark">
                                    Invite Code: <span className="font-mono bg-surface dark:bg-surface-dark px-2 py-1 rounded-theme">{league.inviteCode}</span>
                                </p>
                                <button
                                    onClick={() => handleCopyCode(league.inviteCode)}
                                    className="text-sm border-theme border-accent dark:border-accent-dark hover:bg-accent dark:hover:bg-accent-dark/20 text-text-primary dark:text-text-primary-dark font-bold py-1 px-3 rounded-theme transition-colors"
                                >
                                    {copiedCode === league.inviteCode ? 'Copied!' : 'Copy'}
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-text-secondary dark:text-text-secondary-dark mb-6 italic">You haven't joined any leagues yet.</p>
            )}

            <div className="space-y-4 border-t-theme border-accent dark:border-accent-dark pt-4">
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
    );
};

export default LeagueManager;