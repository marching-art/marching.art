// ShowRegistrationModal - Streamlined modal for registering corps at shows
import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Calendar, MapPin, Check, X, AlertTriangle, Users } from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase';
import toast from 'react-hot-toast';
import Portal from '../Portal';

// Class display names and colors
const CLASS_CONFIG = {
  worldClass: { name: 'World Class', color: 'gold' },
  openClass: { name: 'Open Class', color: 'purple' },
  aClass: { name: 'A Class', color: 'blue' },
  soundSport: { name: 'SoundSport', color: 'green' }
};

const CLASS_ORDER = { worldClass: 0, openClass: 1, aClass: 2, soundSport: 3 };

const ShowRegistrationModal = ({ show, userProfile, formattedDate, onClose, onSuccess }) => {
  const [selectedCorps, setSelectedCorps] = useState([]);
  const [saving, setSaving] = useState(false);

  // Get sorted corps classes
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

      // Only check if adding (not if already selected)
      const isAlreadyAtShow = currentShows.some(
        s => s.eventName === show.eventName && s.date === show.date
      );

      if (currentShows.length >= 4 && !isAlreadyAtShow) {
        toast.error(`This corps already has 4 shows registered for week ${show.week}`);
        return;
      }

      setSelectedCorps([...selectedCorps, corpsClass]);
    }
  };

  // Select all corps
  const selectAll = () => {
    const canSelect = userCorpsClasses.filter(corpsClass => {
      const corpsData = userProfile.corps[corpsClass];
      const weekKey = `week${show.week}`;
      const currentShows = corpsData.selectedShows?.[weekKey] || [];
      const isAlreadyAtShow = currentShows.some(
        s => s.eventName === show.eventName && s.date === show.date
      );
      return currentShows.length < 4 || isAlreadyAtShow || selectedCorps.includes(corpsClass);
    });
    setSelectedCorps(canSelect);
  };

  // Clear all selections
  const clearAll = () => {
    setSelectedCorps([]);
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

      toast.success('Registration updated!');
      onSuccess();
    } catch (error) {
      console.error('Error updating registration:', error);
      toast.error(error.message || 'Failed to update registration');
    } finally {
      setSaving(false);
    }
  };

  const getClassColor = (colorName) => {
    const colors = {
      gold: 'border-gold-500/50 bg-gold-500/20 text-gold-400',
      purple: 'border-purple-500/50 bg-purple-500/20 text-purple-400',
      blue: 'border-blue-500/50 bg-blue-500/20 text-blue-400',
      green: 'border-green-500/50 bg-green-500/20 text-green-400'
    };
    return colors[colorName] || colors.gold;
  };

  return (
    <Portal>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-charcoal-900 border border-white/10 rounded-xl w-full max-w-md overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-white/10 bg-black/30">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-display font-bold text-cream">
                  Register for Show
                </h2>
                <p className="text-sm text-cream/60 mt-1 truncate">
                  {show.eventName}
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-cream/40 hover:text-cream hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Show Details */}
            <div className="flex items-center gap-4 mt-3 text-sm text-cream/50">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-gold-400" />
                <span>{formattedDate}</span>
              </div>
              {show.location && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-purple-400" />
                  <span className="truncate">{show.location}</span>
                </div>
              )}
            </div>
          </div>

          {/* Corps Selection */}
          <div className="p-5">
            {userCorpsClasses.length === 0 ? (
              <div className="text-center py-6">
                <AlertTriangle className="w-10 h-10 text-cream/30 mx-auto mb-3" />
                <p className="text-cream/60">You don't have any corps yet.</p>
                <p className="text-cream/40 text-sm mt-1">Register a corps from the Dashboard first.</p>
              </div>
            ) : (
              <>
                {/* Quick Actions */}
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-bold text-cream/60 uppercase tracking-wide">
                    Select Corps
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={selectAll}
                      className="text-xs text-gold-400 hover:text-gold-300 font-bold"
                    >
                      Select All
                    </button>
                    <span className="text-cream/30">|</span>
                    <button
                      onClick={clearAll}
                      className="text-xs text-cream/50 hover:text-cream font-bold"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {/* Corps List */}
                <div className="space-y-2">
                  {userCorpsClasses.map(corpsClass => {
                    const corpsData = userProfile.corps[corpsClass];
                    const config = CLASS_CONFIG[corpsClass] || { name: corpsClass, color: 'gold' };
                    const isSelected = selectedCorps.includes(corpsClass);
                    const weekKey = `week${show.week}`;
                    const currentShows = corpsData.selectedShows?.[weekKey] || [];
                    const showsThisWeek = currentShows.length;
                    const isAtMax = showsThisWeek >= 4;
                    const isAlreadyAtShow = currentShows.some(
                      s => s.eventName === show.eventName && s.date === show.date
                    );

                    return (
                      <div
                        key={corpsClass}
                        onClick={() => toggleCorps(corpsClass)}
                        className={`
                          flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all
                          ${isSelected
                            ? 'border-gold-500/50 bg-gold-500/10'
                            : 'border-white/10 bg-black/20 hover:border-white/20'
                          }
                        `}
                      >
                        {/* Checkbox */}
                        <div className={`
                          w-5 h-5 rounded flex items-center justify-center shrink-0 transition-all
                          ${isSelected
                            ? 'bg-gold-500 border-gold-500'
                            : 'border-2 border-cream/30'
                          }
                        `}>
                          {isSelected && <Check className="w-3.5 h-3.5 text-charcoal-900" />}
                        </div>

                        {/* Corps Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-cream truncate">
                              {corpsData.corpsName || corpsData.name || 'Unnamed Corps'}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${getClassColor(config.color)}`}>
                              {config.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-xs ${isAtMax && !isAlreadyAtShow ? 'text-red-400' : 'text-cream/40'}`}>
                              {showsThisWeek}/4 shows this week
                            </span>
                            {isAtMax && !isAlreadyAtShow && (
                              <span className="text-[10px] text-red-400 font-bold">(MAX)</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Tip */}
                <div className="flex items-center gap-2 mt-4 p-2 bg-gold-500/10 border border-gold-500/20 rounded-lg">
                  <Users className="w-4 h-4 text-gold-400 shrink-0" />
                  <span className="text-xs text-cream/60">
                    Each corps can attend up to <span className="text-gold-400 font-bold">4 shows</span> per week
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Actions */}
          <div className="px-5 py-4 border-t border-white/10 bg-black/20 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg border border-white/10 text-cream/60 font-bold hover:bg-white/5 transition-colors"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex-1 px-4 py-2.5 rounded-lg bg-gold-500 text-charcoal-900 font-bold hover:bg-gold-400 transition-colors disabled:opacity-50"
              disabled={saving || userCorpsClasses.length === 0}
            >
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-charcoal-900 border-t-transparent rounded-full animate-spin" />
                  Saving...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Check className="w-4 h-4" />
                  Save
                </span>
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </Portal>
  );
};

export default ShowRegistrationModal;
