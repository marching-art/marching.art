import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useAuth } from '../../context/AuthContext';
import { useUserStore } from '../../store/userStore';
import toast from 'react-hot-toast';
import { Save, Info, AlertCircle } from 'lucide-react';

const REQUIRED_CAPTIONS = [
  { full: 'GE1', label: 'General Effect 1' },
  { full: 'GE2', label: 'General Effect 2' },
  { full: 'Visual Proficiency', label: 'Visual Proficiency' },
  { full: 'Visual Analysis', label: 'Visual Analysis' },
  { full: 'Color Guard', label: 'Color Guard' },
  { full: 'Brass', label: 'Brass' },
  { full: 'Music Analysis', label: 'Music Analysis' },
  { full: 'Percussion', label: 'Percussion' }
];

const CLASS_POINT_LIMITS = {
  'SoundSport': 90,
  'A Class': 60,
  'Open Class': 120,
  'World Class': 150
};

const LineupEditor = () => {
  const { currentUser } = useAuth();
  const { profile, corpsList, activeCorpsId } = useUserStore();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [seasonId, setSeasonId] = useState('');
  const [availableCorps, setAvailableCorps] = useState([]);
  const [lineup, setLineup] = useState({});
  const [hasChanges, setHasChanges] = useState(false);

  const activeCorps = corpsList.find(c => c.id === activeCorpsId);
  const corpsClass = activeCorps?.corpsClass || 'SoundSport';
  const pointLimit = CLASS_POINT_LIMITS[corpsClass];

  useEffect(() => {
    if (currentUser && activeCorps) {
      fetchLineupData();
    }
  }, [currentUser, activeCorps?.id]);

  const fetchLineupData = async () => {
  try {
    setLoading(true);

    // Get current season
    const gameSettingsRef = doc(db, 'game-settings/current');
    const gameSettingsSnap = await getDoc(gameSettingsRef);

    if (!gameSettingsSnap.exists()) {
      toast.error('No active season found');
      setLoading(false);
      return;
    }

    const currentSeasonId = gameSettingsSnap.data().activeSeasonId || 
                            gameSettingsSnap.data().currentSeasonId;
    setSeasonId(currentSeasonId);

    // Get available corps for this season
    const dciDataRef = doc(db, `dci-data/${currentSeasonId}`);
    const dciDataSnap = await getDoc(dciDataRef);

    if (dciDataSnap.exists()) {
      const dciData = dciDataSnap.data();
      const corpsArray = dciData.corps || dciData.corpsValues || [];
      
      // Create unique ID for each corps that includes point value
      const formattedCorps = corpsArray.map(corps => ({
        uniqueId: `${corps.name}|${corps.value}`,
        name: corps.name || corps.corpsName,
        value: corps.value || corps.pointCost || 0,
        rank: corps.rank || 0,
        sourceYear: corps.sourceYear || 'unknown',
        displayName: `${corps.name} (${corps.sourceYear}) - ${corps.value} pts`
      }));
      
      formattedCorps.sort((a, b) => b.value - a.value);
      setAvailableCorps(formattedCorps);
      
      console.log(`Loaded ${formattedCorps.length} corps for season ${currentSeasonId}`);
    } else {
      toast.error('No corps data available for current season');
      setAvailableCorps([]);
      setLoading(false);
      return;
    }

    // Load existing lineup from profile
    const profileRef = doc(db, `artifacts/marching-art/users/${currentUser.uid}/profile/data`);
    const profileSnap = await getDoc(profileRef);

    if (profileSnap.exists()) {
      const profileData = profileSnap.data();
      const savedLineup = profileData.lineup || {};
      
      console.log('Loaded saved lineup:', savedLineup);
      
      // Convert saved lineup (corps names) to uniqueId format for display
      const convertedLineup = {};
      REQUIRED_CAPTIONS.forEach(caption => {
        const savedCorpsName = savedLineup[caption.full];
        
        if (savedCorpsName) {
          // Find matching corps in available corps
          // First try exact match with any value
          const matchingCorps = formattedCorps.find(c => c.name === savedCorpsName);
          
          if (matchingCorps) {
            convertedLineup[caption.full] = matchingCorps.uniqueId;
            console.log(`Loaded ${caption.full}: ${matchingCorps.name} (${matchingCorps.value}pts)`);
          } else {
            console.warn(`Could not find corps "${savedCorpsName}" for ${caption.full}`);
            convertedLineup[caption.full] = '';
          }
        } else {
          convertedLineup[caption.full] = '';
        }
      });
      
      setLineup(convertedLineup);
      
      // Check if lineup is complete
      const filledCaptions = Object.values(convertedLineup).filter(v => v).length;
      if (filledCaptions > 0) {
        toast.success(`Loaded lineup with ${filledCaptions}/8 captions selected`);
      }
    } else {
      // Initialize empty lineup
      const emptyLineup = {};
      REQUIRED_CAPTIONS.forEach(caption => {
        emptyLineup[caption.full] = '';
      });
      setLineup(emptyLineup);
      console.log('No saved lineup found, initialized empty lineup');
    }

  } catch (error) {
    console.error('Error fetching lineup data:', error);
    toast.error('Failed to load lineup data');
  } finally {
    setLoading(false);
  }
};

const handleSave = async () => {
  const stats = calculateStats();

  if (!stats.isValid) {
    if (stats.missingCount > 0) {
      toast.error(`Please select all ${stats.missingCount} missing caption(s)`);
      return;
    }
    if (stats.isOverBudget) {
      toast.error(`Lineup exceeds budget by ${Math.abs(stats.pointsRemaining)} points`);
      return;
    }
  }

  setSaving(true);
  try {
    // Convert uniqueId back to just corps name for storage
    const lineupToSave = {};
    Object.entries(lineup).forEach(([caption, uniqueId]) => {
      if (uniqueId) {
        const [corpsName] = uniqueId.split('|');
        lineupToSave[caption] = corpsName;
      }
    });

    console.log('Saving lineup:', lineupToSave);

    const profileRef = doc(db, `artifacts/marching-art/users/${currentUser.uid}/profile/data`);
    
    // Use set with merge to ensure the document exists
    await setDoc(profileRef, {
      lineup: lineupToSave,
      activeSeasonId: seasonId,
      lastLineupUpdate: new Date().toISOString(),
      updatedAt: new Date()
    }, { merge: true });

    console.log('Lineup saved successfully');
    toast.success('Lineup saved successfully!');
    setHasChanges(false);

    // Verify the save worked
    const verifySnap = await getDoc(profileRef);
    if (verifySnap.exists()) {
      const verifyData = verifySnap.data();
      console.log('Verified saved lineup:', verifyData.lineup);
    }

  } catch (error) {
    console.error('Error saving lineup:', error);
    toast.error('Failed to save lineup: ' + error.message);
  } finally {
    setSaving(false);
  }
};

  const handleCorpsChange = (caption, uniqueId) => {
    setLineup(prev => ({
      ...prev,
      [caption]: uniqueId
    }));
    setHasChanges(true);
  };

  const calculateStats = () => {
    let totalPoints = 0;
    const usedCorps = new Set();
    let missingCount = 0;

    REQUIRED_CAPTIONS.forEach(caption => {
      const selectedUniqueId = lineup[caption.full];
      if (!selectedUniqueId) {
        missingCount++;
      } else {
        const corps = availableCorps.find(c => c.uniqueId === selectedUniqueId);
        if (corps) {
          totalPoints += corps.value;
          // Track corps name (not uniqueId) for duplicate checking
          usedCorps.add(corps.name);
        }
      }
    });

    const pointsRemaining = pointLimit - totalPoints;
    const isValid = missingCount === 0 && totalPoints <= pointLimit;

    return {
      totalPoints,
      pointsRemaining,
      missingCount,
      isValid,
      isOverBudget: totalPoints > pointLimit
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary dark:border-primary-dark"></div>
      </div>
    );
  }

  if (!activeCorps) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-16 h-16 mx-auto text-text-secondary dark:text-text-secondary-dark mb-4" />
        <h3 className="text-xl font-semibold text-text-primary dark:text-text-primary-dark mb-2">
          No Corps Selected
        </h3>
        <p className="text-text-secondary dark:text-text-secondary-dark">
          Please create or select a corps to edit lineups.
        </p>
      </div>
    );
  }

  if (availableCorps.length === 0) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-16 h-16 mx-auto text-text-secondary dark:text-text-secondary-dark mb-4" />
        <h3 className="text-xl font-semibold text-text-primary dark:text-text-primary-dark mb-2">
          No Corps Available
        </h3>
        <p className="text-text-secondary dark:text-text-secondary-dark">
          No corps have been assigned for the current season yet.
        </p>
      </div>
    );
  }

  const stats = calculateStats();

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="bg-surface dark:bg-surface-dark rounded-theme p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-text-primary dark:text-text-primary-dark">
              Caption Selection
            </h2>
            <p className="text-sm text-text-secondary dark:text-text-secondary-dark">
              {activeCorps.corpsName} • {corpsClass}
            </p>
          </div>
          
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges || !stats.isValid}
            className="px-4 sm:px-6 py-2 sm:py-3 bg-primary dark:bg-primary-dark hover:bg-primary-dark dark:hover:bg-primary text-white rounded-theme font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4 sm:w-5 sm:h-5" />
            {saving ? 'Saving...' : hasChanges ? 'Save Lineup' : 'Saved'}
          </button>
        </div>

        {/* Points Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-background dark:bg-background-dark rounded-theme p-3">
            <div className="text-xs text-text-secondary dark:text-text-secondary-dark mb-1">
              Used
            </div>
            <div className={`text-xl sm:text-2xl font-bold ${
              stats.isOverBudget ? 'text-error' : 'text-text-primary dark:text-text-primary-dark'
            }`}>
              {stats.totalPoints}
            </div>
          </div>
          
          <div className="bg-background dark:bg-background-dark rounded-theme p-3">
            <div className="text-xs text-text-secondary dark:text-text-secondary-dark mb-1">
              Limit
            </div>
            <div className="text-xl sm:text-2xl font-bold text-text-primary dark:text-text-primary-dark">
              {pointLimit}
            </div>
          </div>
          
          <div className="bg-background dark:bg-background-dark rounded-theme p-3">
            <div className="text-xs text-text-secondary dark:text-text-secondary-dark mb-1">
              Remaining
            </div>
            <div className={`text-xl sm:text-2xl font-bold ${
              stats.pointsRemaining < 0 ? 'text-error' : 'text-primary dark:text-primary-dark'
            }`}>
              {stats.pointsRemaining}
            </div>
          </div>
          
          <div className="bg-background dark:bg-background-dark rounded-theme p-3">
            <div className="text-xs text-text-secondary dark:text-text-secondary-dark mb-1">
              Missing
            </div>
            <div className={`text-xl sm:text-2xl font-bold ${
              stats.missingCount > 0 ? 'text-error' : 'text-primary dark:text-primary-dark'
            }`}>
              {stats.missingCount}
            </div>
          </div>
        </div>
      </div>

      {/* Caption Selections */}
      <div className="bg-surface dark:bg-surface-dark rounded-theme p-4 sm:p-6">
        <div className="space-y-4">
          {REQUIRED_CAPTIONS.map((caption) => {
            const selectedUniqueId = lineup[caption.full];
            const selectedCorps = availableCorps.find(c => c.uniqueId === selectedUniqueId);

            return (
              <div key={caption.full} className="space-y-2">
                <label className="block text-sm font-semibold text-text-primary dark:text-text-primary-dark">
                  {caption.label}
                  {selectedCorps && (
                    <span className="ml-2 text-xs font-normal text-text-secondary dark:text-text-secondary-dark">
                      ({selectedCorps.value} pts)
                    </span>
                  )}
                </label>
                
                <select
                  value={selectedUniqueId || ''}
                  onChange={(e) => handleCorpsChange(caption.full, e.target.value)}
                  className="w-full p-3 bg-background dark:bg-background-dark border-2 border-accent dark:border-accent-dark rounded-theme text-text-primary dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary-dark"
                >
                  <option value="">Not Selected</option>
                  {availableCorps.map((corps) => (
                    <option key={corps.uniqueId} value={corps.uniqueId}>
                      {corps.displayName}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-primary/5 dark:bg-primary-dark/5 border border-primary dark:border-primary-dark rounded-theme p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-primary dark:text-primary-dark flex-shrink-0 mt-0.5" />
          <div className="text-sm text-text-secondary dark:text-text-secondary-dark space-y-1">
            <p>
              • Select one DCI corps for each caption within your {pointLimit}-point budget
            </p>
            <p>
              • You can use the same corps for multiple captions if it appears at different point values
            </p>
            <p>
              • All 8 captions must be filled before saving
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LineupEditor;