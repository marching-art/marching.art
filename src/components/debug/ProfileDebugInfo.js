// src/components/debug/ProfileDebugInfo.js - Debug component to diagnose profile loading issues
import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db, dataNamespace } from '../../firebase';
import { useUserStore } from '../../store/userStore';

const ProfileDebugInfo = () => {
    const { user, loggedInProfile, isLoadingAuth, connectionError } = useUserStore();
    const [debugInfo, setDebugInfo] = useState({});
    const [manualProfileData, setManualProfileData] = useState(null);

    useEffect(() => {
        const gatherDebugInfo = async () => {
            const info = {
                timestamp: new Date().toISOString(),
                userExists: !!user,
                userId: user?.uid || 'Not set',
                userEmail: user?.email || 'Not set',
                loggedInProfileExists: !!loggedInProfile,
                loggedInProfileData: loggedInProfile || 'No profile data',
                isLoadingAuth,
                connectionError: connectionError || 'No error',
                dataNamespace: dataNamespace || 'Not set',
                expectedPath: user?.uid ? `artifacts/${dataNamespace}/users/${user.uid}/profile/data` : 'No user ID',
            };

            // Try to manually fetch the profile
            if (user?.uid && dataNamespace) {
                try {
                    const profileRef = doc(db, 'artifacts', dataNamespace, 'users', user.uid, 'profile', 'data');
                    const profileDoc = await getDoc(profileRef);
                    
                    info.manualFetchResult = {
                        exists: profileDoc.exists(),
                        data: profileDoc.exists() ? profileDoc.data() : 'Document does not exist'
                    };
                    
                    if (profileDoc.exists()) {
                        setManualProfileData(profileDoc.data());
                    }
                } catch (error) {
                    info.manualFetchResult = {
                        error: error.message,
                        errorCode: error.code
                    };
                }
            }

            setDebugInfo(info);
        };

        gatherDebugInfo();
    }, [user, loggedInProfile, isLoadingAuth, connectionError, dataNamespace]);

    // Don't show debug info unless there's an issue
    if (!user || (loggedInProfile && !connectionError)) {
        return null;
    }

    return (
        <div className="fixed top-4 right-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-lg p-4 max-w-md text-xs z-50">
            <div className="mb-2 text-red-800 dark:text-red-200 font-bold">
                🐛 Profile Debug Info
            </div>
            
            <div className="space-y-2 text-red-700 dark:text-red-300">
                <div><strong>User ID:</strong> {debugInfo.userId}</div>
                <div><strong>Email:</strong> {debugInfo.userEmail}</div>
                <div><strong>Data Namespace:</strong> {debugInfo.dataNamespace}</div>
                <div><strong>Expected Path:</strong> {debugInfo.expectedPath}</div>
                <div><strong>Loading Auth:</strong> {debugInfo.isLoadingAuth ? 'Yes' : 'No'}</div>
                <div><strong>Profile Loaded:</strong> {debugInfo.loggedInProfileExists ? 'Yes' : 'No'}</div>
                <div><strong>Connection Error:</strong> {debugInfo.connectionError}</div>
                
                {debugInfo.manualFetchResult && (
                    <div>
                        <strong>Manual Fetch:</strong>
                        <div className="pl-2 mt-1">
                            <div>Exists: {debugInfo.manualFetchResult.exists ? 'Yes' : 'No'}</div>
                            {debugInfo.manualFetchResult.error && (
                                <div>Error: {debugInfo.manualFetchResult.error}</div>
                            )}
                            {debugInfo.manualFetchResult.exists && manualProfileData && (
                                <div>Username: {manualProfileData.username || 'No username'}</div>
                            )}
                        </div>
                    </div>
                )}
                
                <div className="pt-2 border-t border-red-300 dark:border-red-700">
                    <strong>Timestamp:</strong> {debugInfo.timestamp}
                </div>
            </div>

            {manualProfileData && (
                <div className="mt-3 pt-3 border-t border-red-300 dark:border-red-700">
                    <button 
                        onClick={() => {
                            // Force reload the profile in userStore
                            window.location.reload();
                        }}
                        className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-xs"
                    >
                        Force Reload
                    </button>
                </div>
            )}
        </div>
    );
};

export default ProfileDebugInfo;