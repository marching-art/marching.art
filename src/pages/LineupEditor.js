import React, { useState, useEffect } from 'react';
import { db } from '../../firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { functions, dataNamespace } from '../../firebaseConfig';
import toast from 'react-hot-toast';
import { Save, AlertCircle, CheckCircle, Info } from 'lucide-react';

// DCI Caption requirements - all 8 captions must be filled
const captions = ["GE1", "GE2", "Visual Proficiency", "Visual Analysis", "Color Guard", "Brass", "Music Analysis", "Percussion"];

// Point limits per class
const pointLimits = {
  "SoundSport": 90,
  "A Class": 60,
  "Open Class": 120,
  "World Class": 150,
};

const LineupEditor = ({ userProfile }) => {
  const userClass = userProfile?.corps?.corpsClass || 'SoundSport';
  const pointLimit = pointLimits[userClass] || 90;

  const [seasonCorps, setSeasonCorps] = useState([]);
  const [lineup, setLineup] = useState(userProfile?.lineup || captions.reduce((acc, caption) => ({ ...acc, [caption]: '' }), {}));
  const [totalPoints, setTotalPoints] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  
  // Fetch the list of 25 selectable corps for the current season
  useEffect(() => {
    const fetchSeasonCorps = async () => {
      try {
        setIsLoading(true);
        setError('');
        
        // Get current season from game-settings
        const seasonDoc = await getDoc(doc(db, 'game-settings', 'current'));
        if (!seasonDoc.exists()) {
          setError("No active season found.");
          return;
        }
        
        const seasonId = seasonDoc.data().activeSeasonId;
        
        // Fetch corps values for the season
        const corpsRef = doc(db, `dci_data/${seasonId}/corpsValues/data`);
        const docSnap = await getDoc(corpsRef);
        
        if (docSnap.exists()) {
          const corpsData = docSnap.data().corps || [];
          setSeasonCorps(corpsData.sort((a, b) => b.value - a.value)); // Sort by value descending
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

  const handleSaveLineup = async () => {
    try {
      setIsSaving(true);
      
      // Validate lineup
      const allCaptionsFilled = captions.every(caption => lineup[caption]);
      if (!allCaptionsFilled) {
        toast.error('Please fill all 8 captions');
        return;
      }
      
      if (totalPoints > pointLimit) {
        toast.error(`Total points exceed limit of ${pointLimit}`);
        return;
      }
      
      // Get current season
      const seasonDoc = await getDoc(doc(db, 'game-settings', 'current'));
      if (!seasonDoc.exists()) {
        toast.error('No active season found');
        return;
      }
      
      const seasonId = seasonDoc.data().activeSeasonId;
      
      // Call save lineup function
      const saveLineupFn = httpsCallable(functions, 'validateAndSaveLineup');
      const result = await saveLineupFn({
        seasonId,
        lineup
      });
      
      if (result.data.success) {
        toast.success('Lineup saved successfully!');
      } else {
        toast.error(result.data.message || 'Failed to save lineup');
      }
    } catch (error) {
      console.error('Error saving lineup:', error);
      toast.error('Failed to save lineup');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary dark:border-primary-dark mx-auto mb-4"></div>
          <p className="text-text-secondary dark:text-text-secondary-dark">Loading corps data...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme">
        <div className="flex items-center gap-2 text-error mb-2">
          <AlertCircle className="w-5 h-5" />
          <span className="font-medium">Error</span>
        </div>
        <p className="text-text-secondary dark:text-text-secondary-dark">{error}</p>
      </div>
    );
  }

  const isOverLimit = totalPoints > pointLimit;
  const allFilled = captions.every(caption => lineup[caption]);

  return (
    <div className="space-y-6">
      <div className="bg-background dark:bg-background-dark p-4 rounded-theme border border-accent dark:border-accent-dark">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-primary dark:text-primary-dark flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-text-primary dark:text-text-primary-dark mb-1">Caption Selection</h3>
            <p className="text-sm text-text-secondary dark:text-text-secondary-dark">
              Select one corps for each of the 8 captions. Your total points cannot exceed {pointLimit} for {userClass}.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {captions.map(caption => {
          const selectedValue = lineup[caption];
          const selectedCorps = seasonCorps.find(c => c.value === selectedValue);
          
          return (
            <div key={caption} className="space-y-2">
              <label htmlFor={caption} className="block text-sm font-medium text-text-primary dark:text-text-primary-dark">
                {caption}
                {selectedCorps && (
                  <span className="ml-2 text-xs text-text-secondary dark:text-text-secondary-dark">
                    ({selectedCorps.value} pts)
                  </span>
                )}
              </label>
              <select
                id={caption}
                value={selectedValue}
                onChange={(e) => handleSelectChange(caption, e.target.value)}
                className="w-full p-2 bg-background dark:bg-background-dark border border-accent dark:border-accent-dark rounded-theme focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary-dark text-text-primary dark:text-text-primary-dark"
              >
                <option value="">-- Select Corps --</option>
                {seasonCorps.map(corps => (
                  <option key={corps.name} value={corps.value}>
                    {corps.name} ({corps.value})
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between p-4 bg-background dark:bg-background-dark rounded-theme border border-accent dark:border-accent-dark">
        <div className="flex items-center gap-4">
          <div>
            <div className="text-sm text-text-secondary dark:text-text-secondary-dark mb-1">Total Points</div>
            <div className={`text-2xl font-bold ${isOverLimit ? 'text-error' : allFilled ? 'text-success' : 'text-text-primary dark:text-text-primary-dark'}`}>
              {totalPoints} / {pointLimit}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {allFilled && !isOverLimit && (
              <div className="flex items-center gap-1 text-success text-sm">
                <CheckCircle className="w-4 h-4" />
                <span>Ready to save</span>
              </div>
            )}
            {isOverLimit && (
              <div className="flex items-center gap-1 text-error text-sm">
                <AlertCircle className="w-4 h-4" />
                <span>Over limit</span>
              </div>
            )}
          </div>
        </div>
        <button
          onClick={handleSaveLineup}
          disabled={isOverLimit || !allFilled || isSaving}
          className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white font-bold py-3 px-6 rounded-theme disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
        >
          {isSaving ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              <span>Saving...</span>
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              <span>Save Lineup</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default LineupEditor;