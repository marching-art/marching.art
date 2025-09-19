import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import CreateLeagueModal from './CreateLeagueModal'; // Assumes this component exists from your original file
import Icon from '../ui/Icon'; // Assuming a generic Icon component

// A simple modal component for the restore functionality
const RestoreLeagueModal = ({ leagues, onRestore, onCreateNew, onClose, isLoading }) => (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
        <div className="bg-surface dark:bg-surface-dark rounded-theme shadow-lg max-w-md w-full p-6 border border-accent dark:border-accent-dark">
            <h3 className="text-xl font-bold text-primary dark:text-primary-dark mb-2">Restore a Previous League?</h3>
            <p className="text-text-secondary dark:text-text-secondary-dark mb-4 text-sm">We found leagues you created that are currently inactive. You can restore one or create a new one.</p>
            <div className="space-y-2 max-h-48 overflow-y-auto mb-4 p-1">
                {leagues.map(league => (
                    <div key={league.id} className="flex justify-between items-center p-3 bg-background dark:bg-background-dark rounded-theme">
                        <span className="font-semibold text-text-primary dark:text-text-primary-dark">{league.name}</span>
                        <button onClick={() => onRestore(league.id)} disabled={isLoading} className="bg-secondary hover:opacity-90 text-on-secondary font-bold py-1 px-3 rounded-theme text-xs transition-all disabled:opacity-50">Restore</button>
                    </div>
                ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-2 border-t border-accent dark:border-accent-dark pt-4">
                 <button onClick={onCreateNew} disabled={isLoading} className="flex-1 bg-primary hover:opacity-90 text-on-primary font-bold py-2 px-4 rounded-theme transition-all disabled:opacity-50">Create a New League</button>
                <button onClick={onClose} disabled={isLoading} className="flex-1 border border-accent dark:border-accent-dark hover:bg-accent dark:hover:bg-accent-dark/20 text-text-secondary dark:text-text-secondary-dark font-bold py-2 px-4 rounded-theme transition-all">Cancel</button>
            </div>
        </div>
    </div>
);


const LeagueManager = ({ profile }) => {
    const navigate = useNavigate();
    const [userLeagues, setUserLeagues] = useState([]);
    const [inviteCode, setInviteCode] = useState('');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [newLeagueInfo, setNewLeagueInfo] = useState(null);
    const [copiedCode, setCopiedCode] = useState('');
    
    // New state for restore flow
    const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
    const [restorableLeagues, setRestorableLeagues] = useState([]);

    // Re-added useEffect to fetch and display the user's current leagues
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

    const functions = getFunctions();
    // It's recommended to move these to a central api.js file for consistency
    const joinLeague = httpsCallable(functions, 'joinLeague');
    const createLeague = httpsCallable(functions, 'createLeague');
    const leaveLeague = httpsCallable(functions, 'leaveLeague');
    const checkForRestorableLeagues = httpsCallable(functions, 'checkForRestorableLeagues');
    const restoreLeague = httpsCallable(functions, 'restoreLeague');

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
        const toastId = toast.loading('Joining league...');
        try {
            const result = await joinLeague({ inviteCode: inviteCode.trim() });
            toast.success(result.data.message, { id: toastId });
            setInviteCode('');
        } catch (error) {
            toast.error(error.message, { id: toastId });
        }
        setIsLoading(false);
    };

    const handleCreateLeague = async (leagueName) => {
        setIsLoading(true);
        setMessage({ type: '', text: '' });
        const toastId = toast.loading('Creating league...');
        try {
            const result = await createLeague({ leagueName });
            setNewLeagueInfo({ name: leagueName, code: result.data.inviteCode });
            toast.success(result.data.message, { id: toastId });
            navigate(`/league/${result.data.leagueId}`);
        } catch (error) {
            toast.error(error.message, { id: toastId });
        }
        setIsCreateModalOpen(false);
        setIsLoading(false);
    };
    
    const handleRestoreLeague = async (leagueId) => {
        setIsLoading(true);
        const toastId = toast.loading('Restoring league...');
        try {
            const result = await restoreLeague({ leagueId });
            toast.success(result.data.message, { id: toastId });
            navigate(`/league/${leagueId}`);
        } catch (error) {
            toast.error(error.message, { id: toastId });
        } finally {
            setIsLoading(false);
            setIsRestoreModalOpen(false);
        }
    };

    const initiateCreateFlow = async () => {
        setIsLoading(true);
        const toastId = toast.loading('Checking for previous leagues...');
        try {
            const result = await checkForRestorableLeagues();
            toast.dismiss(toastId);
            const leagues = result.data.restorableLeagues || [];
            if (leagues.length > 0) {
                setRestorableLeagues(leagues);
                setIsRestoreModalOpen(true);
            } else {
                setIsCreateModalOpen(true);
            }
        } catch (error) {
            toast.error(error.message, { id: toastId });
        } finally {
            setIsLoading(false);
        }
    };

    const handleLeaveLeague = async (leagueId) => {
        if (window.confirm("Are you sure you want to leave this league?")) {
            setIsLoading(true);
            const toastId = toast.loading('Leaving league...');
            try {
                const result = await leaveLeague({ leagueId });
                toast.success(result.data.message, { id: toastId });
            } catch (error) {
                toast.error(error.message, { id: toastId });
            }
            setIsLoading(false);
        }
    };

    return (
        <div className="p-6">
            <CreateLeagueModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} onCreate={handleCreateLeague} isLoading={isLoading} />
            {isRestoreModalOpen && (
                <RestoreLeagueModal leagues={restorableLeagues} onRestore={handleRestoreLeague} onCreateNew={() => { setIsRestoreModalOpen(false); setIsCreateModalOpen(true); }} onClose={() => setIsRestoreModalOpen(false)} isLoading={isLoading} />
            )}
            
            <h2 className="text-2xl font-bold text-primary dark:text-primary-dark mb-4">Manage My Leagues</h2>
            {userLeagues.length > 0 && (
                <div className="mb-6">
                    <ul className="space-y-3">
                        {userLeagues.map(league => (
                            <li key={league.id} className="p-3 bg-background dark:bg-background-dark rounded-theme border border-accent dark:border-accent-dark">
                                <div className="flex items-center justify-between">
                                    <p className="font-semibold text-text-primary dark:text-text-primary-dark">{league.name}</p>
                                    <button onClick={() => handleLeaveLeague(league.id)} disabled={isLoading} className="text-sm border border-red-500 text-red-500 hover:bg-red-500 hover:text-white font-bold py-1 px-3 rounded-theme disabled:opacity-50 transition-colors">Leave</button>
                                </div>
                                <div className="flex items-center justify-between mt-2">
                                    <p className="text-sm text-text-secondary dark:text-text-secondary-dark">Invite Code: <span className="font-mono bg-surface dark:bg-surface-dark px-2 py-1 rounded-theme">{league.inviteCode}</span></p>
                                    <button onClick={() => handleCopyCode(league.inviteCode)} className="text-sm border border-accent dark:border-accent-dark hover:bg-accent dark:hover:bg-accent-dark/20 text-text-primary dark:text-text-primary-dark font-bold py-1 px-3 rounded-theme transition-colors">{copiedCode === league.inviteCode ? 'Copied!' : 'Copy'}</button>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-accent dark:border-accent-dark pt-6">
                <form onSubmit={handleJoinLeague} className="space-y-2">
                    <h3 className="font-semibold text-lg text-text-primary dark:text-text-primary-dark">Join a League</h3>
                    <input type="text" value={inviteCode} onChange={(e) => setInviteCode(e.target.value.toUpperCase())} placeholder="Enter Invite Code" className="w-full bg-background dark:bg-background-dark border border-accent dark:border-accent-dark rounded-theme p-2 text-text-primary dark:text-text-primary-dark font-mono uppercase focus:ring-2 focus:ring-primary focus:border-primary" />
                    <button type="submit" disabled={isLoading} className="w-full bg-primary hover:opacity-90 text-on-primary font-bold py-2 px-4 rounded-theme disabled:opacity-50">Join</button>
                </form>

                <div className="space-y-2">
                     <h3 className="font-semibold text-lg text-text-primary dark:text-text-primary-dark">Create a League</h3>
                     <p className="text-sm text-text-secondary dark:text-text-secondary-dark">Start a new competition with your friends.</p>
                    <button onClick={initiateCreateFlow} className="w-full bg-secondary hover:opacity-90 text-on-secondary font-bold py-2 px-4 rounded-theme">Create New League</button>
                </div>
            </div>

            {message.text && !newLeagueInfo && (
                <p className={`mt-4 text-sm font-semibold text-center ${message.type === 'error' ? 'text-red-500' : 'text-green-500'}`}>{message.text}</p>
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