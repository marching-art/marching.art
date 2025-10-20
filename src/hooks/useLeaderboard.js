import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { getCacheData, setCacheData, isCacheStale } from '../utils/cacheHelper';

/**
 * Optimized hook for fetching leaderboard data
 * Uses stale-while-revalidate pattern for instant loading with fresh data
 */
export const useLeaderboard = (seasonYear, limitCount = 100) => {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isStale, setIsStale] = useState(false);
  const [error, setError] = useState(null);

  const cacheKey = `leaderboard_${seasonYear}_${limitCount}`;

  useEffect(() => {
    // Try to load from cache first
    const cached = getCacheData('LEADERBOARD', cacheKey);
    if (cached) {
      setUsers(cached);
      setIsLoading(false);
      setIsStale(isCacheStale('LEADERBOARD', cacheKey));
    }

    // Set up real-time listener
    const q = query(
      collection(db, 'users'),
      where('seasonYear', '==', seasonYear),
      where('isActive', '==', true),
      orderBy('totalPoints', 'desc'),
      limit(limitCount)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const userData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        setUsers(userData);
        setIsLoading(false);
        setIsStale(false);
        setError(null);

        // Update cache
        setCacheData('LEADERBOARD', cacheKey, userData);
      },
      (err) => {
        console.error('Error fetching leaderboard:', err);
        setError(err);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [seasonYear, limitCount, cacheKey]);

  const refresh = useCallback(() => {
    setIsLoading(true);
    // The onSnapshot listener will automatically trigger with fresh data
  }, []);

  return { users, isLoading, isStale, error, refresh };
};

/**
 * Hook for fetching league leaderboard
 */
export const useLeagueLeaderboard = (leagueId, seasonYear) => {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const cacheKey = `league_leaderboard_${leagueId}_${seasonYear}`;

  useEffect(() => {
    if (!leagueId) {
      setIsLoading(false);
      return;
    }

    // Try cache first
    const cached = getCacheData('LEADERBOARD', cacheKey);
    if (cached) {
      setUsers(cached);
      setIsLoading(false);
    }

    // Real-time listener for league members
    const q = query(
      collection(db, 'users'),
      where('leagues', 'array-contains', leagueId),
      where('seasonYear', '==', seasonYear),
      orderBy('totalPoints', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const userData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        setUsers(userData);
        setIsLoading(false);
        setError(null);
        setCacheData('LEADERBOARD', cacheKey, userData);
      },
      (err) => {
        console.error('Error fetching league leaderboard:', err);
        setError(err);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [leagueId, seasonYear, cacheKey]);

  return { users, isLoading, error };
};

/**
 * Hook for fetching user rank
 */
export const useUserRank = (userId, seasonYear) => {
  const [rank, setRank] = useState(null);
  const [totalUsers, setTotalUsers] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!userId || !seasonYear) {
      setIsLoading(false);
      return;
    }

    const q = query(
      collection(db, 'users'),
      where('seasonYear', '==', seasonYear),
      where('isActive', '==', true),
      orderBy('totalPoints', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const allUsers = snapshot.docs.map(doc => ({
          id: doc.id,
          points: doc.data().totalPoints
        }));

        const userIndex = allUsers.findIndex(u => u.id === userId);
        
        setRank(userIndex >= 0 ? userIndex + 1 : null);
        setTotalUsers(allUsers.length);
        setIsLoading(false);
      },
      (err) => {
        console.error('Error fetching user rank:', err);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId, seasonYear]);

  return { rank, totalUsers, isLoading };
};

export default useLeaderboard;