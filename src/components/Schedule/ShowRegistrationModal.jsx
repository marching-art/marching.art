// =============================================================================
// SHOW REGISTRATION MODAL - ESPN DATA STYLE
// =============================================================================

import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, MapPin, Check, X, AlertTriangle, Users } from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase';
import toast from 'react-hot-toast';
import Portal from '../Portal';

const CLASS_CONFIG = {
  worldClass: { name: 'World Class', color: 'text-yellow-500' },
  openClass: { name: 'Open Class', color: 'text-purple-400' },
  aClass: { name: 'A Class', color: 'text-[#0057B8]' },
  soundSport: { name: 'SoundSport', color: 'text-green-500' },
};

const CLASS_ORDER = { worldClass: 0, openClass: 1, aClass: 2, soundSport: 3 };

const ShowRegistrationModal = ({ show, userProfile, formattedDate, onClose, onSuccess }) => {
  const [selectedCorps, setSelectedCorps] = useState([]);
  const [saving, setSaving] = useState(false);

  const userCorpsClasses = useMemo(() =>
    userProfile?.corps
      ? Object.keys(userProfile.corps).sort((a, b) => (CLASS_ORDER[a] ?? 99) - (CLASS_ORDER[b] ?? 99))
      : []
  , [userProfile?.corps]);

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
      const corpsData = userProfile.corps[corpsClass];
      const weekKey = `week${show.week}`;
      const currentShows = corpsData.selectedShows?.[weekKey] || [];
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

  const clearAll = () => {
    setSelectedCorps([]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const selectUserShows = httpsCallable(functions, 'selectUserShows');
      for (const corpsClass of userCorpsClasses) {
        const corpsData = userProfile.corps[corpsClass];
        const weekKey = `week${show.week}`;
        const currentShows = corpsData.selectedShows?.[weekKey] || [];
        const filteredShows = currentShows.filter(
          s => !(s.eventName === show.eventName && s.date === show.date)
        );
        const newShows = selectedCorps.includes(corpsClass)
          ? [...filteredShows, {
              eventName: show.eventName,
              date: show.date,
              location: show.location,
              day: show.day,
            }]
          : filteredShows;
        await selectUserShows({
          week: show.week,
          shows: newShows,
          corpsClass,
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

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div
          className="w-full max-w-md bg-[#1a1a1a] border border-[#333] rounded-sm shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-[#333] bg-[#222]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-gray-300">
                  Register for Show
                </h2>
                <p className="text-sm text-white mt-1 truncate">
                  {show.eventName}
                </p>
              </div>
              <button onClick={onClose} className="p-1 text-gray-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Show Details */}
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3 text-[#0057B8]" />
                <span>{formattedDate}</span>
              </div>
              {show.location && (
                <div className="flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-purple-400" />
                  <span className="truncate">{show.location}</span>
                </div>
              )}
            </div>
          </div>

          {/* Body */}
          <div className="p-4">
            {userCorpsClasses.length === 0 ? (
              <div className="text-center py-6">
                <AlertTriangle className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                <p className="text-sm text-gray-500">You don't have any corps yet.</p>
                <p className="text-xs text-gray-600 mt-1">Register a corps from the Dashboard first.</p>
              </div>
            ) : (
              <>
                {/* Quick Actions */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                    Select Corps
                  </span>
                  <div className="flex items-center gap-2 text-xs">
                    <button onClick={selectAll} className="text-[#0057B8] hover:text-[#0066d6] font-bold">
                      Select All
                    </button>
                    <span className="text-gray-600">|</span>
                    <button onClick={clearAll} className="text-gray-500 hover:text-white font-bold">
                      Clear
                    </button>
                  </div>
                </div>

                {/* Corps List */}
                <div className="border border-[#333] divide-y divide-[#333]">
                  {userCorpsClasses.map(corpsClass => {
                    const corpsData = userProfile.corps[corpsClass];
                    const config = CLASS_CONFIG[corpsClass] || { name: corpsClass, color: 'text-gray-400' };
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
                        className={`flex items-center gap-3 p-3 cursor-pointer transition-colors hover:bg-white/5 ${
                          isSelected ? 'bg-[#0057B8]/10 border-l-2 border-l-[#0057B8]' : ''
                        }`}
                      >
                        {/* Checkbox */}
                        <div className={`w-4 h-4 border-2 flex items-center justify-center flex-shrink-0 ${
                          isSelected ? 'bg-[#0057B8] border-[#0057B8]' : 'border-[#444]'
                        }`}>
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </div>

                        {/* Corps Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-sm truncate">
                              {corpsData.corpsName || corpsData.name || 'Unnamed Corps'}
                            </span>
                            <span className={`text-[10px] font-bold uppercase ${config.color}`}>
                              {config.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-[10px] ${isAtMax && !isAlreadyAtShow ? 'text-red-400' : 'text-gray-500'}`}>
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
                <div className="flex items-center gap-2 mt-3 p-2 bg-[#0057B8]/10 border border-[#0057B8]/30">
                  <Users className="w-4 h-4 text-[#0057B8] flex-shrink-0" />
                  <span className="text-[10px] text-gray-400">
                    Each corps can attend up to <span className="text-[#0057B8] font-bold">4 shows</span> per week
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-[#333] bg-[#222] flex justify-end gap-2">
            <button
              onClick={onClose}
              disabled={saving}
              className="h-9 px-4 border border-[#333] text-gray-400 text-sm font-bold uppercase tracking-wider hover:border-[#444] hover:text-white disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || userCorpsClasses.length === 0}
              className="h-9 px-4 bg-[#0057B8] text-white text-sm font-bold uppercase tracking-wider hover:bg-[#0066d6] disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Save
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
};

export default ShowRegistrationModal;
