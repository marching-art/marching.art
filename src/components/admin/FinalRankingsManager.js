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

    const formElementClass = "w-full bg-background dark:bg-background-dark border-theme border-accent dark:border-accent-dark rounded-theme p-2 text-text-primary dark:text-text-primary-dark focus:ring-2 focus:ring-primary focus:border-primary";

    return (
        <div className="space-y-4">
            <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark">DCI Final Rankings</h3>
            <p className="text-sm italic text-text-secondary dark:text-text-secondary-dark">
                This interface is the source of truth for game automation. Rankings here determine which corps are randomly selected for off-season play.
            </p>

            <div className="flex items-center space-x-2">
                <input
                    type="text"
                    value={newYearInput}
                    onChange={(e) => setNewYearInput(e.target.value)}
                    placeholder="New Year (e.g. 2026)"
                    className={formElementClass + " max-w-xs"}
                />
                <button
                    onClick={handleCreateNewYear}
                    disabled={isLoading || !newYearInput}
                    className="bg-primary hover:opacity-90 text-on-primary font-bold py-2 px-4 rounded-theme disabled:opacity-50"
                >
                    Add Year
                </button>
            </div>

            <div className="flex items-center space-x-2">
                <label htmlFor="year-select-placements" className="font-semibold text-text-primary dark:text-text-primary-dark">Season Year:</label>
                <select
                    id="year-select-placements"
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className={formElementClass + " max-w-xs"}
                    disabled={availableYears.length === 0}
                >
                    {availableYears.map(year => <option key={year} value={year}>{year}</option>)}
                </select>
            </div>

            {isLoading ? <p className="text-text-secondary dark:text-text-secondary-dark">Loading rankings for {selectedYear}...</p> : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {placements.map((entry, index) => (
                        <div key={index} className="space-y-1 border-theme border-accent dark:border-accent-dark p-2 rounded-theme bg-surface dark:bg-surface-dark">
                            <label className="font-semibold block text-text-primary dark:text-text-primary-dark">{(index + 1).toString().padStart(2, '0')}.</label>
                            <input
                                type="text"
                                value={entry.corps}
                                onChange={(e) => handlePlacementChange(index, 'corps', e.target.value)}
                                placeholder={`Corps #${index + 1}`}
                                className={formElementClass}
                            />
                            <input
                                type="number"
                                step="0.01"
                                value={entry.originalScore ?? ''}
                                onChange={(e) => handlePlacementChange(index, 'originalScore', e.target.value)}
                                placeholder="Score"
                                className={formElementClass}
                            />
                            <input
                                type="number"
                                value={entry.points ?? ''}
                                onChange={(e) => handlePlacementChange(index, 'points', e.target.value)}
                                placeholder="Points"
                                className={formElementClass}
                            />
                        </div>
                    ))}
                </div>
            )}

            <button
                onClick={handleSave}
                disabled={isLoading || !selectedYear}
                className="mt-4 bg-primary hover:opacity-90 text-on-primary font-bold py-2 px-4 rounded-theme disabled:opacity-50"
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