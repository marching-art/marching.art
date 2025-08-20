import React, { useState, useEffect } from 'react';
import { getFirestore, doc, getDoc, collection, getDocs, setDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';

// Note: You would pass 'db' and 'functions' as props from App.js or import them from firebase.js
const db = getFirestore(); 
const functions = getFunctions();

const FinalRankingsManager = () => {
    const [availableYears, setAvailableYears] = useState([]);
    const [selectedYear, setSelectedYear] = useState('');
    const [placements, setPlacements] = useState(Array(25).fill(''));
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        const fetchYears = async () => {
            setIsLoading(true);
            setMessage('');
            try {
                const rankingsCollectionRef = collection(db, 'final_rankings');
                const querySnapshot = await getDocs(rankingsCollectionRef);
                
                if (querySnapshot.empty) {
                    setMessage("No final rankings documents found in the database.");
                    setAvailableYears([]);
                    setSelectedYear('');
                } else {
                    const years = querySnapshot.docs.map(doc => doc.id).sort((a, b) => b - a);
                    setAvailableYears(years);
                    setSelectedYear(years[0]);
                }
            } catch (error) {
                console.error("Firebase Error: Could not fetch available years.", error);
                setMessage("Could not load available years. Please check Firestore security rules and ensure the collection 'final_rankings' exists.");
            }
            setIsLoading(false);
        };
        fetchYears();
    }, []);

    useEffect(() => {
        if (!selectedYear) {
            setPlacements(Array(25).fill(''));
            return;
        };

        const fetchDataForYear = async () => {
            setIsLoading(true);
            setMessage('');
            try {
                const rankingsDocRef = doc(db, 'final_rankings', selectedYear);
                const docSnap = await getDoc(rankingsDocRef);

                if (docSnap.exists()) {
                    const rankingsData = docSnap.data().data || [];
                    const newPlacements = Array(25).fill('');
                    rankingsData.forEach(item => {
                        if (item.rank > 0 && item.rank <= 25) {
                            newPlacements[item.rank - 1] = item.corps || '';
                        }
                    });
                    setPlacements(newPlacements);
                } else {
                    setMessage(`No data found for year ${selectedYear}. You can add it now.`);
                    setPlacements(Array(25).fill(''));
                }
            } catch (error) {
                console.error(`Firebase Error: Could not fetch data for ${selectedYear}.`, error);
                setMessage(`Could not load data for ${selectedYear}. Check Firestore security rules.`);
            }
            setIsLoading(false);
        };

        fetchDataForYear();
    }, [selectedYear]);

    const handlePlacementChange = (index, corpsName) => {
        const newPlacements = [...placements];
        newPlacements[index] = corpsName;
        setPlacements(newPlacements);
    };

    const handleSave = async () => {
        if (!selectedYear) {
            setMessage("Please select a year before saving.");
            return;
        }
        setIsLoading(true);
        setMessage('');

        const rankingsData = placements.map((corpsName, index) => ({
            rank: index + 1,
            corps: corpsName || null,
        }));

        try {
            const rankingsDocRef = doc(db, 'final_rankings', selectedYear);
            await setDoc(rankingsDocRef, { data: rankingsData });
            setMessage(`Rankings for ${selectedYear} saved successfully!`);
        } catch (error) {
            console.error("Firebase Error: Could not save final rankings.", error);
            setMessage("An error occurred while saving. Check Firestore security rules.");
        }
        setIsLoading(false);
    };

    return (
        <div className="space-y-4">
            <h2 className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">DCI Final Rankings Manager</h2>
            <p>Verify, edit, or add to the final rankings for a given season. This data is the source of truth for randomly selecting corps for off-seasons.</p>
            <div className="flex items-center space-x-2">
                <label htmlFor="year-select-placements" className="font-semibold">Season Year:</label>
                <select 
                    id="year-select-placements"
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="w-32 bg-gray-100 dark:bg-gray-900 border border-gray-400 dark:border-yellow-500 rounded p-2"
                    disabled={availableYears.length === 0}
                >
                    {availableYears.map(year => <option key={year} value={year}>{year}</option>)}
                </select>
            </div>
            {isLoading ? <p>Loading rankings for {selectedYear}...</p> : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {placements.map((corpsName, index) => (
                        <div key={index} className="flex items-center space-x-2">
                            <label className="w-8 font-semibold">{(index + 1).toString().padStart(2, '0')}.</label>
                            <input
                                type="text"
                                value={corpsName || ''}
                                onChange={(e) => handlePlacementChange(index, e.target.value)}
                                placeholder={`Corps #${index + 1}`}
                                className="flex-grow bg-gray-100 dark:bg-gray-900 border border-gray-400 dark:border-yellow-500 rounded p-2"
                            />
                        </div>
                    ))}
                </div>
            )}
            <button onClick={handleSave} disabled={isLoading || !selectedYear} className="mt-4 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded disabled:bg-gray-400">
                {isLoading ? 'Saving...' : `Save ${selectedYear} Rankings`}
            </button>
            {message && <p className="mt-2 text-sm font-semibold">{message}</p>}
        </div>
    );
};

export default FinalRankingsManager;
