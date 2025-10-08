import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useUserStore } from '../../store/userStore';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebaseConfig';
import toast from 'react-hot-toast';
import {
  Plus,
  Edit,
  Trash2,
  Star,
  Award,
  Coins,
  Lock,
  Check,
  X,
  Loader2,
  Music,
  Trophy,
  Target
} from 'lucide-react';

const CLASS_INFO = {
  'SoundSport': {
    icon: Music,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500',
    xpRequired: 0,
    pointLimit: 90,
    description: 'Entry-level competition - perfect for beginners!'
  },
  'A Class': {
    icon: Award,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500',
    xpRequired: 500,
    pointLimit: 60,
    description: 'Intermediate competition - hone your skills'
  },
  'Open Class': {
    icon: Trophy,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500',
    xpRequired: 2000,
    pointLimit: 120,
    description: 'Advanced competition - elite performance'
  },
  'World Class': {
    icon: Star,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500',
    xpRequired: 5000,
    pointLimit: 150,
    description: 'The pinnacle of drum corps excellence'
  }
};

const CorpsManager = () => {
  const { currentUser } = useAuth();
  const { profile, corpsList, activeCorpsId, setActiveCorps, fetchUserProfile, addCorps, removeCorps } = useUserStore();
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedClass, setSelectedClass] = useState('SoundSport');
  const [corpsName, setCorpsName] = useState('');
  const [alias, setAlias] = useState('');
  const [location, setLocation] = useState('');

  const currentXP = profile?.xp || 0;
  const unlockedClasses = profile?.unlockedClasses || ['SoundSport'];
  
  // Check how many corps per class
  const corpsCountByClass = corpsList.reduce((acc, corps) => {
    acc[corps.corpsClass] = (acc[corps.corpsClass] || 0) + 1;
    return acc;
  }, {});

  const canCreateMore = corpsList.length < 4;
  const allClassesUnlocked = unlockedClasses.length === 4;

  const handleCreateCorps = async () => {
    if (!corpsName.trim()) {
      toast.error('Please enter a corps name');
      return;
    }

    if (!unlockedClasses.includes(selectedClass)) {
      toast.error(`${selectedClass} is not unlocked yet`);
      return;
    }

    // Check if user already has a corps in this class
    if (corpsCountByClass[selectedClass] >= 1) {
      toast.error(`You already have a ${selectedClass} corps. You can only have one corps per class.`);
      return;
    }

    setIsCreating(true);

    try {
      const createCorpsFunction = httpsCallable(functions, 'createCorps');
      const result = await createCorpsFunction({
        corpsName: corpsName.trim(),
        corpsClass: selectedClass,
        alias: alias.trim() || 'Director',
        location: location.trim() || ''
      });

      if (result.data.success) {
        toast.success(result.data.message);
        await fetchUserProfile(currentUser.uid); // Refresh to get new corps
        setShowCreateModal(false);
        setCorpsName('');
        setAlias('');
        setLocation('');
      } else {
        toast.error(result.data.message || 'Failed to create corps');
      }
    } catch (error) {
      console.error('Error creating corps:', error);
      toast.error(error.message || 'Failed to create corps');
    } finally {
      setIsCreating(false);
    }
  };

  const handleRetireCorps = async (selectedCorps) => {  // Make sure parameter is here
    if (!window.confirm(`Are you sure you want to retire ${selectedCorps.corpsName}?`)) {
        return;
    }

    try {
        const retireCorpsFunction = httpsCallable(functions, 'retireCorps');
        const result = await retireCorpsFunction({
        corpsId: selectedCorps.id
        });

        if (result.data.success) {
        toast.success(result.data.message);
        await fetchUserProfile(currentUser.uid);
        } else {
        toast.error(result.data.message || 'Failed to retire corps');
        }
    } catch (error) {
        console.error('Error retiring corps:', error);
        toast.error(error.message || 'Failed to retire corps');
    }
  };

  const ClassUnlockCard = ({ className, info }) => {
    const isUnlocked = unlockedClasses.includes(className);
    const hasCorps = corpsCountByClass[className] >= 1;
    const xpNeeded = Math.max(0, info.xpRequired - currentXP);
    const Icon = info.icon;

    return (
      <div className={`p-4 rounded-theme border-2 ${info.borderColor} ${info.bgColor} relative`}>
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <Icon className={`w-6 h-6 ${info.color}`} />
            <h3 className="font-bold text-text-primary dark:text-text-primary-dark">{className}</h3>
          </div>
          {isUnlocked ? (
            <Check className="w-5 h-5 text-green-500" />
          ) : (
            <Lock className="w-5 h-5 text-text-secondary dark:text-text-secondary-dark" />
          )}
        </div>
        
        <p className="text-sm text-text-secondary dark:text-text-secondary-dark mb-2">
          {info.description}
        </p>
        
        <div className="text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-text-secondary dark:text-text-secondary-dark">Point Limit:</span>
            <span className="font-semibold">{info.pointLimit}</span>
          </div>
          
          {!isUnlocked && (
            <div className="flex justify-between items-center mt-2">
              <span className="text-text-secondary dark:text-text-secondary-dark">Unlock at:</span>
              <span className="font-semibold text-primary dark:text-primary-dark">
                {info.xpRequired} XP ({xpNeeded} needed)
              </span>
            </div>
          )}
          
          {hasCorps && (
            <div className="mt-2 px-2 py-1 bg-green-500/20 border border-green-500 rounded text-green-500 text-center font-semibold">
              Corps Active
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
            Corps Management
          </h2>
          <p className="text-text-secondary dark:text-text-secondary-dark">
            {corpsList.length}/4 Corps Active
            {!allClassesUnlocked && ' • Unlock more classes to create more corps'}
          </p>
        </div>
        
        {canCreateMore && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-primary dark:bg-primary-dark hover:bg-primary-dark dark:hover:bg-primary text-white px-6 py-3 rounded-theme font-semibold flex items-center gap-2 transition-all shadow-lg hover:shadow-xl"
          >
            <Plus className="w-5 h-5" />
            Create Corps
          </button>
        )}
      </div>

      {/* Class Unlock Status Grid */}
      <div>
        <h3 className="text-lg font-semibold text-text-primary dark:text-text-primary-dark mb-3">
          Class Unlock Status
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(CLASS_INFO).map(([className, info]) => (
            <ClassUnlockCard key={className} className={className} info={info} />
          ))}
        </div>
      </div>

      {/* Active Corps List */}
      {corpsList.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-text-primary dark:text-text-primary-dark mb-3">
            Your Corps
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {corpsList.map((corps) => {
                const classInfo = CLASS_INFO[corps.corpsClass];
                const Icon = classInfo.icon;
                const isActive = corps.id === activeCorpsId;

                return (
                    <div
                    key={corps.id}
                    className={`p-4 rounded-theme border-2 transition-all cursor-pointer ${
                        isActive
                        ? `${classInfo.borderColor} ${classInfo.bgColor} shadow-lg`
                        : 'border-accent dark:border-accent-dark hover:border-primary dark:hover:border-primary-dark'
                    }`}
                    onClick={() => setActiveCorps(corps.id)}
                    >
                    <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                        <Icon className={`w-6 h-6 ${classInfo.color}`} />
                        <div>
                            <h4 className="font-bold text-text-primary dark:text-text-primary-dark">
                            {corps.corpsName}
                            </h4>
                            <p className="text-sm text-text-secondary dark:text-text-secondary-dark">
                            {corps.corpsClass}
                            </p>
                        </div>
                        </div>
                        
                        <button
                        onClick={(e) => {
                            e.stopPropagation(); // ADD THIS LINE
                            handleRetireCorps(corps);
                        }}
                        className="px-3 py-2 bg-error hover:bg-error-dark text-white rounded-theme text-sm font-semibold transition-colors"
                        >
                        Retire Corps
                        </button>
                    </div>

                    {corps.alias && (
                        <p className="text-sm text-text-secondary dark:text-text-secondary-dark mb-2">
                        <span className="font-semibold">Director:</span> {corps.alias}
                        </p>
                    )}

                    {corps.location && (
                        <p className="text-sm text-text-secondary dark:text-text-secondary-dark mb-2">
                        <span className="font-semibold">Location:</span> {corps.location}
                        </p>
                    )}

                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-accent dark:border-accent-dark">
                        <span className="text-xs text-text-secondary dark:text-text-secondary-dark">
                        {corps.stats?.totalShows || 0} Shows
                        </span>
                        {corps.stats?.bestScore > 0 && (
                        <span className="text-sm font-bold text-primary dark:text-primary-dark">
                            Best: {corps.stats.bestScore.toFixed(3)}
                        </span>
                        )}
                    </div>

                    {isActive && (
                        <div className="mt-2 px-2 py-1 bg-primary/20 border border-primary dark:border-primary-dark rounded text-primary dark:text-primary-dark text-center text-xs font-semibold">
                        Currently Active
                        </div>
                    )}
                    </div>
                );
                })}
          </div>
        </div>
      )}

      {corpsList.length === 0 && (
        <div className="text-center py-12 bg-surface dark:bg-surface-dark rounded-theme border-2 border-dashed border-accent dark:border-accent-dark">
          <Target className="w-16 h-16 mx-auto text-text-secondary dark:text-text-secondary-dark mb-4" />
          <h3 className="text-xl font-semibold text-text-primary dark:text-text-primary-dark mb-2">
            No Corps Yet
          </h3>
          <p className="text-text-secondary dark:text-text-secondary-dark mb-4">
            Create your first corps to start competing!
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-primary dark:bg-primary-dark hover:bg-primary-dark dark:hover:bg-primary text-white px-6 py-3 rounded-theme font-semibold inline-flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Create Your First Corps
          </button>
        </div>
      )}

      {/* Create Corps Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-surface dark:bg-surface-dark rounded-theme p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
                Create New Corps
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Class Selection */}
              <div>
                <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                  Corps Class <span className="text-error">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(CLASS_INFO).map(([className, info]) => {
                    const isUnlocked = unlockedClasses.includes(className);
                    const hasCorps = corpsCountByClass[className] >= 1;
                    const Icon = info.icon;

                    return (
                      <button
                        key={className}
                        onClick={() => isUnlocked && !hasCorps && setSelectedClass(className)}
                        disabled={!isUnlocked || hasCorps}
                        className={`p-3 rounded-theme border-2 transition-all ${
                          selectedClass === className
                            ? `${info.borderColor} ${info.bgColor}`
                            : 'border-accent dark:border-accent-dark'
                        } ${
                          !isUnlocked || hasCorps
                            ? 'opacity-50 cursor-not-allowed'
                            : 'hover:border-primary dark:hover:border-primary-dark cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Icon className={`w-5 h-5 ${info.color}`} />
                          <span className="font-semibold text-sm">{className}</span>
                        </div>
                        <div className="text-xs text-text-secondary dark:text-text-secondary-dark">
                          {!isUnlocked && 'Locked'}
                          {isUnlocked && hasCorps && 'Already Created'}
                          {isUnlocked && !hasCorps && `${info.pointLimit} pts`}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Corps Name */}
              <div>
                <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                  Corps Name <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  value={corpsName}
                  onChange={(e) => setCorpsName(e.target.value)}
                  placeholder="e.g., Thunder Regiment, Blue Knights Elite"
                  className="w-full p-3 bg-background dark:bg-background-dark border border-accent dark:border-accent-dark rounded-theme focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary-dark text-text-primary dark:text-text-primary-dark"
                  maxLength="50"
                  disabled={isCreating}
                />
                <p className="text-xs text-text-secondary dark:text-text-secondary-dark mt-1 text-right">
                  {corpsName.length}/50
                </p>
              </div>

              {/* Director Alias */}
              <div>
                <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                  Director Alias
                </label>
                <input
                  type="text"
                  value={alias}
                  onChange={(e) => setAlias(e.target.value)}
                  placeholder="Director, Conductor, Captain..."
                  className="w-full p-3 bg-background dark:bg-background-dark border border-accent dark:border-accent-dark rounded-theme focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary-dark text-text-primary dark:text-text-primary-dark"
                  maxLength="20"
                  disabled={isCreating}
                />
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                  Location
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="City, State"
                  className="w-full p-3 bg-background dark:bg-background-dark border border-accent dark:border-accent-dark rounded-theme focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary-dark text-text-primary dark:text-text-primary-dark"
                  maxLength="50"
                  disabled={isCreating}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowCreateModal(false)}
                  disabled={isCreating}
                  className="flex-1 px-4 py-3 border border-accent dark:border-accent-dark rounded-theme text-text-primary dark:text-text-primary-dark hover:bg-accent dark:hover:bg-accent-dark transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateCorps}
                  disabled={isCreating || !corpsName.trim()}
                  className="flex-1 px-4 py-3 bg-primary dark:bg-primary-dark hover:bg-primary-dark dark:hover:bg-primary text-white rounded-theme font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Check className="w-5 h-5" />
                      Create Corps
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CorpsManager;