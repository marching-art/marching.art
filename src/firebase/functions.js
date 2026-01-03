import { getFunctions, httpsCallable } from 'firebase/functions';
import { functions } from '../firebase'; // Assuming 'functions' is exported from firebase.js

// ========================================
// USER MANAGEMENT
// ========================================

export const checkUsername = httpsCallable(functions, 'checkUsername');
export const createUserProfile = httpsCallable(functions, 'createUserProfile');
export const setUserRole = httpsCallable(functions, 'setUserRole');
export const getShowRegistrations = httpsCallable(functions, 'getShowRegistrations');
export const getUserRankings = httpsCallable(functions, 'getUserRankings');

// ========================================
// CORPS & LINEUP
// ========================================

export const registerCorps = httpsCallable(functions, 'registerCorps');
export const saveLineup = httpsCallable(functions, 'saveLineup');
export const selectUserShows = httpsCallable(functions, 'selectUserShows');
export const validateAndSaveLineup = httpsCallable(functions, 'validateAndSaveLineup');
export const saveShowConcept = httpsCallable(functions, 'saveShowConcept');

// ========================================
// ECONOMY (Simplified CorpsCoin System)
// Earning: Shows, League Wins, Season Bonus
// Spending: Class Unlocks, League Entry Fees
// ========================================

export const unlockClassWithCorpsCoin = httpsCallable(functions, 'unlockClassWithCorpsCoin');
export const getCorpsCoinHistory = httpsCallable(functions, 'getCorpsCoinHistory');
export const getEarningOpportunities = httpsCallable(functions, 'getEarningOpportunities');

// ========================================
// CORPS MANAGEMENT
// ========================================

export const retireCorps = httpsCallable(functions, 'retireCorps');
export const unretireCorps = httpsCallable(functions, 'unretireCorps');

// ========================================
// DAILY OPERATIONS
// ========================================

export const claimDailyLogin = httpsCallable(functions, 'claimDailyLogin');

// ========================================
// LEADERBOARDS
// ========================================

export const updateLifetimeLeaderboard = httpsCallable(functions, 'updateLifetimeLeaderboard');

// ========================================
// SOCIAL & LEAGUES
// ========================================

export const createLeague = httpsCallable(functions, 'createLeague');
export const joinLeague = httpsCallable(functions, 'joinLeague');
export const leaveLeague = httpsCallable(functions, 'leaveLeague');
export const generateMatchups = httpsCallable(functions, 'generateMatchups');
export const updateMatchupResults = httpsCallable(functions, 'updateMatchupResults');
export const postLeagueMessage = httpsCallable(functions, 'postLeagueMessage');
export const updateProfile = httpsCallable(functions, 'updateProfile');
export const getPublicProfile = httpsCallable(functions, 'getPublicProfile');
export const sendCommentNotification = httpsCallable(functions, 'sendCommentNotification');
export const deleteComment = httpsCallable(functions, 'deleteComment');
export const reportComment = httpsCallable(functions, 'reportComment');

// ========================================
// ADMIN
// ========================================

export const startNewOffSeason = httpsCallable(functions, 'startNewOffSeason');
export const startNewLiveSeason = httpsCallable(functions, 'startNewLiveSeason');
export const manualTrigger = httpsCallable(functions, 'manualTrigger');
export const sendTestEmail = httpsCallable(functions, 'sendTestEmail');
export const triggerDailyNews = httpsCallable(functions, 'triggerDailyNews');