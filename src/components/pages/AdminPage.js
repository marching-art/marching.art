import React, { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase';
import FinalRankingsManager from '../admin/FinalRankingsManager';
import LiveSeasonScheduler from '../admin/LiveSeasonScheduler';
import SeasonControls from '../admin/SeasonControls';

const AdminPage = () => {
    const [email, setEmail] = useState('');
    const [isLoadingRoles, setIsLoadingRoles] = useState(false);
    const [message, setMessage] = useState('');

    const handleRoleChange = async (makeAdmin) => {
        setMessage('');
        setIsLoadingRoles(true);
        try {
            const setUserRole = httpsCallable(functions, 'setUserRole');
            const result = await setUserRole({ email, makeAdmin });
            setMessage(result.data.message || result.data.error);
        } catch (error) {
            console.error("Error calling function:", error);
            setMessage("An error occurred. Check the console for details.");
        }
        setIsLoadingRoles(false);
    };

    return (
        <div className="p-4 md:p-8 space-y-8">
            <h1 className="text-4xl font-bold text-yellow-800 dark:text-yellow-300 mb-6">Admin Panel</h1>
            
            <div className="bg-white dark:bg-gray-800 p-6 rounded-md border-2 border-yellow-500 shadow-lg">
                <h2 className="text-2xl font-bold text-yellow-700 dark:text-yellow-400 mb-4">Season Manager</h2>
                <SeasonControls />
                <div className="border-t-2 border-gray-200 dark:border-gray-700 my-6"></div>
                <LiveSeasonScheduler />
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-md border-2 border-yellow-500 shadow-lg">
                <FinalRankingsManager />
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-md border-2 border-yellow-500 shadow-lg">
                <h2 className="text-2xl font-bold text-yellow-700 dark:text-yellow-400 mb-4">Manage User Roles</h2>
                <div className="space-y-4">
                    <p>Enter a user's email address to grant or revoke admin privileges.</p>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" className="w-full bg-gray-100 dark:bg-gray-900 border border-gray-400 dark:border-yellow-500 rounded p-2 text-gray-800 dark:text-yellow-300 placeholder-gray-500 dark:placeholder-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500" />
                    <div className="flex space-x-4">
                        <button onClick={() => handleRoleChange(true)} disabled={isLoadingRoles || !email} className="bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded disabled:bg-gray-400"> {isLoadingRoles ? 'Working...' : 'Make Admin'} </button>
                        <button onClick={() => handleRoleChange(false)} disabled={isLoadingRoles || !email} className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded disabled:bg-gray-400"> {isLoadingRoles ? 'Working...' : 'Remove Admin'} </button>
                    </div>
                    {message && <p className="mt-4 text-sm font-semibold">{message}</p>}
                </div>
            </div>
        </div>
    );
};
export default AdminPage;