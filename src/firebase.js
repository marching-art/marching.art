// src/firebase.js
// =============================================================================
// LEGACY FIREBASE MODULE - For backwards compatibility
// =============================================================================
// This module re-exports from the new consolidated API layer while maintaining
// backwards compatibility with existing imports. New code should import from
// '@/api' instead.
//
// Migration: import { auth, db, authApi } from '@/api';

// Re-export Firebase instances from the consolidated API layer
// This ensures Firebase is only initialized once
export {
  app,
  auth,
  db,
  functions,
  storage,
  authHelpers,
  adminHelpers,
  DATA_NAMESPACE as dataNamespace,
} from './api/client';

// Re-export analytics
export { analytics, analyticsHelpers } from './api/analytics';

// Season helpers - kept here for backwards compatibility
export const seasonHelpers = {
  // Calculate current season based on date
  getCurrentSeason: () => {
    const now = new Date();
    const year = now.getFullYear();

    // Finals are always on the second Saturday of August
    const augustFirst = new Date(year, 7, 1);
    const firstSaturday = augustFirst.getDay() === 6 ? 1 : 7 - augustFirst.getDay() + 6;
    const finalsDate = new Date(year, 7, firstSaturday + 7);

    // Live season is 10 weeks before finals
    const liveSeasonStart = new Date(finalsDate);
    liveSeasonStart.setDate(liveSeasonStart.getDate() - 70);

    if (now >= liveSeasonStart && now <= finalsDate) {
      return {
        type: 'live',
        year: year,
        week: Math.floor((now - liveSeasonStart) / (7 * 24 * 60 * 60 * 1000)) + 1,
        daysRemaining: Math.floor((finalsDate - now) / (24 * 60 * 60 * 1000))
      };
    } else {
      // Off-season
      const offSeasonNumber = now < liveSeasonStart ?
        Math.floor((liveSeasonStart - now) / (7 * 7 * 24 * 60 * 60 * 1000)) + 1 :
        Math.floor((now - finalsDate) / (7 * 7 * 24 * 60 * 60 * 1000)) + 1;

      return {
        type: 'off',
        year: year,
        offSeasonNumber: Math.min(offSeasonNumber, 6),
        week: ((now - finalsDate) / (7 * 24 * 60 * 60 * 1000)) % 7 + 1
      };
    }
  },

  // Format season display name
  formatSeasonName: (season) => {
    if (season.type === 'live') {
      return `${season.year} Live Season - Week ${season.week}`;
    } else {
      return `${season.year} Off-Season ${season.offSeasonNumber} - Week ${Math.floor(season.week)}`;
    }
  }
};

// Default export for backwards compatibility
export { app as default } from './api/client';
