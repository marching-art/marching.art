// ShowRegistrationModal - Modal for registering corps at shows
import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Calendar, MapPin, AlertCircle, Check, X } from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase';
import toast from 'react-hot-toast';
import Portal from '../Portal';

// Class display names
const CLASS_DISPLAY_NAMES = {
  worldClass: 'World Class',
  openClass: 'Open Class',
  aClass: 'A Class',
  soundSport: 'SoundSport'
};

// Sort order for corps classes
const CLASS_ORDER = { worldClass: 0, openClass: 1, aClass: 2, soundSport: 3 };

const ShowRegistrationModal = ({ show, userProfile, formattedDate, onClose, onSuccess }) => {
  const [selectedCorps, setSelectedCorps] = useState([]);
  const [saving, setSaving] = useState(false);

  // Get sorted corps classes (memoized to prevent useEffect from running on every render)
  const userCorpsClasses = useMemo(() =>
    userProfile?.corps
      ? Object.keys(userProfile.corps).sort((a, b) => (CLASS_ORDER[a] ?? 99) - (CLASS_ORDER[b] ?? 99))
      : []
  , [userProfile?.corps]);

  // Check which corps are already registered
  useEffect(() => {
    const alreadyRegistered = [];
    userCorpsClasses.forEach(corpsClass => {
      const corpsData = userProfile.corps[corpsClass];
      const weekKey = `week${show.week}`;
      const selectedShows = corpsData.selectedShows?.[weekKey] || [];

      const isRegistered = selectedShows.some(
        s => s.eventName === show.eventName && s.date === show.date
      );

      if (isRegistered) {
        alreadyRegistered.push(corpsClass);
      }
    });
    setSelectedCorps(alreadyRegistered);
  }, [show, userProfile, userCorpsClasses]);

  const toggleCorps = (corpsClass) => {
    if (selectedCorps.includes(corpsClass)) {
      setSelectedCorps(selectedCorps.filter(c => c !== corpsClass));
    } else {
      // Check if this corps already has 4 shows this week
      const corpsData = userProfile.corps[corpsClass];
      const weekKey = `week${show.week}`;
      const currentShows = corpsData.selectedShows?.[weekKey] || [];

      if (currentShows.length >= 4 && !selectedCorps.includes(corpsClass)) {
        toast.error(`This corps already has 4 shows registered for week ${show.week}`);
        return;
      }

      setSelectedCorps([...selectedCorps, corpsClass]);
    }
  };

  const handleSave = async () => {
    setSaving(true);

    try {
      const selectUserShows = httpsCallable(functions, 'selectUserShows');

      // For each corps class, update their show selection
      for (const corpsClass of userCorpsClasses) {
        const corpsData = userProfile.corps[corpsClass];
        const weekKey = `week${show.week}`;
        const currentShows = corpsData.selectedShows?.[weekKey] || [];

        // Remove this show from the list if it exists
        const filteredShows = currentShows.filter(
          s => !(s.eventName === show.eventName && s.date === show.date)
        );

        // Add it back if selected
        const newShows = selectedCorps.includes(corpsClass)
          ? [...filteredShows, {
              eventName: show.eventName,
              date: show.date,
              location: show.location,
              day: show.day
            }]
          : filteredShows;

        await selectUserShows({
          week: show.week,
          shows: newShows,
          corpsClass
        });
      }

      toast.success('Registration updated successfully!');
      onSuccess();
    } catch (error) {
      console.error('Error updating registration:', error);
      toast.error(error.message || 'Failed to update registration');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Portal>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="glass-dark rounded-2xl p-8 max-w-2xl w-full"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <h2 className="text-2xl font-display font-bold text-gradient mb-2">
            Register Corps for Show
          </h2>
          <p className="text-cream-400 mb-6">
            {show.eventName}
          </p>

          {/* Show Details */}
          <div className="card bg-charcoal-900/50 mb-6">
            <div className="flex flex-wrap gap-3 text-sm text-cream-300">
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4 text-gold-500" />
                <span>{formattedDate}</span>
              </div>
              {show.location && (
                <div className="flex items-center gap-1">
                  <MapPin className="w-4 h-4 text-blue-500" />
                  <span>{show.location}</span>
                </div>
              )}
            </div>
          </div>

          {/* Corps Selection */}
          {userCorpsClasses.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 text-cream-500/40 mx-auto mb-3" />
              <p className="text-cream-300">You don't have any corps yet.</p>
              <p className="text-cream-500/60 text-sm mt-2">Register a corps from the Dashboard first.</p>
            </div>
          ) : (
            <div className="space-y-3 mb-6">
              <h3 className="text-sm font-semibold text-cream-100 mb-3">
                Select which of your corps will attend:
              </h3>
              {userCorpsClasses.map(corpsClass => {
                const corpsData = userProfile.corps[corpsClass];
                const isSelected = selectedCorps.includes(corpsClass);
                const weekKey = `week${show.week}`;
                const currentShows = corpsData.selectedShows?.[weekKey] || [];

                return (
                  <div
                    key={corpsClass}
                    onClick={() => toggleCorps(corpsClass)}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      isSelected
                        ? 'border-gold-500 bg-gold-500/10'
                        : 'border-cream-500/10 bg-charcoal-900/30 hover:border-cream-500/30'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-cream-100">
                          {corpsData.corpsName || corpsData.name || 'Unnamed Corps'}
                        </p>
                        <p className="text-sm text-cream-500/80">
                          {CLASS_DISPLAY_NAMES[corpsClass] || corpsClass}
                          {' • '}
                          {currentShows.length}/4 shows this week
                        </p>
                      </div>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                        isSelected
                          ? 'border-gold-500 bg-gold-500'
                          : 'border-cream-500/30'
                      }`}>
                        {isSelected && <Check className="w-4 h-4 text-charcoal-900" />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="btn-ghost flex-1"
              disabled={saving}
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="btn-primary flex-1"
              disabled={saving || userCorpsClasses.length === 0}
            >
              {saving ? (
                <>
                  <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="w-5 h-5 mr-2" />
                  Save Registration
                </>
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </Portal>
  );
};

export default ShowRegistrationModal;
