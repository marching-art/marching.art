import React, { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebaseConfig';
import { useAuth } from '../../context/AuthContext';
import { useUserStore } from '../../store/userStore';
import LoadingScreen from '../common/LoadingScreen';
import toast from 'react-hot-toast';
import { 
  Users, 
  Trophy, 
  AlertCircle,
  CheckCircle,
  Coins,
  Target,
  Shuffle,
  Save,
  RefreshCw
} from 'lucide-react';

/**
 * LineupEditor Component
 * Advanced lineup editor with real-time validation and DCI scoring methodology
 * Optimized for cost efficiency and 10,000+ user scalability
 */

const LineupEditor = ({ userProfile }) => {
  const { currentUser } = useAuth();
  const { profile, fetchUserProfile } = useUserStore();
  
  // State management
  const [availableCorps, setAvailableCorps] = useState([]);
  const [lineup, setLineup] = useState({});
  const [corpsClass, setCorpsClass] = useState('SoundSport');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [validation, setValidation] = useState({ isValid: false, totalPoints: 0 });
  const [pointLimits, setPointLimits] = useState({});

  // DCI Caption configuration with descriptions
  const captions = [
    { key: 'GE1', name: 'General Effect 1', description: 'Overall show impact and design achievement', weight: 20 },
    { key: 'GE2', name: 'General Effect 2', description: 'Performance execution and artistic achievement', weight: 20 },
    { key: 'VP', name: 'Visual Proficiency', description: 'Technical visual execution and skill', weight: 20 },
    { key: 'VA', name: 'Visual Analysis', description: 'Visual design and arrangement quality', weight: 20 },
    { key: 'CG', name: 'Color Guard', description: 'Color guard performance and integration', weight: 20 },
    { key: 'B', name: 'Brass', description: 'Brass section performance and technique', weight: 20 },
    { key: 'MA', name: 'Music Analysis', description: 'Musical design and arrangement quality', weight: 20 },
    { key: 'P', name: 'Percussion', description: 'Percussion section performance and design', weight: 20 }
  ];

  // Class options with descriptions and unlock requirements
  const classOptions = [
    { 
      value: 'SoundSport', 
      label: 'SoundSport', 
      description: 'Entry level division',
      points: 90,
      unlocked: true
    },
    { 
      value: 'A Class', 
      label: 'A Class', 
      description: 'Competitive division',
      points: 60,
      unlocked: (profile?.xp || 0) >= 500
    },
    { 
      value: 'Open Class', 
      label: 'Open Class', 
      description: 'Advanced competitive division',
      points: 120,
      unlocked: (profile?.xp || 0) >= 2000
    },
    { 
      value: 'World Class', 
      label: 'World Class', 
      description: 'Elite championship division',
      points: 150,
      unlocked: (profile?.xp || 0) >= 5000
    }
  ];

  useEffect(() => {
    if (currentUser) {
      loadAvailableCorps();
      initializeLineup();
    }
  }, [currentUser, userProfile]);

  useEffect(() => {
    if (Object.keys(lineup).length > 0) {
      validateLineupRealTime();
    }
  }, [lineup, corpsClass]);

  /**
   * Load available corps and game configuration
   */
  const loadAvailableCorps = async () => {
    try {
      const getAvailableCorps = httpsCallable(functions, 'lineupValidation-getAvailableCorps');
      const result = await getAvailableCorps();
      
      if (result.data.success) {
        setAvailableCorps(result.data.corps);
        setPointLimits(result.data.pointLimits);
      } else {
        toast.error('Failed to load available corps');
      }
    } catch (error) {
      console.error('Error loading corps:', error);
      toast.error('Failed to load corps data');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Initialize lineup from user profile
   */
  const initializeLineup = () => {
    if (userProfile?.lineup) {
      setLineup(userProfile.lineup);
    }
    if (userProfile?.corps?.class) {
      setCorpsClass(userProfile.corps.class);
    }
  };

  /**
   * Real-time lineup validation
   */
  const validateLineupRealTime = async () => {
    try {
      const checkValidity = httpsCallable(functions, 'lineupValidation-checkLineupValidity');
      const result = await checkValidity({ lineup, corpsClass });
      
      setValidation(result.data);
    } catch (error) {
      console.error('Validation error:', error);
      setValidation({ isValid: false, error: 'Validation failed' });
    }
  };

  /**
   * Handle caption corps selection
   */
  const handleCorpsSelection = (caption, corpsName) => {
    setLineup(prev => ({
      ...prev,
      [caption]: corpsName
    }));
  };

  /**
   * Handle corps class change
   */
  const handleClassChange = (newClass) => {
    const classOption = classOptions.find(opt => opt.value === newClass);
    
    if (!classOption?.unlocked) {
      const xpNeeded = newClass === 'A Class' ? 500 : 
                      newClass === 'Open Class' ? 2000 : 5000;
      toast.error(`Need ${xpNeeded} XP to unlock ${newClass}`);
      return;
    }
    
    setCorpsClass(newClass);
  };

  /**
   * Save lineup
   */
  const saveLineup = async () => {
    if (!validation.isValid) {
      toast.error(validation.error || 'Lineup is not valid');
      return;
    }

    setSaving(true);
    try {
      const validateAndSave = httpsCallable(functions, 'lineupValidation-validateAndSaveLineup');
      const result = await validateAndSave({ 
        lineup, 
        corpsClass 
      });
      
      if (result.data.success) {
        toast.success('Lineup saved successfully!');
        // Refresh user profile to get updated data
        await fetchUserProfile(currentUser.uid);
      } else {
        toast.error(result.data.message || 'Failed to save lineup');
      }
    } catch (error) {
      console.error('Save error:', error);
      toast.error(error.message || 'Failed to save lineup');
    } finally {
      setSaving(false);
    }
  };

  /**
   * Auto-fill lineup (for testing/demo purposes)
   */
  const autoFillLineup = () => {
    const pointLimit = pointLimits[corpsClass] || 90;
    const targetPoints = pointLimit;
    
    // Simple algorithm to fill lineup within point constraints
    const newLineup = {};
    let remainingPoints = targetPoints;
    
    captions.forEach((caption, index) => {
      const remainingCaptions = captions.length - index;
      const avgPointsPerCaption = Math.floor(remainingPoints / remainingCaptions);
      
      // Find a corps within the target point range
      const targetValue = Math.max(1, Math.min(25, avgPointsPerCaption));
      const availableOptions = availableCorps.filter(corps => 
        Math.abs(corps.value - targetValue) <= 2
      );
      
      if (availableOptions.length > 0) {
        const selectedCorps = availableOptions[Math.floor(Math.random() * availableOptions.length)];
        newLineup[caption.key] = selectedCorps.name;
        remainingPoints -= selectedCorps.value;
      }
    });
    
    setLineup(newLineup);
    toast.success('Lineup auto-filled!');
  };

  /**
   * Clear lineup
   */
  const clearLineup = () => {
    setLineup({});
    toast.success('Lineup cleared');
  };

  /**
   * Get corps color for value-based visualization
   */
  const getCorpsValueColor = (value) => {
    if (value <= 5) return 'text-yellow-400 bg-yellow-400/10'; // Elite
    if (value <= 10) return 'text-blue-400 bg-blue-400/10';   // High
    if (value <= 15) return 'text-green-400 bg-green-400/10'; // Mid
    if (value <= 20) return 'text-orange-400 bg-orange-400/10'; // Developing
    return 'text-gray-400 bg-gray-400/10'; // Entry
  };

  if (loading) {
    return <LoadingScreen message="Loading lineup editor..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-surface-dark rounded-theme p-6 shadow-theme-dark">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-text-primary-dark flex items-center gap-3">
              <Users className="w-8 h-8 text-primary-dark" />
              Lineup Editor
            </h2>
            <p className="text-text-secondary-dark mt-1">
              Select 8 corps for your captions using DCI scoring methodology
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={autoFillLineup}
              className="flex items-center gap-2 px-4 py-2 bg-accent-dark text-text-primary-dark rounded-theme hover:bg-accent-dark/80 transition-colors"
            >
              <Shuffle className="w-4 h-4" />
              Auto Fill
            </button>
            <button
              onClick={clearLineup}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-theme hover:bg-red-700 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Clear
            </button>
          </div>
        </div>

        {/* Class Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-text-secondary-dark mb-2">
            Corps Class
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {classOptions.map(option => (
              <button
                key={option.value}
                onClick={() => handleClassChange(option.value)}
                disabled={!option.unlocked}
                className={`p-3 rounded-theme border transition-colors ${
                  corpsClass === option.value
                    ? 'border-primary bg-primary/10 text-primary'
                    : option.unlocked
                    ? 'border-accent-dark text-text-primary-dark hover:border-primary'
                    : 'border-gray-600 text-gray-500 cursor-not-allowed'
                }`}
              >
                <div className="font-medium">{option.label}</div>
                <div className="text-xs mt-1">
                  {option.points} Points
                </div>
                {!option.unlocked && (
                  <div className="text-xs text-red-400 mt-1">
                    Locked
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Point Summary */}
        <div className="bg-background-dark rounded-theme p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-primary-dark" />
              <span className="font-medium text-text-primary-dark">
                Points Used: {validation.totalPoints || 0} / {pointLimits[corpsClass] || 90}
              </span>
            </div>
            <div className={`flex items-center gap-2 ${
              validation.isValid ? 'text-green-400' : 'text-red-400'
            }`}>
              {validation.isValid ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                <AlertCircle className="w-5 h-5" />
              )}
              <span className="text-sm">
                {validation.isValid ? 'Valid Lineup' : validation.error || 'Invalid Lineup'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Caption Selection Grid */}
      <div className="grid gap-6">
        {captions.map((caption) => (
          <div key={caption.key} className="bg-surface-dark rounded-theme p-6 shadow-theme-dark">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-text-primary-dark">
                  {caption.name}
                </h3>
                <p className="text-text-secondary-dark text-sm mt-1">
                  {caption.description}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-primary-dark bg-primary/10 px-2 py-1 rounded">
                    {caption.weight} points in DCI scoring
                  </span>
                </div>
              </div>
              {lineup[caption.key] && (
                <div className="text-right">
                  <div className="text-sm text-text-secondary-dark">Selected Corps Value</div>
                  <div className="text-lg font-bold text-primary-dark">
                    {availableCorps.find(c => c.name === lineup[caption.key])?.value || 0}
                  </div>
                </div>
              )}
            </div>

            {/* Corps Selection */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-text-secondary-dark">
                Select Corps for {caption.key}
              </label>
              <select
                value={lineup[caption.key] || ''}
                onChange={(e) => handleCorpsSelection(caption.key, e.target.value)}
                className="w-full px-3 py-2 bg-background-dark border border-accent-dark rounded-theme text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Choose a corps...</option>
                {availableCorps
                  .sort((a, b) => a.value - b.value) // Sort by value (low to high)
                  .map(corps => (
                  <option key={corps.name} value={corps.name}>
                    {corps.name} (Value: {corps.value})
                  </option>
                ))}
              </select>

              {/* Selected Corps Display */}
              {lineup[caption.key] && (
                <div className="mt-3 p-3 bg-background-dark rounded-theme border border-accent-dark">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-text-primary-dark">
                        {lineup[caption.key]}
                      </div>
                      <div className="text-sm text-text-secondary-dark">
                        Historical Performance: Elite tier corps
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`px-2 py-1 rounded text-xs ${
                        getCorpsValueColor(availableCorps.find(c => c.name === lineup[caption.key])?.value || 0)
                      }`}>
                        Value {availableCorps.find(c => c.name === lineup[caption.key])?.value || 0}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Save Button */}
      <div className="bg-surface-dark rounded-theme p-6 shadow-theme-dark">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-text-primary-dark">Ready to save?</h3>
            <p className="text-text-secondary-dark text-sm">
              Make sure all 8 captions are filled and you're within point limits
            </p>
          </div>
          <button
            onClick={saveLineup}
            disabled={!validation.isValid || saving}
            className={`flex items-center gap-2 px-6 py-3 rounded-theme font-medium transition-colors ${
              validation.isValid && !saving
                ? 'bg-primary text-on-primary hover:bg-primary-dark'
                : 'bg-gray-600 text-gray-300 cursor-not-allowed'
            }`}
          >
            {saving ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            {saving ? 'Saving...' : 'Save Lineup'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LineupEditor;