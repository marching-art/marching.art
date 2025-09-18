import React from 'react';
import { useUserStore } from '../store/userStore';

const DebugAuth = () => {
    const { user, loggedInProfile, isLoadingAuth } = useUserStore();

    return (
        <div className="fixed bottom-4 right-4 bg-red-100 dark:bg-red-900 border-2 border-red-500 p-4 rounded-lg max-w-md z-50">
            <h3 className="font-bold text-red-800 dark:text-red-200 mb-2">🐛 Auth Debug</h3>
            <div className="text-xs space-y-1 text-red-700 dark:text-red-300">
                <div><strong>isLoadingAuth:</strong> {String(isLoadingAuth)}</div>
                <div><strong>user exists:</strong> {user ? 'YES' : 'NO'}</div>
                <div><strong>user.uid:</strong> {user?.uid || 'N/A'}</div>
                <div><strong>user.email:</strong> {user?.email || 'N/A'}</div>
                <div><strong>loggedInProfile exists:</strong> {loggedInProfile ? 'YES' : 'NO'}</div>
                <div><strong>profile.username:</strong> {loggedInProfile?.username || 'N/A'}</div>
                <div><strong>profile.isAdmin:</strong> {String(loggedInProfile?.isAdmin)}</div>
                <div><strong>profile.userId:</strong> {loggedInProfile?.userId || 'N/A'}</div>
                <div><strong>profile keys:</strong> {loggedInProfile ? Object.keys(loggedInProfile).join(', ') : 'N/A'}</div>
            </div>
            <button 
                onClick={() => {
                    console.log('Full auth state:', { user, loggedInProfile, isLoadingAuth });
                    console.log('Firebase user object:', user);
                    console.log('Profile object:', loggedInProfile);
                }}
                className="mt-2 text-xs bg-red-500 text-white px-2 py-1 rounded"
            >
                Log Full State to Console
            </button>
        </div>
    );
};

export default DebugAuth;