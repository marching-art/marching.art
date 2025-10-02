import React, { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebaseConfig';
import toast from 'react-hot-toast';
import { Save, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';

// DCI Caption requirements - all 8 captions must be filled
const CAPTIONS = [
  { id: "GE1", name: "General Effect 1", shortName: "GE1" },
  { id: "GE2", name: "General Effect 2", shortName: "GE2" },
  { id: "Visual Proficiency", name: "Visual Proficiency", shortName: "VP" },
  { id: "Visual Analysis", name: "Visual Analysis", shortName: "VA" },
  { id: "Color Guard", name: "Color Guard", shortName: "CG" },
  { id: "Brass", name: "Brass", shortName: "BR" },
  { id: "Music Analysis", name: "Music Analysis", shortName: "MA" },
  { id: "Percussion", name: "Percussion", shortName: "PE" }
];

// Point limits per class
const POINT_LIMITS = {
  "SoundSport": 90,
  "A Class": 60,
  "Open Class": 120,
  "World Class": 150,
};

const LineupEditor = ({ userProfile }) => {
  const userClass = userProfile?.corps?.corpsClass || 'SoundSport';
  const pointLimit = POINT_LIMITS[userClass] || 90;

  const [seasonCorps, setSeasonCorps] = useState([]);
  const [lineup, setLineup] = useState({});
  const [totalPoints, setTotalPoints] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);
  const [seasonId, setSeasonId] = useState(null);

  // Initialize lineup from user profile or empty
  useEffect(() => {
    if (userProfile?.lineup) {
      setLineup(userProfile.lineup);
    } else {
      // Initialize empty lineup
      const emptyLineup = {};
      CAPTIONS.forEach(caption => {
        emptyLineup[caption.id] = '';
      });
      setLineup(emptyLineup);
    }
  }, [userProfile]);

  // Fetch available corps for the current season
  useEffect(() => {
    fetchAvailableCorps();
  }, []);

  const fetchAvailableCorps = async () => {
    try {
      setIsLoading(true);
      
      const getAvailableCorps = httpsCallable(functions, 'getAvailableCorps');
      const result = await getAvailableCorps();
      
      console.log('Raw result:', result); // Debug log
      console.log('Result data:', result.data); // Debug log
      console.log('Corps array:', result.data?.corps); // Debug log
      
      if (result.data.success && result.data.corps) {
        const sortedCorps = result.data.corps.sort((a, b) => b.value - a.value);
        console.log('Sorted corps:', sortedCorps); // Debug log
        console.log('First corps item full details:', JSON.stringify(sortedCorps[0], null, 2));
        setSeasonCorps(sortedCorps);
        setSeasonId(result.data.seasonId);
      } else {
        toast.error('No corps available for current season');
        setSeasonCorps([]);
      }
    } catch (error) {
      console.error('Error loading corps:', error);
      toast.error('Failed to load available corps');
      setSeasonCorps([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate total points whenever lineup changes
  useEffect(() => {
    let points = 0;
    Object.values(lineup).forEach(value => {
      if (value && !isNaN(value)) {
        points += parseInt(value);
      }
    });
    setTotalPoints(points);
  }, [lineup]);

  // Handle caption selection change
  const handleCaptionChange = (captionId, value) => {
    setLineup(prev => ({
      ...prev,
      [captionId]: value
    }));
    
    // Clear validation errors when user makes changes
    setValidationErrors([]);
  };

  // Validate lineup
  const validateLineup = async () => {
    setIsValidating(true);
    const errors = [];
    
    try {
      // Check all captions are filled
      const emptyCaptions = CAPTIONS.filter(caption => !lineup[caption.id]);
      if (emptyCaptions.length > 0) {
        errors.push(`Missing selections for: ${emptyCaptions.map(c => c.shortName).join(', ')}`);
      }
      
      // Check point limit
      if (totalPoints > pointLimit) {
        errors.push(`Total points (${totalPoints}) exceeds limit of ${pointLimit}`);
      }
      
      // Check for duplicate corps across captions
      const usedCorps = {};
      Object.entries(lineup).forEach(([caption, value]) => {
        if (value) {
          if (usedCorps[value]) {
            errors.push(`Same corps selected for ${caption} and ${usedCorps[value]}`);
          } else {
            usedCorps[value] = caption;
          }
        }
      });
      
      // Server-side validation
      if (errors.length === 0) {
        const checkLineupValidity = httpsCallable(functions, 'checkLineupValidity');
        const validationResult = await checkLineupValidity({
          lineup: lineup,
          corpsClass: userClass
        });
        
        if (!validationResult.data.isValid) {
          errors.push(validationResult.data.error || 'Lineup validation failed');
        }
      }
      
      setValidationErrors(errors);
      return errors.length === 0;
      
    } catch (error) {
      console.error('Validation error:', error);
      errors.push('Failed to validate lineup');
      setValidationErrors(errors);
      return false;
    } finally {
      setIsValidating(false);
    }
  };

  // Save lineup
  const handleSaveLineup = async () => {
    // Validate first
    const isValid = await validateLineup();
    if (!isValid) {
      toast.error('Please fix validation errors before saving');
      return;
    }
    
    try {
      setIsSaving(true);
      
      const validateAndSaveLineup = httpsCallable(functions, 'validateAndSaveLineup');
      const result = await validateAndSaveLineup({
        lineup: lineup,
        corpsClass: userClass,
        seasonId: seasonId
      });
      
      if (result.data.success) {
        toast.success('Lineup saved successfully!');
        toast.success(`Points used: ${result.data.totalPoints} / ${pointLimit}`, { duration: 5000 });
      } else {
        toast.error(result.data.message || 'Failed to save lineup');
      }
    } catch (error) {
      console.error('Error saving lineup:', error);
      toast.error(error.message || 'Failed to save lineup');
    } finally {
      setIsSaving(false);
    }
  };

  // Get corps name by value
  const getCorpsName = (value) => {
    const corps = seasonCorps.find(c => c.value === parseInt(value));
    return corps ? corps.corpsName : '';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2">Loading available corps...</span>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Compact Header */}
      <div className="bg-surface dark:bg-surface-dark rounded-lg p-4 mb-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
              Caption Selection
            </h2>
            <p className="text-sm text-text-secondary dark:text-text-secondary-dark">
              {userClass} • Season {seasonId}
            </p>
          </div>
          
          <div className="text-right">
            <div className={`text-2xl font-bold ${
              totalPoints > pointLimit ? 'text-error' : 
              totalPoints === pointLimit ? 'text-warning' : 
              'text-success'
            }`}>
              {totalPoints} / {pointLimit}
            </div>
            <p className="text-xs text-text-secondary dark:text-text-secondary-dark">
              Points Used
            </p>
          </div>
        </div>
      </div>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="bg-error/10 border border-error rounded-lg p-3 mb-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-error flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-error mb-1">Validation Errors:</p>
              <ul className="text-sm text-error space-y-1">
                {validationErrors.map((error, idx) => (
                  <li key={idx}>• {error}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Main Selection Grid - Compact 2-column layout */}
      <div className="bg-surface dark:bg-surface-dark rounded-lg p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {CAPTIONS.map((caption) => {
            const selectedValue = lineup[caption.id] || '';
            const selectedCorps = seasonCorps.find(c => c.value === parseInt(selectedValue));
            
            return (
              <div key={caption.id} className="flex items-center gap-2">
                <label className="w-28 text-sm font-medium text-text-primary dark:text-text-primary-dark">
                  {caption.shortName}:
                </label>
                
                <select
                  value={selectedValue}
                  onChange={(e) => handleCaptionChange(caption.id, e.target.value)}
                  className="flex-1 px-3 py-1.5 rounded-md border border-accent dark:border-accent-dark 
                           bg-background dark:bg-background-dark text-text-primary dark:text-text-primary-dark
                           focus:ring-2 focus:ring-primary focus:border-transparent"
                  disabled={isSaving || seasonCorps.length === 0}
                >
                  <option value="">Select corps...</option>
                  {seasonCorps.map((corps) => (
                    <option key={`${caption.id}-${corps.value}`} value={corps.value}>
                      ({corps.value}) {corps.sourceYear ? `(${corps.sourceYear})` : ''} {corps.name}
                    </option>
                  ))}
                </select>
                
                {selectedCorps && (
                  <span className="text-xs font-bold text-primary dark:text-primary-dark w-10 text-right">
                    {selectedCorps.value}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary Section */}
      <div className="bg-surface dark:bg-surface-dark rounded-lg p-4 mb-4">
        <h3 className="font-bold text-text-primary dark:text-text-primary-dark mb-2">
          Lineup Summary
        </h3>
        <div className="grid grid-cols-4 gap-2 text-sm">
          {CAPTIONS.map((caption) => {
            const value = lineup[caption.id];
            const corpsName = getCorpsName(value);
            
            return (
              <div key={caption.id} className={`${!value ? 'opacity-50' : ''}`}>
                <span className="font-medium">{caption.shortName}:</span>
                <span className="ml-1">
                  {corpsName || 'Not selected'}
                  {value && ` (${value})`}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={validateLineup}
          disabled={isValidating || isSaving}
          className="flex-1 btn-secondary flex items-center justify-center gap-2"
        >
          <CheckCircle className="w-4 h-4" />
          {isValidating ? 'Validating...' : 'Validate Lineup'}
        </button>
        
        <button
          onClick={handleSaveLineup}
          disabled={isSaving || isValidating || totalPoints > pointLimit || 
                  Object.values(lineup).some(v => !v) || seasonCorps.length === 0}
          className="flex-1 btn-primary flex items-center justify-center gap-2 
                   disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="w-4 h-4" />
          {isSaving ? 'Saving...' : `Save Lineup (${totalPoints}/${pointLimit})`}
        </button>
      </div>
      
      {/* Info text */}
      <p className="text-xs text-text-secondary dark:text-text-secondary-dark text-center mt-2">
        All 8 captions must be filled • No duplicate corps • Stay within point limit
      </p>
    </div>
  );
};

export default LineupEditor;