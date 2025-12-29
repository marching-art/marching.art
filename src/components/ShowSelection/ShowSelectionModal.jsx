// =============================================================================
// SHOW SELECTION MODAL - ESPN DATA STYLE
// =============================================================================

import React, { useState, useEffect } from 'react';
import { Calendar, MapPin, Check, X, Info, AlertCircle } from 'lucide-react';
import { db, functions } from '../../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import toast from 'react-hot-toast';
import Portal from '../Portal';

const ShowSelectionModal = ({ onClose, onSubmit, corpsClass, currentWeek, seasonId, currentSelections = [] }) => {
  const [availableShows, setAvailableShows] = useState([]);
  const [selectedShows, setSelectedShows] = useState(currentSelections);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const MAX_SHOWS = 4;

  const classNameMap = {
    soundSport: 'soundSport',
    aClass: 'aClass',
    open: 'openClass',
    world: 'worldClass',
  };

  const backendClassName = classNameMap[corpsClass] || corpsClass;

  useEffect(() => {
    fetchAvailableShows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seasonId, currentWeek]);

  const fetchAvailableShows = async () => {
    try {
      setLoading(true);
      const seasonRef = doc(db, 'game-settings/season');
      const seasonSnap = await getDoc(seasonRef);

      if (seasonSnap.exists()) {
        const seasonData = seasonSnap.data();
        const events = seasonData.events || [];
        const weekStart = (currentWeek - 1) * 7 + 1;
        const weekEnd = currentWeek * 7;
        const weekShows = [];
        events.forEach(dayEvent => {
          const day = dayEvent.offSeasonDay || dayEvent.day || 0;
          if (day >= weekStart && day <= weekEnd && dayEvent.shows) {
            dayEvent.shows.forEach(show => {
              // Skip championship shows - they are auto-enrolled based on class
              if (show.isChampionship) {
                return;
              }
              weekShows.push({
                ...show,
                day: day,
                offSeasonDay: day,
              });
            });
          }
        });
        setAvailableShows(weekShows);
      } else {
        toast.error('No active season found');
        setAvailableShows([]);
      }
    } catch (error) {
      console.error('Error fetching shows:', error);
      toast.error('Failed to load available shows');
      setAvailableShows([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleShow = (show) => {
    const showIdentifier = {
      eventName: show.eventName || show.name,
      date: show.date,
      location: show.location,
      day: show.day,
    };

    const isSelected = selectedShows.some(
      s => s.eventName === showIdentifier.eventName && s.date === showIdentifier.date
    );

    if (isSelected) {
      setSelectedShows(selectedShows.filter(
        s => !(s.eventName === showIdentifier.eventName && s.date === showIdentifier.date)
      ));
    } else {
      const sameDayShow = selectedShows.find(s => s.day === showIdentifier.day);
      if (sameDayShow) {
        toast.error(`You already have a show selected on day ${showIdentifier.day}. Corps can only attend one show per day.`);
        return;
      }
      if (selectedShows.length < MAX_SHOWS) {
        setSelectedShows([...selectedShows, showIdentifier]);
      } else {
        toast.error(`You can only select up to ${MAX_SHOWS} shows per week`);
      }
    }
  };

  const handleSubmit = async () => {
    if (selectedShows.length === 0) {
      toast.error('Please select at least one show');
      return;
    }

    try {
      setSaving(true);
      const selectUserShows = httpsCallable(functions, 'selectUserShows');
      const result = await selectUserShows({
        week: currentWeek,
        shows: selectedShows,
        corpsClass: backendClassName,
      });
      toast.success(result.data.message || `Selected ${selectedShows.length} show(s) for week ${currentWeek}`);
      onSubmit(selectedShows);
      onClose();
    } catch (error) {
      console.error('Error saving show selections:', error);
      toast.error(error.message || 'Failed to save show selections');
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
          className="w-full max-w-4xl max-h-[90vh] bg-[#1a1a1a] border border-[#333] rounded-sm shadow-2xl flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-[#333] bg-[#222] flex-shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-gray-300">
                  Select Shows for Week {currentWeek}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Choose up to {MAX_SHOWS} shows to attend
                </p>
              </div>
              <button onClick={onClose} className="p-1 text-gray-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Selection Counter */}
          <div className="px-4 py-3 bg-[#0a0a0a] border-b border-[#333] flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-400">
                Shows Selected: <span className="font-bold text-white">{selectedShows.length}</span> / {MAX_SHOWS}
              </div>
              <div className="flex gap-1">
                {[...Array(MAX_SHOWS)].map((_, i) => (
                  <div
                    key={i}
                    className={`w-6 h-2 ${i < selectedShows.length ? 'bg-[#0057B8]' : 'bg-[#333]'}`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="text-center py-12">
                <div className="w-8 h-8 border-2 border-[#0057B8] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-xs text-gray-500 uppercase tracking-wider">Loading shows...</p>
              </div>
            ) : availableShows.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                {currentWeek === 7 ? (
                  <>
                    <p className="text-sm text-[#0057B8] font-bold mb-2">🏆 Championship Week</p>
                    <p className="text-sm text-gray-400 mb-2">
                      All championship events have automatic enrollment!
                    </p>
                    <div className="text-xs text-gray-500 space-y-1 max-w-md mx-auto text-left px-8">
                      <p><strong>Days 45-46:</strong> Open & A Class Prelims/Finals (Marion, IN)</p>
                      <p><strong>Days 47-49:</strong> World Championships (Indianapolis, IN)</p>
                      <p><strong>Day 49:</strong> SoundSport Festival (Indianapolis, IN)</p>
                    </div>
                    <p className="text-xs text-gray-600 mt-3">
                      Your corps will compete based on class eligibility and advancement.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-gray-500 mb-1">No shows available this week</p>
                    <p className="text-xs text-gray-600">Check back next week for new events</p>
                  </>
                )}
              </div>
            ) : (
              <>
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-3">
                  Available Shows
                </h3>
                <div className="border border-[#333] divide-y divide-[#333]">
                  {availableShows.map((show, index) => {
                    const showIdentifier = {
                      eventName: show.eventName || show.name,
                      date: show.date,
                    };
                    const isSelected = selectedShows.some(
                      s => s.eventName === showIdentifier.eventName && s.date === showIdentifier.date
                    );

                    return (
                      <div
                        key={index}
                        onClick={() => toggleShow(show)}
                        className={`p-3 cursor-pointer transition-colors hover:bg-white/5 ${
                          isSelected ? 'bg-[#0057B8]/10 border-l-2 border-l-[#0057B8]' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-bold text-white text-sm truncate">
                                {show.eventName || show.name}
                              </h4>
                              {isSelected && <Check className="w-4 h-4 text-[#0057B8] flex-shrink-0" />}
                            </div>
                            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                              {show.date && (
                                <div className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  <span>{show.date?.toDate ? show.date.toDate().toLocaleDateString() : show.date}</span>
                                </div>
                              )}
                              {show.location && (
                                <div className="flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  <span>{show.location}</span>
                                </div>
                              )}
                              {show.day && (
                                <span className="text-gray-600">Day {show.day}</span>
                              )}
                            </div>
                          </div>
                          <div className={`w-5 h-5 border-2 flex items-center justify-center flex-shrink-0 ${
                            isSelected ? 'bg-[#0057B8] border-[#0057B8]' : 'border-[#444]'
                          }`}>
                            {isSelected && <Check className="w-3 h-3 text-white" />}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* Info Box */}
            <div className="mt-4 p-3 bg-[#0057B8]/10 border border-[#0057B8]/30">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-[#0057B8] flex-shrink-0 mt-0.5" />
                <div className="text-xs text-gray-400">
                  <p className="font-bold text-[#0057B8] mb-1">Show Selection Rules:</p>
                  <ul className="space-y-0.5">
                    <li>• Select up to {MAX_SHOWS} shows per week</li>
                    <li>• Only one show per day</li>
                    <li>• Scores from attended shows count toward season total</li>
                    <li>• Selections lock when the week begins</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Selected Shows Summary */}
            {selectedShows.length > 0 && (
              <div className="mt-4 p-3 bg-green-500/10 border border-green-500/30">
                <h4 className="text-xs font-bold text-green-400 mb-2 flex items-center gap-2">
                  <Check className="w-3 h-3" />
                  Selected ({selectedShows.length})
                </h4>
                <div className="space-y-1">
                  {selectedShows.map((show, index) => (
                    <div key={index} className="text-xs text-gray-300 flex items-center gap-2">
                      <span className="text-[#0057B8]">•</span>
                      <span>{show.eventName}</span>
                      {show.date && <span className="text-gray-500">- {show.date?.toDate ? show.date.toDate().toLocaleDateString() : show.date}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-[#333] bg-[#222] flex justify-end gap-2 flex-shrink-0">
            <button
              onClick={onClose}
              disabled={saving}
              className="h-9 px-4 border border-[#333] text-gray-400 text-sm font-bold uppercase tracking-wider hover:border-[#444] hover:text-white disabled:opacity-50 flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={selectedShows.length === 0 || saving || loading}
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
                  Confirm ({selectedShows.length})
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
};

export default ShowSelectionModal;
