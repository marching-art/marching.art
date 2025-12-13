// =============================================================================
// FIREBASE CLOUD FUNCTIONS
// =============================================================================
// Typed wrappers for all Firebase Cloud Functions
// Usage: import { registerCorps, dailyRehearsal } from '@/api/functions';

import { httpsCallable, HttpsCallableResult } from 'firebase/functions';
import { functions } from './client';

// =============================================================================
// TYPE HELPERS
// =============================================================================

/**
 * Create a typed callable function wrapper
 */
function createCallable<TData = void, TResult = unknown>(name: string) {
  const callable = httpsCallable<TData, TResult>(functions, name);
  return async (data?: TData): Promise<HttpsCallableResult<TResult>> => {
    return callable(data as TData);
  };
}

// =============================================================================
// USER MANAGEMENT
// =============================================================================

export const checkUsername = createCallable<{ username: string }, { available: boolean }>('checkUsername');
export const createUserProfile = createCallable<{ username: string; displayName?: string }, void>('createUserProfile');
export const setUserRole = createCallable<{ uid: string; role: string }, void>('setUserRole');
export const getShowRegistrations = createCallable<{ showId: string }, unknown>('getShowRegistrations');
export const getUserRankings = createCallable<{ uid: string }, unknown>('getUserRankings');
// Renamed to avoid conflict with profile.ts updateProfile (local Firestore)
export const updateProfileCF = createCallable<{ displayName?: string; bio?: string }, void>('updateProfile');
export const getPublicProfile = createCallable<{ uid: string }, unknown>('getPublicProfile');

// =============================================================================
// CORPS & LINEUP
// =============================================================================

export interface RegisterCorpsData {
  corpsName: string;
  location: string;
  showConcept: string;
  corpsClass: 'soundSport' | 'aClass' | 'open' | 'world';
}

export const registerCorps = createCallable<RegisterCorpsData, { success: boolean }>('registerCorps');
export const saveLineup = createCallable<{ corpsClass: string; lineup: Record<string, string> }, void>('saveLineup');
export const selectUserShows = createCallable<{ corpsClass: string; showIds: string[] }, void>('selectUserShows');
export const validateAndSaveLineup = createCallable<{ corpsClass: string; lineup: unknown }, { valid: boolean }>('validateAndSaveLineup');
export const saveShowConcept = createCallable<{ corpsClass: string; showConcept: string }, void>('saveShowConcept');

// =============================================================================
// CORPS MANAGEMENT
// =============================================================================

export interface RetireCorpsData {
  corpsClass: string;
  corpsName: string;
}

export const retireCorps = createCallable<RetireCorpsData, { success: boolean }>('retireCorps');
export const unretireCorps = createCallable<{ corpsClass: string }, { success: boolean }>('unretireCorps');

// =============================================================================
// ECONOMY
// =============================================================================

export const unlockClassWithCorpsCoin = createCallable<{ corpsClass: string }, { success: boolean }>('unlockClassWithCorpsCoin');

// =============================================================================
// EXECUTION SYSTEM
// =============================================================================

export interface RehearsalData {
  corpsClass: string;
}

export interface RehearsalResult {
  success: boolean;
  readinessGain: number;
  moraleChange: number;
  newReadiness: number;
  newMorale: number;
}

export const dailyRehearsal = createCallable<RehearsalData, RehearsalResult>('dailyRehearsal');
export const repairEquipment = createCallable<{ corpsClass: string; equipmentType: string }, { success: boolean }>('repairEquipment');
export const upgradeEquipment = createCallable<{ corpsClass: string; equipmentType: string }, { success: boolean }>('upgradeEquipment');
export const setShowDifficulty = createCallable<{ corpsClass: string; difficulty: number }, void>('setShowDifficulty');
export const boostMorale = createCallable<{ corpsClass: string }, { success: boolean; newMorale: number }>('boostMorale');
export const getExecutionStatus = createCallable<{ corpsClass: string }, unknown>('getExecutionStatus');

// =============================================================================
// BATTLE PASS
// =============================================================================

export const purchaseBattlePass = createCallable<void, { success: boolean }>('purchaseBattlePass');
export const claimBattlePassReward = createCallable<{ rewardId: string }, { success: boolean }>('claimBattlePassReward');
export const getBattlePassProgress = createCallable<void, unknown>('getBattlePassProgress');
export const getAvailableRewards = createCallable<void, unknown>('getAvailableRewards');
export const awardXP = createCallable<{ amount: number; reason: string }, { newXP: number; newLevel: number }>('awardXP');

// =============================================================================
// DAILY OPERATIONS
// =============================================================================

export const claimDailyLogin = createCallable<void, { success: boolean; loginStreak: number }>('claimDailyLogin');

// =============================================================================
// LEADERBOARDS
// =============================================================================

export const updateLifetimeLeaderboard = createCallable<void, { success: boolean }>('updateLifetimeLeaderboard');

// =============================================================================
// SOCIAL & LEAGUES
// =============================================================================

export interface CreateLeagueData {
  name: string;
  description: string;
  isPublic: boolean;
  maxMembers: number;
}

// Note: createLeague, joinLeague, leaveLeague are in leagues.ts with higher-level wrappers
// These raw CF exports are available with CF suffix if needed
export const createLeagueCF = createCallable<CreateLeagueData, { leagueId: string }>('createLeague');
export const joinLeagueCF = createCallable<{ leagueId: string } | { inviteCode: string }, { success: boolean }>('joinLeague');
export const leaveLeagueCF = createCallable<{ leagueId: string }, { success: boolean }>('leaveLeague');
export const generateMatchups = createCallable<{ leagueId: string }, { matchups: unknown[] }>('generateMatchups');
export const updateMatchupResults = createCallable<{ matchupId: string; results: unknown }, void>('updateMatchupResults');
export const postLeagueMessageCF = createCallable<{ leagueId: string; message: string }, { messageId: string }>('postLeagueMessage');
export const sendCommentNotification = createCallable<{ targetUid: string; commentId: string }, void>('sendCommentNotification');
export const deleteComment = createCallable<{ commentId: string }, { success: boolean }>('deleteComment');
export const reportComment = createCallable<{ commentId: string; reason: string }, { success: boolean }>('reportComment');

// =============================================================================
// ADMIN
// =============================================================================

export const startNewOffSeason = createCallable<{ seasonNumber: number }, { success: boolean }>('startNewOffSeason');
export const startNewLiveSeason = createCallable<{ year: number }, { success: boolean }>('startNewLiveSeason');
export const manualTrigger = createCallable<{ action: string; params?: unknown }, { success: boolean }>('manualTrigger');
export const initializeBattlePassSeason = createCallable<{ seasonId: string }, { success: boolean }>('initializeBattlePassSeason');
