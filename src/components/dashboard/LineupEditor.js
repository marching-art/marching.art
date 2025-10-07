import React, { useState, useEffect } from 'react';
import { db, functions } from '../../firebaseConfig';
import { httpsCallable } from 'firebase/functions';
import { doc, getDoc } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { useUserStore } from '../../store/userStore';
import toast from 'react-hot-toast';
import { 
  Save, 
  RotateCcw, 
  Info, 
  TrendingUp, 
  Shield,
  AlertCircle,
  CheckCircle2,
  Loader2
} from 'lucide-react';

const REQUIRED_CAPTIONS = [
  "GE1", 
  "GE2", 
  "Visual Proficiency", 
  "Visual Analysis",
  "Color Guard", 
  "Brass", 
  "Music Analysis", 
  "Percussion"
];

const CLASS_POINT_LIMITS = {
  "SoundSport": 90,
  "A Class": 60,
  "Open Class": 120,
  "World Class": 150,
};

const LineupEditor = () => {
  const { currentUser } = useAuth();
  const profile = useUserStore((state) => state.profile);
  
  const [lineup, setLineup] = useState({});
  const [originalLineup, setOriginalLineup] = useState({});
  const [availableCorps, setAvailableCorps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [seasonId, setSeasonId] = useState(null);
  const [validation, setValidation] = useState({
    valid: true,
    errors: [],
    totalPoints: 0,
    pointLimit: 0,
    pointsRemaining: 0
  });

  // Fetch available corps and current lineup
  useEffect(() => {
    if (profile && currentUser) {
      fetchLineupData();
    }
  }, [profile, currentUser]);

  // Real-time validation whenever lineup changes
  useEffect(() => {
    if (Object.keys(lineup).length > 0 && availableCorps.length > 0) {
      validateLineupRealtime();
    }
  }, [lineup, availableCorps]);

  const fetchLineupData = async () => {
  setLoading(true);
  
  try {
    // Get current season from game-settings/current
    const gameSettingsRef = doc(db, 'game-settings/current');
    const gameSettingsSnap = await getDoc(gameSettingsRef);
    
    if (!gameSettingsSnap.exists()) {
      toast.error('No active season found. Please contact admin.');
      setLoading(false);
      return;
    }
    
    const gameData = gameSettingsSnap.data();
    const currentSeasonId = gameData.seasonId || gameData.currentSeasonId;
    
    if (!currentSeasonId) {
      toast.error('Season ID not configured. Please contact admin.');
      setLoading(false);
      return;
    }
    
    setSeasonId(currentSeasonId);

    // Fetch available corps using backend function
    const getAvailableCorpsFunc = httpsCallable(functions, 'getAvailableCorps');
    const corpsResult = await getAvailableCorpsFunc({ seasonId: currentSeasonId });
    
    if (!corpsResult.data.success) {
      throw new Error('Failed to fetch corps data');
    }
    
    setAvailableCorps(corpsResult.data.corps);

    // Load existing lineup from profile
    const existingLineup = profile?.lineup || {};
    const initialLineup = {};
    
    // Initialize all captions (empty or with existing values)
    REQUIRED_CAPTIONS.forEach(caption => {
      initialLineup[caption] = existingLineup[caption] || '';
    });
    
    setLineup(initialLineup);
    setOriginalLineup({ ...initialLineup });

  } catch (error) {
    console.error('Error loading corps:', error);
    const errorMessage = error.message || 'Failed to load lineup editor';
    toast.error(errorMessage);
  } finally {
    setLoading(false);
  }
};

  const validateLineupRealtime = async () => {
    if (!seasonId || !profile) return;
    
    setValidating(true);
    
    try {
      const validateFunc = httpsCallable(functions, 'validateLineupPreview');
      const result = await validateFunc({
        seasonId,
        lineup,
        corpsClass: profile.corps?.corpsClass || 'SoundSport'
      });
      
      setValidation({
        valid: result.data.valid,
        errors: result.data.errors || [],
        totalPoints: result.data.totalPoints || 0,
        pointLimit: result.data.pointLimit || CLASS_POINT_LIMITS[profile.corps?.corpsClass] || 90,
        pointsRemaining: result.data.pointsRemaining || 0,
        lineupDetails: result.data.lineupDetails || {}
      });
      
    } catch (error) {
      console.error('Validation error:', error);
      // Don't show error toast for real-time validation
    } finally {
      setValidating(false);
    }
  };

  const handleCorpsChange = (caption, corpsName) => {
    setLineup(prev => ({
      ...prev,
      [caption]: corpsName
    }));
  };

  const handleSave = async () => {
    if (!validation.valid) {
      toast.error(validation.errors.join(' '));
      return;
    }
    
    setSaving(true);
    
    try {
      const saveLineupFunc = httpsCallable(functions, 'validateAndSaveLineup');
      const result = await saveLineupFunc({
        seasonId,
        lineup
      });
      
      if (result.data.success) {
        toast.success(result.data.message);
        setOriginalLineup({ ...lineup });
        
        // Update profile in store
        const updatedProfile = {
          ...profile,
          lineup,
          lineupDetails: result.data.lineupDetails,
          corps: {
            ...profile.corps,
            totalPoints: result.data.totalPoints,
            pointsRemaining: result.data.pointsRemaining
          }
        };
        useUserStore.getState().setProfile(updatedProfile);
      }
      
    } catch (error) {
      console.error('Error saving lineup:', error);
      const errorMessage = error.message || 'Failed to save lineup. Please try again.';
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setLineup({ ...originalLineup });
    toast.info('Lineup reset to last saved version');
  };

  const hasUnsavedChanges = () => {
    return JSON.stringify(lineup) !== JSON.stringify(originalLineup);
  };

  const getCorpsValue = (corpsName) => {
    const corps = availableCorps.find(c => c.name === corpsName);
    return corps ? corps.value : 0;
  };

  const isCorpsUsed = (corpsName, currentCaption) => {
    return Object.entries(lineup).some(
      ([caption, selectedCorps]) => 
        caption !== currentCaption && selectedCorps === corpsName
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary dark:text-primary-dark" />
        <span className="ml-3 text-text-secondary dark:text-text-secondary-dark">
          Loading lineup editor...
        </span>
      </div>
    );
  }

  const corpsClass = profile?.corps?.corpsClass || 'SoundSport';
  const pointLimit = CLASS_POINT_LIMITS[corpsClass];
  const percentUsed = (validation.totalPoints / pointLimit) * 100;

  return (
    <div className="space-y-6">
      {/* Header with Point Summary */}
      <div className="bg-surface dark:bg-surface-dark rounded-theme p-6 border-2 border-accent dark:border-accent-dark">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark flex items-center gap-2">
              <Shield className="w-6 h-6" />
              Lineup Editor
            </h2>
            <p className="text-text-secondary dark:text-text-secondary-dark mt-1">
              Select 8 corps for each caption • {corpsClass} Class
            </p>
          </div>
          
          <div className="text-right">
            <div className="text-3xl font-bold text-primary dark:text-primary-dark">
              {validation.totalPoints} / {pointLimit}
            </div>
            <div className="text-sm text-text-secondary dark:text-text-secondary-dark">
              Points Used {validating && <Loader2 className="inline w-3 h-3 animate-spin ml-1" />}
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
          <div 
            className={`h-full transition-all duration-300 ${
              percentUsed > 100 
                ? 'bg-red-500' 
                : percentUsed > 90 
                  ? 'bg-yellow-500' 
                  : 'bg-green-500'
            }`}
            style={{ width: `${Math.min(percentUsed, 100)}%` }}
          />
        </div>
        
        <div className="flex items-center justify-between mt-2 text-sm">
          <span className={`font-medium ${
            validation.pointsRemaining < 0 
              ? 'text-red-600 dark:text-red-400' 
              : 'text-text-secondary dark:text-text-secondary-dark'
          }`}>
            {validation.pointsRemaining >= 0 
              ? `${validation.pointsRemaining} points remaining` 
              : `${Math.abs(validation.pointsRemaining)} points over limit`}
          </span>
          
          {validation.valid ? (
            <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
              <CheckCircle2 className="w-4 h-4" />
              Valid Lineup
            </span>
          ) : (
            <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
              <AlertCircle className="w-4 h-4" />
              Invalid Lineup
            </span>
          )}
        </div>

        {/* Validation Errors */}
        {validation.errors.length > 0 && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-theme">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-red-800 dark:text-red-300 mb-1">
                  Please fix the following issues:
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm text-red-700 dark:text-red-400">
                  {validation.errors.map((error, idx) => (
                    <li key={idx}>{error}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Caption Selections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {REQUIRED_CAPTIONS.map(caption => (
          <div 
            key={caption}
            className="bg-surface dark:bg-surface-dark rounded-theme p-4 border border-accent dark:border-accent-dark"
          >
            <label className="block mb-2">
              <span className="font-semibold text-text-primary dark:text-text-primary-dark">
                {caption}
              </span>
              {lineup[caption] && (
                <span className="ml-2 text-sm text-text-secondary dark:text-text-secondary-dark">
                  ({getCorpsValue(lineup[caption])} pts)
                </span>
              )}
            </label>
            
            <select
              value={lineup[caption] || ''}
              onChange={(e) => handleCorpsChange(caption, e.target.value)}
              className="w-full px-3 py-2 bg-background dark:bg-background-dark border border-accent dark:border-accent-dark rounded-theme text-text-primary dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary-dark"
            >
              <option value="">-- Select Corps --</option>
              {availableCorps.map(corps => (
                <option 
                  key={corps.name} 
                  value={corps.name}
                  disabled={isCorpsUsed(corps.name, caption)}
                  className={isCorpsUsed(corps.name, caption) ? 'text-gray-400' : ''}
                >
                  {corps.name} ({corps.value} pts) {isCorpsUsed(corps.name, caption) ? '✓ Used' : ''}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between gap-4 pt-4">
        <button
          onClick={handleReset}
          disabled={!hasUnsavedChanges() || saving}
          className="flex items-center gap-2 px-6 py-3 bg-gray-500 hover:bg-gray-600 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white rounded-theme transition-colors disabled:cursor-not-allowed"
        >
          <RotateCcw className="w-5 h-5" />
          Reset Changes
        </button>

        <button
          onClick={handleSave}
          disabled={!validation.valid || !hasUnsavedChanges() || saving}
          className="flex items-center gap-2 px-8 py-3 bg-primary hover:bg-primary-dark disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white rounded-theme transition-colors disabled:cursor-not-allowed font-semibold"
        >
          {saving ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              Save Lineup
            </>
          )}
        </button>
      </div>

      {/* Help Text */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-theme p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
            <p><strong>Rules:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>All 8 captions must be filled</li>
              <li>Each corps can only be used once</li>
              <li>Total points cannot exceed {pointLimit} for {corpsClass} class</li>
              <li>Higher value corps = stronger in that caption</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LineupEditor;