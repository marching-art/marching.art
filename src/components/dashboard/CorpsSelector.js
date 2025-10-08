import React, { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebaseConfig';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { Plus, Star, Trophy, Award, Music, ChevronDown } from 'lucide-react';

const CorpsSelector = ({ selectedCorpsId, onCorpsChange }) => {
  const { currentUser } = useAuth();
  const [corps, setCorps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    if (currentUser) {
      fetchUserCorps();
    }
  }, [currentUser]);

  const fetchUserCorps = async () => {
    try {
      const getUserCorps = httpsCallable(functions, 'getUserCorps');
      const result = await getUserCorps({});
      
      if (result.data.success) {
        setCorps(result.data.corps);
        
        // Auto-select first corps if none selected
        if (!selectedCorpsId && result.data.corps.length > 0) {
          onCorpsChange(result.data.corps[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching corps:', error);
      toast.error('Failed to load your corps');
    } finally {
      setLoading(false);
    }
  };

  const getClassIcon = (corpsClass) => {
    switch(corpsClass) {
      case 'World Class': return <Trophy className="w-5 h-5 text-purple-500" />;
      case 'Open Class': return <Award className="w-5 h-5 text-blue-500" />;
      case 'A Class': return <Star className="w-5 h-5 text-green-500" />;
      default: return <Music className="w-5 h-5 text-orange-500" />;
    }
  };

  const selectedCorps = corps.find(c => c.id === selectedCorpsId);

  if (loading) {
    return <div className="animate-pulse h-12 bg-accent dark:bg-accent-dark rounded-theme" />;
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="w-full bg-surface dark:bg-surface-dark border-2 border-accent dark:border-accent-dark rounded-theme p-3 flex items-center justify-between hover:border-primary dark:hover:border-primary-dark transition-colors"
      >
        {selectedCorps ? (
          <div className="flex items-center gap-3">
            {getClassIcon(selectedCorps.corpsClass)}
            <div className="text-left">
              <div className="font-bold text-text-primary dark:text-text-primary-dark">
                {selectedCorps.corpsName}
              </div>
              <div className="text-sm text-text-secondary dark:text-text-secondary-dark">
                {selectedCorps.corpsClass}
              </div>
            </div>
          </div>
        ) : (
          <span className="text-text-secondary dark:text-text-secondary-dark">Select a corps</span>
        )}
        <ChevronDown className={`w-5 h-5 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
      </button>

      {showDropdown && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setShowDropdown(false)}
          />
          <div className="absolute top-full left-0 right-0 mt-2 bg-surface dark:bg-surface-dark border-2 border-accent dark:border-accent-dark rounded-theme shadow-xl z-20 max-h-96 overflow-y-auto">
            {corps.map(c => (
              <button
                key={c.id}
                onClick={() => {
                  onCorpsChange(c.id);
                  setShowDropdown(false);
                }}
                className={`w-full p-3 flex items-center gap-3 hover:bg-accent dark:hover:bg-accent-dark transition-colors text-left ${
                  c.id === selectedCorpsId ? 'bg-primary dark:bg-primary-dark bg-opacity-10 dark:bg-opacity-20' : ''
                }`}
              >
                {getClassIcon(c.corpsClass)}
                <div className="flex-1">
                  <div className="font-bold text-text-primary dark:text-text-primary-dark">
                    {c.corpsName}
                  </div>
                  <div className="text-sm text-text-secondary dark:text-text-secondary-dark">
                    {c.corpsClass} • {c.stats?.totalShows || 0} shows
                  </div>
                </div>
                {c.stats?.bestScore > 0 && (
                  <div className="text-right">
                    <div className="text-sm font-bold text-primary dark:text-primary-dark">
                      {c.stats.bestScore.toFixed(3)}
                    </div>
                    <div className="text-xs text-text-secondary dark:text-text-secondary-dark">
                      Best Score
                    </div>
                  </div>
                )}
              </button>
            ))}
            
            <button
              onClick={() => {
                // TODO: Open create corps modal
                toast('Create new corps feature coming soon!');
                setShowDropdown(false);
              }}
              className="w-full p-3 flex items-center gap-3 border-t-2 border-accent dark:border-accent-dark hover:bg-accent dark:hover:bg-accent-dark transition-colors text-primary dark:text-primary-dark font-semibold"
            >
              <Plus className="w-5 h-5" />
              Create New Corps
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default CorpsSelector;