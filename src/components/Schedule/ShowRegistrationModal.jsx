// =============================================================================
// SHOW REGISTRATION MODAL - DIRECTOR'S COMMAND CENTER
// =============================================================================
// Full show details, registration controls, attendees, and results
// Mobile-optimized with BottomSheet for native swipe-to-dismiss

import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar, MapPin, Check, X, AlertTriangle, Users,
  Trophy, ChevronRight, Clock, Info, Ticket
} from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase';
import toast from 'react-hot-toast';
import Portal from '../Portal';
import { BottomSheet } from '../ui/BottomSheet';
import { useHaptic } from '../../hooks/useHaptic';
import { getMaxShowsForWeek } from '../../utils/captionPricing';
import { compareCorpsClasses } from '../../utils/corps';

const CLASS_CONFIG = {
  worldClass: { name: 'World Class', shortName: 'World', color: 'text-yellow-500', bgColor: 'bg-yellow-500/10' },
  openClass: { name: 'Open Class', shortName: 'Open', color: 'text-purple-400', bgColor: 'bg-purple-400/10' },
  aClass: { name: 'A Class', shortName: 'A Class', color: 'text-[#0057B8]', bgColor: 'bg-[#0057B8]/10' },
  soundSport: { name: 'SoundSport', shortName: 'SS', color: 'text-green-500', bgColor: 'bg-green-500/10' },
};

// =============================================================================
// CORPS SELECTION ITEM
// =============================================================================

const CorpsSelectionItem = ({
  corpsClass,
  corpsData,
  isSelected,
  onToggle,
  show,
  isDisabled,
  maxShows
}) => {
  const config = CLASS_CONFIG[corpsClass] || { name: corpsClass, color: 'text-gray-400' };
  const weekKey = `week${show.week}`;
  const currentShows = corpsData.selectedShows?.[weekKey] || [];
  const showsThisWeek = currentShows.length;
  const isAtMax = showsThisWeek >= maxShows;
  const isAlreadyAtShow = currentShows.some(
    s => s.eventName === show.eventName && s.date === show.date
  );

  return (
    <button
      onClick={() => !isDisabled && onToggle(corpsClass)}
      disabled={isDisabled}
      className={`
        flex items-center gap-3 p-4 w-full text-left transition-colors min-h-[60px]
        ${isSelected
          ? 'bg-[#0057B8]/10 border-l-2 border-l-[#0057B8]'
          : 'hover:bg-white/5 active:bg-white/10'
        }
        ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      {/* Checkbox */}
      <div className={`
        w-5 h-5 border-2 flex items-center justify-center flex-shrink-0
        ${isSelected ? 'bg-[#0057B8] border-[#0057B8]' : 'border-[#444]'}
      `}>
        {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
      </div>

      {/* Corps Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-bold text-white text-sm truncate">
            {corpsData.corpsName || corpsData.name || 'Unnamed Corps'}
          </span>
          <span className={`text-[10px] font-bold uppercase ${config.color}`}>
            {config.shortName}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`text-[11px] ${isAtMax && !isAlreadyAtShow ? 'text-red-400' : 'text-gray-500'}`}>
            {showsThisWeek}/{maxShows} shows this week
          </span>
          {isAtMax && !isAlreadyAtShow && (
            <span className="text-[10px] text-red-400 font-bold px-1.5 py-0.5 bg-red-400/10">
              MAX
            </span>
          )}
        </div>
      </div>
    </button>
  );
};

// =============================================================================
// MAIN MODAL COMPONENT
// =============================================================================

const ShowRegistrationModal = ({ show, userProfile, formattedDate, onClose, onSuccess }) => {
  const [selectedCorps, setSelectedCorps] = useState([]);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState('register'); // 'register' | 'info'
  const { trigger: haptic } = useHaptic();

  // Get max shows based on the show's week (7 for final week, 4 otherwise)
  const maxShows = useMemo(() => getMaxShowsForWeek(show.week), [show.week]);

  // Check if this is a championship show with auto-enrollment
  const isChampionship = show.isChampionship === true;
  // allowedClasses comes from schedule transform, eligibleClasses is the backend field name
  const eligibleClasses = show.allowedClasses || show.eligibleClasses || [];

  // Detect mobile for BottomSheet vs Modal
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const userCorpsClasses = useMemo(() =>
    userProfile?.corps
      ? Object.keys(userProfile.corps).sort(compareCorpsClasses)
      : []
  , [userProfile?.corps]);

  // For championship shows, determine which corps are enrolled/eligible
  const enrolledCorps = useMemo(() => {
    if (!isChampionship) return [];
    return userCorpsClasses.filter(corpsClass => eligibleClasses.includes(corpsClass));
  }, [isChampionship, userCorpsClasses, eligibleClasses]);

  const ineligibleCorps = useMemo(() => {
    if (!isChampionship) return [];
    return userCorpsClasses.filter(corpsClass => !eligibleClasses.includes(corpsClass));
  }, [isChampionship, userCorpsClasses, eligibleClasses]);

  // Initialize with already registered corps
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
    haptic('light');
    if (selectedCorps.includes(corpsClass)) {
      setSelectedCorps(selectedCorps.filter(c => c !== corpsClass));
    } else {
      const corpsData = userProfile.corps[corpsClass];
      const weekKey = `week${show.week}`;
      const currentShows = corpsData.selectedShows?.[weekKey] || [];
      const isAlreadyAtShow = currentShows.some(
        s => s.eventName === show.eventName && s.date === show.date
      );
      if (currentShows.length >= maxShows && !isAlreadyAtShow) {
        haptic('error');
        toast.error(`This corps already has ${maxShows} shows registered for week ${show.week}`);
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
      return currentShows.length < maxShows || isAlreadyAtShow || selectedCorps.includes(corpsClass);
    });
    setSelectedCorps(canSelect);
  };

  const clearAll = () => {
    setSelectedCorps([]);
  };

  const handleSave = async () => {
    haptic('medium');
    setSaving(true);
    try {
      const selectUserShows = httpsCallable(functions, 'selectUserShows');

      // Prepare all updates first, then execute in parallel to avoid race conditions
      const updatePromises = userCorpsClasses.map(corpsClass => {
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
        return selectUserShows({
          week: show.week,
          shows: newShows,
          corpsClass,
        });
      });

      // Wait for all updates to complete
      await Promise.all(updatePromises);

      haptic('success');
      toast.success('Registration updated!');
      onSuccess();
    } catch (error) {
      console.error('Error updating registration:', error);
      haptic('error');
      toast.error(error.message || 'Failed to update registration');
    } finally {
      setSaving(false);
    }
  };

  // Check if any corps registered
  const hasChanges = useMemo(() => {
    const initialRegistered = userCorpsClasses.filter(corpsClass => {
      const corpsData = userProfile.corps[corpsClass];
      const weekKey = `week${show.week}`;
      const selectedShows = corpsData.selectedShows?.[weekKey] || [];
      return selectedShows.some(s => s.eventName === show.eventName && s.date === show.date);
    });
    return JSON.stringify(initialRegistered.sort()) !== JSON.stringify(selectedCorps.sort());
  }, [selectedCorps, userCorpsClasses, userProfile, show]);

  // Shared header content for both mobile and desktop
  const HeaderContent = () => (
    <>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold text-white leading-tight">
            {show.eventName}
          </h2>
          <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-gray-400">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#0057B8]" />
              {formattedDate}
            </span>
            {show.location && (
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-purple-400" />
                <span className="truncate max-w-[180px]">{show.location}</span>
              </span>
            )}
          </div>
        </div>
        {!isMobile && (
          <button
            onClick={onClose}
            className="p-2 -mr-2 -mt-1 text-gray-500 hover:text-white active:text-white rounded-full hover:bg-white/10 min-w-touch min-h-touch flex items-center justify-center"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Week Info Badge */}
      <div className="mt-3 flex items-center gap-2">
        <span className="px-2 py-1 bg-[#0057B8]/10 text-[#0057B8] text-[10px] font-bold uppercase">
          Week {show.week}
        </span>
        <span className="text-[10px] text-gray-500">
          Max {maxShows} shows per corps
        </span>
      </div>
    </>
  );

  // Shared body content
  const BodyContent = () => (
    <>
      {/* Championship Auto-Enrollment Display */}
      {isChampionship ? (
        <div className="px-4 py-6">
          {/* Auto-Enrollment Banner */}
          <div className="flex items-start gap-3 p-4 bg-yellow-500/10 border border-yellow-500/30 mb-4">
            <Trophy className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-yellow-400 mb-1">Championship Event</p>
              <p className="text-xs text-gray-400">
                Eligible corps are automatically enrolled. No manual registration required.
              </p>
            </div>
          </div>

          {/* Enrolled Corps */}
          {enrolledCorps.length > 0 && (
            <div className="mb-4">
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3">
                <Check className="w-3 h-3 inline mr-1 text-green-500" />
                Automatically Enrolled
              </div>
              <div className="space-y-2">
                {enrolledCorps.map(corpsClass => {
                  const corpsData = userProfile.corps[corpsClass];
                  const config = CLASS_CONFIG[corpsClass];
                  return (
                    <div
                      key={corpsClass}
                      className="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/30"
                    >
                      <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="font-bold text-white text-sm">
                          {corpsData.corpsName || corpsData.name || 'Unnamed Corps'}
                        </span>
                        <span className={`ml-2 text-[10px] font-bold uppercase ${config.color}`}>
                          {config.shortName}
                        </span>
                      </div>
                      <span className="text-[10px] text-green-400 font-bold px-2 py-1 bg-green-500/20">
                        ENROLLED
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Ineligible Corps */}
          {ineligibleCorps.length > 0 && (
            <div>
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3">
                <X className="w-3 h-3 inline mr-1 text-red-400" />
                Not Eligible
              </div>
              <div className="space-y-2">
                {ineligibleCorps.map(corpsClass => {
                  const corpsData = userProfile.corps[corpsClass];
                  const config = CLASS_CONFIG[corpsClass];
                  return (
                    <div
                      key={corpsClass}
                      className="flex items-center gap-3 p-3 bg-[#222] border border-[#333] opacity-60"
                    >
                      <X className="w-4 h-4 text-red-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-gray-400 text-sm">
                          {corpsData.corpsName || corpsData.name || 'Unnamed Corps'}
                        </span>
                        <span className={`ml-2 text-[10px] font-bold uppercase ${config.color}`}>
                          {config.shortName}
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-500 font-medium">
                        Class not eligible
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* No Corps Message */}
          {userCorpsClasses.length === 0 && (
            <div className="text-center py-6">
              <AlertTriangle className="w-10 h-10 text-gray-600 mx-auto mb-3" />
              <p className="text-sm text-gray-400">No corps registered yet.</p>
              <Link
                to="/"
                onClick={onClose}
                className="inline-block mt-3 px-4 py-2 bg-[#0057B8] text-white text-xs font-bold uppercase"
              >
                Create a Corps
              </Link>
            </div>
          )}

          {/* Eligible Classes Info */}
          <div className="mt-4 p-3 bg-[#111] border border-[#333]">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
              Eligible Classes for This Event
            </p>
            <div className="flex flex-wrap gap-2">
              {eligibleClasses.map(cls => {
                const config = CLASS_CONFIG[cls];
                return (
                  <span
                    key={cls}
                    className={`px-2 py-1 text-xs font-bold ${config?.bgColor || 'bg-gray-500/10'} ${config?.color || 'text-gray-400'}`}
                  >
                    {config?.name || cls}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      ) : userCorpsClasses.length === 0 ? (
        <div className="text-center py-10 px-4">
          <AlertTriangle className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-400 font-medium">No Corps Registered</p>
          <p className="text-xs text-gray-600 mt-1 max-w-[280px] mx-auto">
            Create a corps from the Dashboard to start registering for shows.
          </p>
          <Link
            to="/"
            onClick={onClose}
            className="inline-block mt-4 px-4 py-2 bg-[#0057B8] text-white text-xs font-bold uppercase hover:bg-[#0066d6] press-feedback"
          >
            Go to Dashboard
          </Link>
        </div>
      ) : (
        <>
          {/* Quick Actions */}
          <div className="flex items-center justify-between px-4 py-3 bg-[#111] border-b border-[#333]">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
              Select Corps to Attend
            </span>
            <div className="flex items-center gap-3 text-xs">
              <button
                onClick={() => { haptic('light'); selectAll(); }}
                className="text-[#0057B8] hover:text-[#0066d6] font-bold py-2 px-2 -mx-2 rounded hover:bg-[#0057B8]/10 min-h-touch press-feedback"
              >
                Select All
              </button>
              <span className="text-gray-700">|</span>
              <button
                onClick={() => { haptic('light'); clearAll(); }}
                className="text-gray-500 hover:text-white font-bold py-2 px-2 -mx-2 rounded hover:bg-white/5 min-h-touch press-feedback"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Corps List */}
          <div className="divide-y divide-[#333]">
            {userCorpsClasses.map(corpsClass => {
              const corpsData = userProfile.corps[corpsClass];
              const isSelected = selectedCorps.includes(corpsClass);

              return (
                <CorpsSelectionItem
                  key={corpsClass}
                  corpsClass={corpsClass}
                  corpsData={corpsData}
                  isSelected={isSelected}
                  onToggle={toggleCorps}
                  show={show}
                  isDisabled={false}
                  maxShows={maxShows}
                />
              );
            })}
          </div>

          {/* Info Section */}
          <div className="px-4 py-3 bg-[#111] border-t border-[#333]">
            <div className="flex items-start gap-3 p-3 bg-[#0057B8]/5 border border-[#0057B8]/20">
              <Ticket className="w-4 h-4 text-[#0057B8] flex-shrink-0 mt-0.5" />
              <div className="text-[11px] text-gray-400 leading-relaxed">
                <p>
                  Each corps can attend up to <span className="text-[#0057B8] font-bold">{maxShows} shows per week</span>.
                  Scores from attended shows contribute to your season standings.
                </p>
              </div>
            </div>
          </div>

          {/* Registration Summary */}
          {selectedCorps.length > 0 && (
            <div className="px-4 py-3 bg-[#111] border-t border-[#333]">
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                Registering
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedCorps.map(corpsClass => {
                  const corpsData = userProfile.corps[corpsClass];
                  const config = CLASS_CONFIG[corpsClass];
                  return (
                    <span
                      key={corpsClass}
                      className={`inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium ${config.bgColor} ${config.color}`}
                    >
                      <Check className="w-3 h-3" />
                      {corpsData.corpsName || corpsData.name || config.name}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </>
  );

  // Shared footer content
  const FooterContent = () => {
    // Championship shows don't need Save/Cancel - just a Close button
    if (isChampionship) {
      return (
        <button
          onClick={() => { haptic('light'); onClose(); }}
          className="w-full h-12 bg-[#333] text-white text-sm font-bold uppercase tracking-wider hover:bg-[#444] active:bg-[#222] press-feedback flex items-center justify-center gap-2"
        >
          <X className="w-4 h-4" />
          Close
        </button>
      );
    }

    return userCorpsClasses.length > 0 ? (
      <div className="flex gap-3">
        <button
          onClick={() => { haptic('light'); onClose(); }}
          disabled={saving}
          className="flex-1 h-12 border border-[#444] text-gray-300 text-sm font-bold uppercase tracking-wider hover:border-[#555] hover:text-white disabled:opacity-50 active:bg-[#333] press-feedback"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="flex-1 h-12 bg-[#0057B8] text-white text-sm font-bold uppercase tracking-wider hover:bg-[#0066d6] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:bg-[#004494] press-feedback-strong"
        >
          {saving ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              {hasChanges ? 'Save Changes' : 'No Changes'}
            </>
          )}
        </button>
      </div>
    ) : null;
  };

  // Mobile: Use BottomSheet with native swipe-to-dismiss
  if (isMobile) {
    return (
      <BottomSheet
        isOpen={true}
        onClose={onClose}
        snapPoints={[85]}
        showCloseButton={true}
      >
        {/* Header */}
        <div className="px-4 pb-3 border-b border-[#333]">
          <HeaderContent />
        </div>

        {/* Body - Scrollable */}
        <div className="flex-1 overflow-y-auto scroll-momentum">
          <BodyContent />
        </div>

        {/* Footer */}
        {(isChampionship || userCorpsClasses.length > 0) && (
          <div className="px-4 py-4 border-t border-[#333] bg-[#1a1a1a] flex-shrink-0 safe-area-bottom">
            <FooterContent />
          </div>
        )}
      </BottomSheet>
    );
  }

  // Desktop: Use Portal with centered modal
  return (
    <Portal>
      <div
        className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center"
        onClick={onClose}
      >
        <div
          className="w-full max-w-lg bg-[#1a1a1a] border border-[#333] rounded-sm max-h-[90vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-4 py-4 border-b border-[#333] bg-[#222] flex-shrink-0">
            <HeaderContent />
          </div>

          {/* Body - Scrollable */}
          <div className="flex-1 overflow-y-auto">
            <BodyContent />
          </div>

          {/* Footer */}
          {(isChampionship || userCorpsClasses.length > 0) && (
            <div className="px-4 py-4 border-t border-[#333] bg-[#111] flex-shrink-0">
              <FooterContent />
            </div>
          )}
        </div>
      </div>
    </Portal>
  );
};

export default ShowRegistrationModal;
