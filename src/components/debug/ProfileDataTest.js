// src/components/debug/ProfileDataTest.js - Test component to directly fetch profile data
import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db, dataNamespace } from '../../firebase';
import { useUserStore } from '../../store/userStore';
import { getAllUserCorps } from '../../utils/profileCompatibility';

const ProfileDataTest = () => {
    const { user } = useUserStore();
    const [testResults, setTestResults] = useState({});
    const [isLoading, setIsLoading] = useState(false);

    const runProfileTest = async () => {
        if (!user) {
            setTestResults({ error: 'No authenticated user' });
            return;
        }

        setIsLoading(true);
        const results = {
            userId: user.uid,
            timestamp: new Date().toISOString()
        };

        try {
            // Direct Firestore fetch
            const profileRef = doc(db, 'artifacts', dataNamespace, 'users', user.uid, 'profile', 'data');
            const profileDoc = await getDoc(profileRef);

            if (profileDoc.exists()) {
                const fullData = profileDoc.data();
                
                results.firestoreExists = true;
                results.firestoreKeys = Object.keys(fullData);
                results.firestoreDataSize = JSON.stringify(fullData).length;
                
                // Specific checks
                results.hasUsername = !!fullData.username;
                results.hasEmail = !!fullData.email;
                results.hasCorps = !!fullData.corps;
                results.hasAClass = !!fullData.aClass;
                results.hasCorpsName = !!fullData.corpsName;
                results.hasLineup = !!fullData.lineup;
                results.hasSelectedShows = !!fullData.selectedShows;
                
                // Test getAllUserCorps function
                const userCorps = getAllUserCorps(fullData);
                results.getAllUserCorpsResult = userCorps;
                results.getAllUserCorpsKeys = Object.keys(userCorps);
                
                // Show sample data
                results.sampleData = {
                    username: fullData.username,
                    email: fullData.email,
                    isAdmin: fullData.isAdmin,
                    aClass: fullData.aClass,
                    corpsName: fullData.corpsName,
                    totalSeasonScore: fullData.totalSeasonScore
                };
                
                // Raw data for inspection (truncated)
                const rawDataString = JSON.stringify(fullData, null, 2);
                results.rawDataPreview = rawDataString.length > 1000 
                    ? rawDataString.substring(0, 1000) + '...[TRUNCATED]'
                    : rawDataString;
                    
            } else {
                results.firestoreExists = false;
                results.error = 'Profile document does not exist';
            }
            
        } catch (error) {
            results.error = error.message;
            results.errorCode = error.code;
        }

        setTestResults(results);
        setIsLoading(false);
    };

    useEffect(() => {
        if (user) {
            runProfileTest();
        }
    }, [user]);

    if (!user) {
        return (
            <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded text-sm">
                <strong>Profile Data Test:</strong> No authenticated user
            </div>
        );
    }

    return (
        <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded text-xs max-w-4xl mx-auto my-4">
            <div className="flex justify-between items-center mb-4">
                <strong>Profile Data Test Results</strong>
                <button 
                    onClick={runProfileTest}
                    disabled={isLoading}
                    className="bg-blue-500 text-white px-3 py-1 rounded text-xs"
                >
                    {isLoading ? 'Testing...' : 'Refresh Test'}
                </button>
            </div>
            
            {Object.keys(testResults).length > 0 && (
                <div className="space-y-2">
                    <div><strong>User ID:</strong> {testResults.userId}</div>
                    <div><strong>Timestamp:</strong> {testResults.timestamp}</div>
                    
                    {testResults.error ? (
                        <div className="text-red-600">
                            <strong>Error:</strong> {testResults.error}
                            {testResults.errorCode && <span> (Code: {testResults.errorCode})</span>}
                        </div>
                    ) : (
                        <>
                            <div><strong>Firestore Document Exists:</strong> {String(testResults.firestoreExists)}</div>
                            <div><strong>Data Keys ({testResults.firestoreKeys?.length}):</strong> {testResults.firestoreKeys?.join(', ')}</div>
                            <div><strong>Data Size:</strong> {testResults.firestoreDataSize} characters</div>
                            
                            <div className="mt-3 p-2 bg-white dark:bg-gray-900 rounded">
                                <strong>Data Checks:</strong>
                                <div>• Has Username: {String(testResults.hasUsername)}</div>
                                <div>• Has Email: {String(testResults.hasEmail)}</div>
                                <div>• Has Corps Object: {String(testResults.hasCorps)}</div>
                                <div>• Has aClass: {String(testResults.hasAClass)}</div>
                                <div>• Has corpsName: {String(testResults.hasCorpsName)}</div>
                                <div>• Has lineup: {String(testResults.hasLineup)}</div>
                                <div>• Has selectedShows: {String(testResults.hasSelectedShows)}</div>
                            </div>
                            
                            {testResults.getAllUserCorpsResult && (
                                <div className="mt-3 p-2 bg-white dark:bg-gray-900 rounded">
                                    <strong>getAllUserCorps Result ({testResults.getAllUserCorpsKeys?.length}):</strong>
                                    <pre className="text-xs mt-1 overflow-x-auto">
                                        {JSON.stringify(testResults.getAllUserCorpsResult, null, 2)}
                                    </pre>
                                </div>
                            )}
                            
                            {testResults.sampleData && (
                                <div className="mt-3 p-2 bg-white dark:bg-gray-900 rounded">
                                    <strong>Sample Data:</strong>
                                    <pre className="text-xs mt-1 overflow-x-auto">
                                        {JSON.stringify(testResults.sampleData, null, 2)}
                                    </pre>
                                </div>
                            )}
                            
                            {testResults.rawDataPreview && (
                                <details className="mt-3">
                                    <summary className="cursor-pointer font-bold">Raw Data Preview</summary>
                                    <pre className="text-xs mt-2 bg-white dark:bg-gray-900 p-2 rounded overflow-x-auto">
                                        {testResults.rawDataPreview}
                                    </pre>
                                </details>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default ProfileDataTest;