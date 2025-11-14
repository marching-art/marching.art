// src/hooks/useSeason.js
import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';

/**
 * Hook to access current season data in real-time
 * @returns {Object} { seasonData, loading, error, weeksRemaining }
 */
export const useSeason = () => {
  const [seasonData, setSeasonData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [weeksRemaining, setWeeksRemaining] = useState(null);

  useEffect(() => {
    const seasonRef = doc(db, 'game-settings/season');

    const unsubscribe = onSnapshot(
      seasonRef,
      (doc) => {
        if (doc.exists()) {
          const data = doc.data();
          setSeasonData(data);

          // Calculate weeks remaining
          if (data.schedule?.endDate) {
            const endDate = data.schedule.endDate.toDate();
            const now = new Date();
            const millisRemaining = endDate.getTime() - now.getTime();
            const weeks = Math.ceil(millisRemaining / (7 * 24 * 60 * 60 * 1000));
            setWeeksRemaining(weeks > 0 ? weeks : 0);
          }

          setError(null);
        } else {
          setError('No active season found');
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching season data:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return {
    seasonData,
    loading,
    error,
    weeksRemaining
  };
};

/**
 * Calculate current day and week of the season
 * @param {Object} seasonData - Season data from Firestore
 * @returns {Object} { currentDay, currentWeek }
 */
export const getSeasonProgress = (seasonData) => {
  if (!seasonData?.schedule?.startDate) {
    return { currentDay: 0, currentWeek: 0 };
  }

  const startDate = seasonData.schedule.startDate.toDate();
  const now = new Date();
  const diffInMillis = now.getTime() - startDate.getTime();
  const currentDay = Math.floor(diffInMillis / (1000 * 60 * 60 * 24)) + 1;
  const currentWeek = Math.ceil(currentDay / 7);

  return {
    currentDay: Math.max(1, Math.min(currentDay, 49)),
    currentWeek: Math.max(1, Math.min(currentWeek, 7))
  };
};

/**
 * Check if a class registration is locked based on weeks remaining
 * @param {string} corpsClass - Class to check ('soundSport', 'aClass', 'open', 'world')
 * @param {number} weeksRemaining - Weeks until season end
 * @returns {boolean} True if registration is locked
 */
export const isRegistrationLocked = (corpsClass, weeksRemaining) => {
  const locks = {
    world: 6,
    open: 5,
    aClass: 4,
    soundSport: 0
  };

  const lockWeeks = locks[corpsClass] || 0;
  return weeksRemaining < lockWeeks;
};

/**
 * Get season type display information
 * @param {string} status - Season status ('off-season' or 'live-season')
 * @returns {Object} Display info
 */
export const getSeasonTypeInfo = (status) => {
  if (status === 'live-season') {
    return {
      label: 'Live Season',
      color: 'text-red-500',
      bgColor: 'bg-red-500/20',
      description: 'Follow real DCI scores as they happen!'
    };
  }

  return {
    label: 'Off-Season',
    color: 'text-gold-500',
    bgColor: 'bg-gold-500/20',
    description: 'Fantasy competition with historical data'
  };
};

export default useSeason;
