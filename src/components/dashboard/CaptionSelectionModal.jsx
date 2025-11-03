import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCorpsData } from '../../hooks/useCorpsData';
import { saveLineup } from '../../firebase/functions';
import Modal from '../ui/Modal';
import Button from '../ui/Button';

// The 8 captions from your plan
const CAPTIONS = ["GE1", "GE2", "VP", "VA", "CG", "B", "MA", "P"];

const CaptionSelectionModal = ({ isOpen, onClose, currentLineup, corpsClass }) => {
  const { loggedInProfile } = useAuth();
  const { data: corpsData, isLoading: isLoadingData } = useCorpsData();
  const [lineup, setLineup] = useState(currentLineup);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  // Update local state if modal is re-opened
  useEffect(() => {
    if (isOpen) {
      setLineup(currentLineup);
    }
  }, [isOpen, currentLineup]);

  const handleSelect = (caption, value) => {
    setLineup(prev => ({ ...prev, [caption]: value }));
  };

  const handleSubmit = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await saveLineup({ lineup, corpsClass });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save lineup.');
    } finally {
      setIsSaving(false);
    }
  };

  // Task 2.6: Filter corps based on XP Tier Unlocks
  const userXP = loggedInProfile?.xp || 0;
  const getFilteredCorps = (caption) => {
    // This logic can be expanded based on your rules
    // For now, just a placeholder
    return corpsData.filter(corps => (corps.points || 0) <= userXP + 10); // Example rule
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="p-6">
        <h2 className="text-xl font-bold mb-4">Select Captions</h2>
        {isLoadingData ? (
          <div className="flex justify-center items-center h-48">
            <Loader2 className="animate-spin w-8 h-8" />
          </div>
        ) : (
          <div className="flex flex-col space-y-3">
            {CAPTIONS.map(caption => (
              <div key={caption}>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  {caption}
                </label>
                <select
                  value={lineup[caption] || ''}
                  onChange={(e) => handleSelect(caption, e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-surface border border-primary/20"
                >
                  <option value="">-- Select --</option>
                  {getFilteredCorps(caption).map(corps => (
                    <option key={corps.id} value={corps.id}>
                      {`${corps.sourceYear} ${corps.corpsName}`}
                      {/* Task 2.6: Display Dynamic Cost */}
                      {` (${corps.points} pts)`}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            
            {error && <p className="text-red-500 text-sm mt-2">{error}</p>}

            <div className="flex justify-end pt-4">
              <Button onClick={handleSubmit} variant="primary" disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Lineup'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default CaptionSelectionModal;