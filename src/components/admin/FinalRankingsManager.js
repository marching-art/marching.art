import { useEffect, useState } from 'react';
import { db } from '../../firebase';
import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';

const FinalRankingsManager = () => {
    const [availableYears, setAvailableYears] = useState([]);
    const [selectedYear, setSelectedYear] = useState('');
    const [placements, setPlacements] = useState(Array(25).fill({ corps: '', originalScore: null, points: null }));
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [newYearInput, setNewYearInput] = useState('');

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
                setMessage("Could not load available years. Please check Firestore security rules.");
            }
            setIsLoading(false);
        };
        fetchYears();
    }, []);

    useEffect(() => {
        if (!selectedYear) {
            setPlacements(Array(25).fill({ corps: '', originalScore: null, points: null }));
            return;
        }

        const fetchDataForYear = async () => {
            setIsLoading(true);
            setMessage('');
            try {
                const rankingsDocRef = doc(db, 'final_rankings', selectedYear);
                const docSnap = await getDoc(rankingsDocRef);

                if (docSnap.exists()) {
                    const rankingsData = docSnap.data().data || [];
                    const newPlacements = Array(25).fill({ corps: '', originalScore: null, points: null });
                    rankingsData.forEach(item => {
                        if (item.rank > 0 && item.rank <= 25) {
                            newPlacements[item.rank - 1] = {
                                corps: item.corps || '',
                                originalScore: item.originalScore ?? null,
                                points: item.points ?? null,
                            };
                        }
                    });
                    setPlacements(newPlacements);
                } else {
                    setMessage(`No data found for year ${selectedYear}. You can add it now.`);
                    setPlacements(Array(25).fill({ corps: '', originalScore: null, points: null }));
                }
            } catch (error) {
                console.error(`Firebase Error: Could not fetch data for ${selectedYear}.`, error);
                setMessage(`Could not load data for ${selectedYear}. Check Firestore security rules.`);
            }
            setIsLoading(false);
        };

        fetchDataForYear();
    }, [selectedYear]);

    const handlePlacementChange = (index, field, value) => {
        const newPlacements = [...placements];
        newPlacements[index] = {
            ...newPlacements[index],
            [field]: field === 'corps' ? value : (value === '' ? null : Number(value)),
        };
        setPlacements(newPlacements);
    };

    const validatePlacements = () => {
        const missingCorps = placements.some(p => !p.corps);
        if (missingCorps) return "All corps names must be filled.";

        const duplicateNames = new Set();
        for (let p of placements) {
            if (duplicateNames.has(p.corps)) return `Duplicate corps name found: ${p.corps}`;
            duplicateNames.add(p.corps);
        }

        return null;
    };

    const handleSave = async () => {
        if (!selectedYear) {
            setMessage("Please select a year before saving.");
            return;
        }

        const validationError = validatePlacements();
        if (validationError) {
            setMessage(validationError);
            return;
        }

        setIsLoading(true);
        setMessage('');

        const rankingsData = placements.map((entry, index) => ({
            rank: index + 1,
            corps: entry.corps || null,
            originalScore: entry.originalScore ?? null,
            points: entry.points ?? null,
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

    const handleCreateNewYear = async () => {
        const year = newYearInput.trim();
        if (!year || isNaN(year)) {
            setMessage("Please enter a valid year.");
            return;
        }
        if (availableYears.includes(year)) {
            setMessage(`Year ${year} already exists.`);
            return;
        }

        setIsLoading(true);
        setMessage('');

        const blankPlacements = Array(25).fill({
            corps: '',
            originalScore: null,
            points: null,
        });

        const rankingsData = blankPlacements.map((entry, index) => ({
            rank: index + 1,
            ...entry,
        }));

        try {
            const rankingsDocRef = doc(db, 'final_rankings', year);
            await setDoc(rankingsDocRef, { data: rankingsData });

            setAvailableYears(prev => [year, ...prev].sort((a, b) => b - a));
            setSelectedYear(year);
            setPlacements(blankPlacements);
            setNewYearInput('');
            setMessage(`Year ${year} created successfully!`);
        } catch (error) {
            console.error("Firebase Error: Could not create new year.", error);
            setMessage("An error occurred while creating the year. Check Firestore rules.");
        }

        setIsLoading(false);
    };

    return (
        <div className="space-y-4">
            <h2 className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">DCI Final Rankings Manager</h2>
            <p className="text-sm italic text-gray-600 dark:text-gray-400">
                This interface is the source of truth for game automation. Rankings here determine which corps are randomly selected for off-season play.
            </p>

            <div className="flex items-center space-x-2">
                <input
                    type="text"
                    value={newYearInput}
                    onChange={(e) => setNewYearInput(e.target.value)}
                    placeholder="New Year (e.g. 2026)"
                    className="w-32 bg-gray-100 dark:bg-gray-900 border border-gray-400 dark:border-yellow-500 rounded p-2"
                />
                <button
                    onClick={handleCreateNewYear}
                    disabled={isLoading || !newYearInput}
                    className="bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded disabled:bg-gray-400"
                >
                    Add Year
                </button>
            </div>

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
                    {placements.map((entry, index) => (
                        <div key={index} className="space-y-1 border p-2 rounded bg-gray-50 dark:bg-gray-800">
                            <label className="font-semibold block">{(index + 1).toString().padStart(2, '0')}.</label>
                            <input
                                type="text"
                                value={entry.corps}
                                onChange={(e) => handlePlacementChange(index, 'corps', e.target.value)}
                                placeholder={`Corps #${index + 1}`}
                                className="w-full bg-white dark:bg-gray-900 border border-gray-400 dark:border-yellow-500 rounded p-2"
                            />
                            <input
                                type="number"
                                step="0.01"
                                value={entry.originalScore ?? ''}
                                onChange={(e) => handlePlacementChange(index, 'originalScore', e.target.value)}
                                placeholder="Score"
                                className="w-full bg-white dark:bg-gray-900 border border-gray-400 dark:border-yellow-500 rounded p-2"
                            />
                            <input
                                type="number"
                                value={entry.points ?? ''}
                                onChange={(e) => handlePlacementChange(index, 'points', e.target.value)}
                                placeholder="Points"
                                className="w-full bg-white dark:bg-gray-900 border border-gray-400 dark:border-yellow-500 rounded p-2"
                            />
                        </div>
                    ))}
                </div>
            )}

            <button
                onClick={handleSave}
                disabled={isLoading || !selectedYear}
                className="mt-4 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded disabled:bg-gray-400"
            >
                {isLoading ? 'Saving...' : `Save ${selectedYear} Rankings`}
            </button>

            {message && (
                <p className="mt-2 text-sm font-semibold text-red-600 dark:text-red-400">
                    {message}
                </p>
            )}
        </div>
    );
};

export default FinalRankingsManager;
