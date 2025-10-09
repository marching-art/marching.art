import React, { useState, useEffect } from 'react';
import { db, functions } from '../../firebaseConfig';
import { httpsCallable } from 'firebase/functions';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import LoadingScreen from '../common/LoadingScreen';
import { 
  Save, 
  RotateCcw, 
  Info, 
  Shield,
  AlertCircle,
  CheckCircle2,
  Target,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

const REQUIRED_CAPTIONS = [
  { short: "GE1", full: "General Effect 1" },
  { short: "GE2", full: "General Effect 2" },
  { short: "VP", full: "Visual Proficiency" },
  { short: "VA", full: "Visual Analysis" },
  { short: "CG", full: "Color Guard" },
  { short: "B", full: "Brass" },
  { short: "MA", full: "Music Analysis" },
  { short: "P", full: "Percussion" }
];

const CLASS_POINT_LIMITS = {
  "SoundSport": 90,
  "A Class": 60,
  "Open Class": 120,
  "World Class": 150,
};

const LineupEditor = ({ userProfile, activeCorps }) => {
  const { currentUser } = useAuth();
  
  const [lineup, setLineup] = useState({});
  const [originalLineup, setOriginalLineup] = useState({});
  const [availableCorps, setAvailableCorps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [seasonId, setSeasonId] = useState(null);
  const [expandedCaption, setExpandedCaption] = useState(null);
  const [validation, setValidation] = useState({
    valid: false,
    errors: [],
    totalPoints: 0,
    pointLimit: 0,
    pointsRemaining: 0
  });

  const corpsClass = activeCorps?.corpsClass;
  const pointLimit = CLASS_POINT_LIMITS[corpsClass] || 90;

  useEffect(() => {
    if (activeCorps && currentUser) {
      fetchLineupData();
    }
  }, [activeCorps?.id, currentUser]);

  useEffect(() => {
    if (Object.keys(lineup).length > 0 && availableCorps.length > 0) {
      validateLineupLocally();
    }
  }, [lineup, availableCorps]);

  const fetchLineupData = async () => {
    setLoading(true);
    
    try {
      const gameSettingsRef = doc(db, 'game-settings/current');
      const gameSettingsSnap = await getDoc(gameSettingsRef);
      
      if (!gameSettingsSnap.exists()) {
        toast.error('Season data not available.');
        setLoading(false);
        return;
      }

      const currentSeasonId = gameSettingsSnap.data().activeSeasonId || 
                              gameSettingsSnap.data().currentSeasonId || 
                              '2025';
      setSeasonId(currentSeasonId);

      const dciDataRef = doc(db, `dci-data/${currentSeasonId}`);
      const dciDataSnap = await getDoc(dciDataRef);

      if (dciDataSnap.exists()) {
        const dciData = dciDataSnap.data();
        // Handle both 'corps' (new) and 'corpsValues' (legacy) field names
        const corpsArray = dciData.corps || dciData.corpsValues || [];
        
        // Transform to expected format with id for dropdown
        const formattedCorps = corpsArray.map(corps => ({
          id: corps.name || corps.corpsName,
          name: corps.name || corps.corpsName,
          value: corps.value || corps.pointCost || 0,
          rank: corps.rank || 0,
          sourceYear: corps.sourceYear || 'unknown'
        }));
        
        setAvailableCorps(formattedCorps);
        console.log(`Loaded ${formattedCorps.length} corps for season ${currentSeasonId}`);
      } else {
        toast.error('No corps data available for current season');
        setAvailableCorps([]);
      }

      const lineupRef = doc(db, `activeLineups/${currentSeasonId}/${currentUser.uid}/${activeCorps.id}`);
      const lineupSnap = await getDoc(lineupRef);

      if (lineupSnap.exists()) {
        const lineupData = lineupSnap.data().lineup || {};
        setLineup(lineupData);
        setOriginalLineup(lineupData);
      } else {
        const emptyLineup = {};
        REQUIRED_CAPTIONS.forEach(caption => {
          emptyLineup[caption.full] = null;
        });
        setLineup(emptyLineup);
        setOriginalLineup(emptyLineup);
      }

    } catch (error) {
      console.error('Error fetching lineup data:', error);
      toast.error('Failed to load lineup data');
    } finally {
      setLoading(false);
    }
  };

  const validateLineupLocally = () => {
    const errors = [];
    let totalPoints = 0;

    const missingCaptions = REQUIRED_CAPTIONS.filter(caption => !lineup[caption.full]);
    if (missingCaptions.length > 0) {
      errors.push(`Missing ${missingCaptions.length} caption(s)`);
    }

    Object.values(lineup).forEach(corpsName => {
      if (corpsName) {
        const selectedCorps = availableCorps.find(c => c.name === corpsName || c.id === corpsName);
        if (selectedCorps) {
          totalPoints += selectedCorps.value;
        }
      }
    });

    if (totalPoints > pointLimit) {
      errors.push(`${totalPoints - pointLimit} points over limit`);
    }

    const pointsRemaining = pointLimit - totalPoints;

    setValidation({
      valid: errors.length === 0 && missingCaptions.length === 0,
      errors,
      totalPoints,
      pointLimit,
      pointsRemaining
    });
  };

  const handleCorpsChange = (caption, corpsId) => {
    setLineup(prev => ({
      ...prev,
      [caption]: corpsId
    }));
  };

  const handleSaveLineup = async () => {
    if (!validation.valid) {
      toast.error('Please fix validation errors before saving');
      return;
    }

    setSaving(true);

    try {
      const lineupRef = doc(db, `activeLineups/${seasonId}/${currentUser.uid}/${activeCorps.id}`);
      
      await setDoc(lineupRef, {
        userId: currentUser.uid,
        corpsId: activeCorps.id,
        corpsName: activeCorps.corpsName,
        corpsClass: activeCorps.corpsClass,
        seasonId: seasonId,
        lineup: lineup,
        totalPoints: validation.totalPoints,
        lastUpdated: new Date(),
        updatedAt: new Date()
      });

      setOriginalLineup(lineup);
      toast.success('Lineup saved successfully! (+10 XP)');

      const awardXPFunction = httpsCallable(functions, 'awardXP');
      await awardXPFunction({
        amount: 10,
        reason: 'Lineup saved',
        seasonId: seasonId
      });

    } catch (error) {
      console.error('Error saving lineup:', error);
      toast.error('Failed to save lineup');
    } finally {
      setSaving(false);
    }
  };

  const handleResetLineup = () => {
    if (window.confirm('Reset lineup to last saved version?')) {
      setLineup(originalLineup);
      toast.success('Lineup reset');
    }
  };

  if (!activeCorps) {
    return (
      <div className="text-center py-12">
        <Target className="w-16 h-16 mx-auto text-text-secondary dark:text-text-secondary-dark mb-4" />
        <h3 className="text-xl font-semibold text-text-primary dark:text-text-primary-dark mb-2">
          No Corps Selected
        </h3>
        <p className="text-text-secondary dark:text-text-secondary-dark">
          Please create or select a corps to manage captions.
        </p>
      </div>
    );
  }

  if (loading) {
    return <LoadingScreen fullScreen={false} />;
  }

  const hasChanges = JSON.stringify(lineup) !== JSON.stringify(originalLineup);

  return (
    <div className="space-y-4">
      {/* Compact Header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-text-primary dark:text-text-primary-dark">
              Caption Selection
            </h2>
            <p className="text-sm text-text-secondary dark:text-text-secondary-dark">
              {activeCorps.corpsName}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleResetLineup}
              disabled={!hasChanges || saving}
              className="p-2 border border-accent dark:border-accent-dark rounded-theme hover:bg-accent dark:hover:bg-accent-dark transition-colors disabled:opacity-50"
              title="Reset"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
            <button
              onClick={handleSaveLineup}
              disabled={!validation.valid || !hasChanges || saving}
              className="px-4 py-2 bg-primary dark:bg-primary-dark hover:bg-primary-dark dark:hover:bg-primary text-white rounded-theme font-semibold transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <img 
                    src="/favicon-32x32.png" 
                    alt="Saving" 
                    className="w-4 h-4 animate-spin"
                    style={{ animationDuration: '1s' }}
                  />
                  Saving
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save
                </>
              )}
            </button>
          </div>
        </div>

        {/* Compact Validation */}
        <div className={`p-3 rounded-theme border-2 ${
          validation.valid 
            ? 'border-green-500 bg-green-500/10' 
            : 'border-yellow-500 bg-yellow-500/10'
        }`}>
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              {validation.valid ? (
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              ) : (
                <AlertCircle className="w-5 h-5 text-yellow-500" />
              )}
              <span className="font-semibold">
                {validation.valid ? 'Valid' : validation.errors.join(' • ')}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-text-secondary dark:text-text-secondary-dark">
                <span className="font-bold text-text-primary dark:text-text-primary-dark">
                  {validation.totalPoints}
                </span>/{validation.pointLimit}
              </span>
              <span className={`font-bold ${
                validation.pointsRemaining >= 0 ? 'text-green-500' : 'text-error'
              }`}>
                {validation.pointsRemaining >= 0 ? `${validation.pointsRemaining} left` : `${Math.abs(validation.pointsRemaining)} over!`}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Compact Caption List */}
      <div className="space-y-2">
        {REQUIRED_CAPTIONS.map(caption => {
          const selectedCorpsId = lineup[caption.full];
          const selectedCorps = availableCorps.find(c => c.id === selectedCorpsId);
          const isExpanded = expandedCaption === caption.short;

          return (
            <div 
              key={caption.short}
              className="bg-surface dark:bg-surface-dark rounded-theme border border-accent dark:border-accent-dark overflow-hidden"
            >
              {/* Caption Header - Always Visible */}
              <button
                onClick={() => setExpandedCaption(isExpanded ? null : caption.short)}
                className="w-full p-3 flex items-center justify-between hover:bg-accent dark:hover:bg-accent-dark transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <Shield className="w-5 h-5 text-primary dark:text-primary-dark flex-shrink-0" />
                  <div className="text-left min-w-0 flex-1">
                    <div className="font-bold text-text-primary dark:text-text-primary-dark">
                      {caption.short}
                    </div>
                    {selectedCorps && (
                      <div className="text-sm text-text-secondary dark:text-text-secondary-dark truncate">
                        {selectedCorps.name} ({selectedCorps.value}pts)
                      </div>
                    )}
                    {!selectedCorps && (
                      <div className="text-sm text-error">Not selected</div>
                    )}
                  </div>
                </div>
                {isExpanded ? (
                  <ChevronUp className="w-5 h-5 text-text-secondary dark:text-text-secondary-dark flex-shrink-0" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-text-secondary dark:text-text-secondary-dark flex-shrink-0" />
                )}
              </button>

              {/* Dropdown - Shown when expanded */}
              {isExpanded && (
                <div className="border-t border-accent dark:border-accent-dark p-3 bg-background dark:bg-background-dark">
                  <select
                    value={selectedCorpsId || ''}
                    onChange={(e) => {
                      handleCorpsChange(caption.full, e.target.value);
                      setExpandedCaption(null);
                    }}
                    className="w-full p-3 bg-surface dark:bg-surface-dark border border-accent dark:border-accent-dark rounded-theme text-text-primary dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary-dark"
                  >
                    <option value="">Select Corps...</option>
                    {availableCorps.map(corps => (
                      <option key={corps.id} value={corps.name}>
                        {corps.name} ({corps.value} pts)
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Info Box */}
      <div className="bg-primary/5 dark:bg-primary-dark/5 border border-primary dark:border-primary-dark rounded-theme p-3">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-primary dark:text-primary-dark flex-shrink-0 mt-0.5" />
          <p className="text-xs text-text-secondary dark:text-text-secondary-dark">
            Tap each caption to select a DCI corps. Stay within your {pointLimit}-point budget for {corpsClass}.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LineupEditor;