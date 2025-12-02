import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
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

  // Map frontend class names to backend expected names
  const classNameMap = {
    soundSport: 'soundSport',
    aClass: 'aClass',
    open: 'openClass',
    world: 'worldClass'
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

        // Filter events for the current week
        // Each week is 7 days, week 1 = days 1-7, week 2 = days 8-14, etc.
        const weekStart = (currentWeek - 1) * 7 + 1;
        const weekEnd = currentWeek * 7;

        // Flatten the schedule structure and filter for current week
        const weekShows = [];
        events.forEach(dayEvent => {
          const day = dayEvent.offSeasonDay || dayEvent.day || 0;
          if (day >= weekStart && day <= weekEnd && dayEvent.shows) {
            // Add each show from this day's shows array
            dayEvent.shows.forEach(show => {
              weekShows.push({
                ...show,
                day: day, // Normalize to 'day' for consistency
                offSeasonDay: day
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
      day: show.day
    };

    const isSelected = selectedShows.some(
      s => s.eventName === showIdentifier.eventName && s.date === showIdentifier.date
    );

    if (isSelected) {
      // Remove show
      setSelectedShows(selectedShows.filter(
        s => !(s.eventName === showIdentifier.eventName && s.date === showIdentifier.date)
      ));
    } else {
      // Check if there's already a show selected for the same day
      const sameDayShow = selectedShows.find(s => s.day === showIdentifier.day);
      if (sameDayShow) {
        toast.error(`You already have a show selected on day ${showIdentifier.day}. Corps can only attend one show per day.`);
        return;
      }

      // Add show if under limit
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
        corpsClass: backendClassName
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
          className="w-full max-w-4xl max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="glass-dark rounded-2xl p-8">
          {/* Header */}
          <div className="mb-6">
            <h2 className="text-3xl font-display font-bold text-gradient mb-2">
              Select Shows for Week {currentWeek}
            </h2>
            <p className="text-cream-300">
              Choose up to {MAX_SHOWS} shows to attend this week
            </p>
          </div>

          {/* Selection Counter */}
          <div className="mb-6 p-4 bg-charcoal-900/50 rounded-xl border border-cream-500/10">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-cream-100">
                  Shows Selected
                </h3>
                <p className="text-sm text-cream-500/60">
                  {selectedShows.length} of {MAX_SHOWS} shows
                </p>
              </div>
              <div className="text-right">
                <div className={`text-3xl font-bold ${
                  selectedShows.length === 0 ? 'text-cream-500/40' :
                  selectedShows.length >= MAX_SHOWS ? 'text-gold-500' :
                  'text-blue-500'
                }`}>
                  {selectedShows.length} / {MAX_SHOWS}
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-3 h-2 bg-charcoal-800 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(selectedShows.length / MAX_SHOWS) * 100}%` }}
                transition={{ duration: 0.3 }}
                className="h-full bg-gradient-gold"
              />
            </div>
          </div>

          {/* Available Shows */}
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin w-12 h-12 border-4 border-gold-500 border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-cream-500/60">Loading available shows...</p>
            </div>
          ) : availableShows.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="w-16 h-16 text-cream-500/40 mx-auto mb-4" />
              <p className="text-cream-500/60 mb-2">No shows available this week</p>
              <p className="text-sm text-cream-500/40">Check back next week for new events</p>
            </div>
          ) : (
            <div className="space-y-3 mb-6">
              <h3 className="text-lg font-semibold text-cream-100 mb-3">
                Available Shows This Week
              </h3>

              {availableShows.map((show, index) => {
                const showIdentifier = {
                  eventName: show.eventName || show.name,
                  date: show.date
                };
                const isSelected = selectedShows.some(
                  s => s.eventName === showIdentifier.eventName && s.date === showIdentifier.date
                );

                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                      isSelected
                        ? 'border-gold-500 bg-gold-500/10'
                        : 'border-cream-500/10 bg-charcoal-900/30 hover:border-cream-500/30'
                    }`}
                    onClick={() => toggleShow(show)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-semibold text-cream-100 text-lg">
                            {show.eventName || show.name}
                          </h4>
                          {isSelected && (
                            <Check className="w-5 h-5 text-gold-500" />
                          )}
                        </div>

                        <div className="flex flex-col gap-1 text-sm text-cream-500/80">
                          {show.date && (
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4" />
                              <span>{show.date?.toDate ? show.date.toDate().toLocaleDateString() : show.date}</span>
                            </div>
                          )}
                          {show.location && (
                            <div className="flex items-center gap-2">
                              <MapPin className="w-4 h-4" />
                              <span>{show.location}</span>
                            </div>
                          )}
                          {show.day && (
                            <div className="text-xs text-cream-500/60">
                              Day {show.day} of season
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="ml-4">
                        <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${
                          isSelected
                            ? 'border-gold-500 bg-gold-500'
                            : 'border-cream-500/30'
                        }`}>
                          {isSelected && <Check className="w-5 h-5 text-charcoal-900" />}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Info Box */}
          <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-cream-300">
                <p className="font-semibold mb-1">Show Selection Rules:</p>
                <ul className="list-disc list-inside space-y-1 text-cream-500/80">
                  <li>Select up to {MAX_SHOWS} shows per week</li>
                  <li>Only one show per day - corps cannot be in two places at once</li>
                  <li>Your corps will compete at all selected shows</li>
                  <li>Scores from attended shows contribute to your season total</li>
                  <li>World Championship finals (Days 47-49) automatically enroll all corps</li>
                  <li>Selections lock when the week begins - choose carefully!</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Selected Shows Summary */}
          {selectedShows.length > 0 && (
            <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
              <h4 className="font-semibold text-green-400 mb-2 flex items-center gap-2">
                <Check className="w-4 h-4" />
                Selected Shows ({selectedShows.length})
              </h4>
              <div className="space-y-1">
                {selectedShows.map((show, index) => (
                  <div key={index} className="text-sm text-cream-300 flex items-center gap-2">
                    <span className="text-gold-500">•</span>
                    <span>{show.eventName}</span>
                    {show.date && <span className="text-cream-500/60">- {show.date?.toDate ? show.date.toDate().toLocaleDateString() : show.date}</span>}
                  </div>
                ))}
              </div>
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
              onClick={handleSubmit}
              className="btn-primary flex-1"
              disabled={selectedShows.length === 0 || saving || loading}
            >
              {saving ? (
                <>
                  <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="w-5 h-5 mr-2" />
                  Confirm Selection ({selectedShows.length} shows)
                </>
              )}
            </button>
          </div>
          </div>
        </motion.div>
      </motion.div>
    </Portal>
  );
};

export default ShowSelectionModal;
