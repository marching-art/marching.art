import React, { useState, useEffect } from 'react';
import { db, functions } from 'firebaseConfig'; // Import functions
import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions'; // Import httpsCallable
import toast from 'react-hot-toast'; // A library for user notifications

const captions = ["GE1", "GE2", "Visual Proficiency", "Visual Analysis", "Color Guard", "Brass", "Music Analysis", "Percussion"];

const pointLimits = {
  "SoundSport": 90,
  "A Class": 60,
  "Open Class": 120,
  "World Class": 150,
};

const LineupEditor = ({ userProfile }) => {
  const userClass = userProfile.unlockedClasses[userProfile.unlockedClasses.length - 1];
  const pointLimit = pointLimits[userClass] || 90;
  const seasonId = '2025'; // This should be dynamic later

  const [seasonCorps, setSeasonCorps] = useState([]);
  const [lineup, setLineup] = useState(captions.reduce((acc, caption) => ({ ...acc, [caption]: '' }), {}));
  const [totalPoints, setTotalPoints] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  
  useEffect(() => {
    const fetchSeasonCorps = async () => {
      const corpsRef = doc(db, `dci-data/${seasonId}/corps/values`);
      try {
        const docSnap = await getDoc(corpsRef);
        if (docSnap.exists()) {
          const corpsData = docSnap.data().corpsList; 
          setSeasonCorps(corpsData.sort((a, b) => a.name.localeCompare(b.name)));
        } else {
          setError("Could not load season corps data.");
        }
      } catch (err) {
        setError("Error fetching season corps data.");
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSeasonCorps();
  }, [seasonId]);

  const handleSelectChange = (caption, corpsValue) => {
    const selectedCorps = seasonCorps.find(c => c.value === parseInt(corpsValue));
    setLineup(prevLineup => ({
      ...prevLineup,
      [caption]: selectedCorps ? selectedCorps.value : '',
    }));
  };
  
  useEffect(() => {
    let currentPoints = 0;
    for (const caption in lineup) {
      if (lineup[caption]) {
        currentPoints += parseInt(lineup[caption]);
      }
    }
    setTotalPoints(currentPoints);
  }, [lineup]);

  const handleSaveLineup = async () => {
    // Check if all captions are filled
    if (Object.values(lineup).some(val => val === '')) {
      toast.error("Please select a corps for all 8 captions.");
      return;
    }
    
    setIsSaving(true);
    const saveLineupFunction = httpsCallable(functions, 'saveLineup');
    
    try {
      const result = await saveLineupFunction({ seasonId, lineup });
      toast.success(result.data.message);
    } catch (error) {
      console.error("Error calling saveLineup function:", error);
      toast.error(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div className="bg-surface-dark p-6 rounded-theme">Loading Lineup Editor...</div>;
  if (error) return <div className="bg-surface-dark p-6 rounded-theme text-red-500">{error}</div>;

  const isOverLimit = totalPoints > pointLimit;

  return (
    <div className="bg-surface-dark p-6 rounded-theme shadow-theme-dark">
      <h2 className="text-2xl font-bold mb-4 text-text-primary-dark border-b border-accent-dark pb-2">Lineup Editor - {userClass}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {captions.map(caption => (
          <div key={caption}>
            <label htmlFor={caption} className="block text-sm font-medium text-text-secondary-dark mb-1">{caption}</label>
            <select
              id={caption}
              value={lineup[caption]}
              onChange={(e) => handleSelectChange(caption, e.target.value)}
              className="w-full p-2 bg-background-dark border border-accent-dark rounded-theme focus:outline-none focus:ring-2 focus:ring-primary-dark"
            >
              <option value="">-- Select a Corps --</option>
              {seasonCorps.map(corps => (
                <option key={corps.name} value={corps.value}>
                  {corps.name} ({corps.value} pts)
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
      <div className="mt-6 flex justify-between items-center">
        <div className={`text-lg font-bold ${isOverLimit ? 'text-red-500' : 'text-text-primary-dark'}`}>
          Total Points: {totalPoints} / {pointLimit}
        </div>
        <button
          onClick={handleSaveLineup}
          disabled={isOverLimit || isSaving}
          className="bg-primary hover:bg-primary-dark text-on-primary font-bold py-2 px-6 rounded-theme disabled:bg-gray-600 disabled:cursor-not-allowed"
        >
          {isSaving ? 'Saving...' : 'Save Lineup'}
        </button>
      </div>
    </div>
  );
};

export default LineupEditor;