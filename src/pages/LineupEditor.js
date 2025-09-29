import React, { useState, useEffect } from 'react';
import { db } from 'firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';

// As per the guidelines, these are the 8 captions.
const captions = ["GE1", "GE2", "Visual Proficiency", "Visual Analysis", "Color Guard", "Brass", "Music Analysis", "Percussion"];

// Point limits per class
const pointLimits = {
  "SoundSport": 90,
  "A Class": 60,
  "Open Class": 120,
  "World Class": 150,
};

const LineupEditor = ({ userProfile }) => {
  // We'll assume the user's highest unlocked class is their active one for now.
  // This can be made more dynamic later.
  const userClass = userProfile.unlockedClasses[userProfile.unlockedClasses.length - 1];
  const pointLimit = pointLimits[userClass] || 90;

  const [seasonCorps, setSeasonCorps] = useState([]);
  const [lineup, setLineup] = useState(captions.reduce((acc, caption) => ({ ...acc, [caption]: '' }), {}));
  const [totalPoints, setTotalPoints] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Fetch the list of 25 selectable corps for the current season
  useEffect(() => {
    const fetchSeasonCorps = async () => {
      // For now, we'll hardcode the season. This should be dynamic.
      const seasonId = '2025'; 
      const corpsRef = doc(db, `dci-data/${seasonId}/corps/values`); // Path based on guidelines [cite: 152]
      try {
        const docSnap = await getDoc(corpsRef);
        if (docSnap.exists()) {
          // The data is an array of {name: string, value: number}
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
  }, []);

  // Handle changes to a caption's dropdown selection
  const handleSelectChange = (caption, corpsValue) => {
    const selectedCorps = seasonCorps.find(c => c.value === parseInt(corpsValue));
    setLineup(prevLineup => ({
      ...prevLineup,
      [caption]: selectedCorps ? selectedCorps.value : '',
    }));
  };
  
  // Recalculate total points whenever the lineup changes
  useEffect(() => {
    let currentPoints = 0;
    for (const caption in lineup) {
      if (lineup[caption]) {
        currentPoints += parseInt(lineup[caption]);
      }
    }
    setTotalPoints(currentPoints);
  }, [lineup]);

  const handleSaveLineup = () => {
    // TODO: Implement the call to a Cloud Function to save the lineup.
    alert("Save functionality will be added in the next step!");
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
          disabled={isOverLimit}
          className="bg-primary hover:bg-primary-dark text-on-primary font-bold py-2 px-6 rounded-theme disabled:bg-gray-600 disabled:cursor-not-allowed"
        >
          Save Lineup
        </button>
      </div>
    </div>
  );
};

export default LineupEditor;