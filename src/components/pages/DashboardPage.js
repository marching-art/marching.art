import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import LineupEditor from '../dashboard/LineupEditor';

const DashboardPage = ({ profile }) => {
    const [corpsData, setCorpsData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const previousYear = new Date().getFullYear() - 1; 
        const docRef = doc(db, 'dci-data', String(previousYear));
        
        const fetchData = async () => {
            try {
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setCorpsData(docSnap.data().corpsValues || []);
                } else {
                    console.log(`No corps data found for year ${previousYear}`);
                }
            } catch (error) {
                console.error("Error fetching corps data:", error);
            } finally {
                setIsLoading(false);
            }
        };
        
        fetchData();
    }, []);

    if (isLoading) {
        return (
            <div className="p-4 md:p-8">
                <h1 className="text-3xl md:text-4xl font-bold text-yellow-800 dark:text-yellow-300 mb-6">Manager Dashboard</h1>
                <p>Loading game data...</p>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8">
            <h1 className="text-3xl md:text-4xl font-bold text-yellow-800 dark:text-yellow-300 mb-6">Manager Dashboard</h1>
            <div className="grid lg:grid-cols-3 gap-8">
                <LineupEditor profile={profile} corpsData={corpsData} />
                <div className="bg-white dark:bg-gray-800 p-6 rounded-md border-2 border-yellow-500 shadow-lg">
                    <h2 className="text-2xl font-bold text-yellow-700 dark:text-yellow-400 mb-4">League Standings</h2>
                    <ol className="list-decimal list-inside space-y-2 text-gray-700 dark:text-yellow-300">
                        <li><span className="font-bold text-black dark:text-white">The Phantom Regiment</span> (You) - 1250.75 pts</li>
                        <li><span>Cavaliers Crew</span> - 1245.50 pts</li>
                        <li><span>Crown Joules</span> - 1230.00 pts</li>
                        <li><span>Blue Devils Brigade</span> - 1198.25 pts</li>
                    </ol>
                </div>
            </div>
        </div>
    );
};
export default DashboardPage;