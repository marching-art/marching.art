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
// ECONOMY
// ========================================

export const unlockClassWithCorpsCoin = httpsCallable(functions, 'unlockClassWithCorpsCoin');
export const purchaseStaff = httpsCallable(functions, 'purchaseStaff');
export const assignStaff = httpsCallable(functions, 'assignStaff');
export const getStaffMarketplace = httpsCallable(functions, 'getStaffMarketplace');

// ========================================
// EXECUTION SYSTEM
// ========================================

export const dailyRehearsal = httpsCallable(functions, 'dailyRehearsal');
export const repairEquipment = httpsCallable(functions, 'repairEquipment');
export const upgradeEquipment = httpsCallable(functions, 'upgradeEquipment');
export const setShowDifficulty = httpsCallable(functions, 'setShowDifficulty');
export const boostMorale = httpsCallable(functions, 'boostMorale');
export const getExecutionStatus = httpsCallable(functions, 'getExecutionStatus');

// ========================================
// BATTLE PASS
// ========================================

export const purchaseBattlePass = httpsCallable(functions, 'purchaseBattlePass');
export const claimBattlePassReward = httpsCallable(functions, 'claimBattlePassReward');
export const getBattlePassProgress = httpsCallable(functions, 'getBattlePassProgress');
export const getAvailableRewards = httpsCallable(functions, 'getAvailableRewards');
export const awardXP = httpsCallable(functions, 'awardXP');

// ========================================
// SOCIAL & LEAGUES
// ========================================

export const createLeague = httpsCallable(functions, 'createLeague');
export const joinLeague = httpsCallable(functions, 'joinLeague');
export const leaveLeague = httpsCallable(functions, 'leaveLeague');
export const generateMatchups = httpsCallable(functions, 'generateMatchups');
export const updateMatchupResults = httpsCallable(functions, 'updateMatchupResults');
export const proposeStaffTrade = httpsCallable(functions, 'proposeStaffTrade');
export const respondToStaffTrade = httpsCallable(functions, 'respondToStaffTrade');
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