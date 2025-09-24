// src/utils/api.js - Updated with user profile management functions
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

// This file centralizes all Firebase Cloud Function calls.

// User Functions
export const checkUsername = (data) => httpsCallable(functions, 'checkUsername')(data);
export const createUserProfile = (data) => httpsCallable(functions, 'createUserProfile')(data);
export const updateUserProfile = (data) => httpsCallable(functions, 'updateUserProfile')(data);
export const getShowRegistrations = (data) => httpsCallable(functions, 'getShowRegistrations')(data);
export const getUserRankings = (data) => httpsCallable(functions, 'getUserRankings')(data);

// Lineup & Corps Functions
export const validateAndSaveLineup = (data) => httpsCallable(functions, 'validateAndSaveLineup')(data);
export const selectUserShows = (data) => httpsCallable(functions, 'selectUserShows')(data);

// Registration Status Function
export const getRegistrationStatus = () => httpsCallable(functions, 'getRegistrationStatus')();

// League Functions
export const createLeague = (data) => httpsCallable(functions, 'createLeague')(data);
export const joinLeague = (data) => httpsCallable(functions, 'joinLeague')(data);
export const leaveLeague = (data) => httpsCallable(functions, 'leaveLeague')(data);

// Comment & Notification Functions
export const sendCommentNotification = (data) => httpsCallable(functions, 'sendCommentNotification')(data);
export const deleteComment = (data) => httpsCallable(functions, 'deleteComment')(data);
export const reportComment = (data) => httpsCallable(functions, 'reportComment')(data);

// Admin Functions
export const setUserRole = (data) => httpsCallable(functions, 'setUserRole')(data);
export const startNewOffSeason = () => httpsCallable(functions, 'startNewOffSeason')();
export const startNewLiveSeason = () => httpsCallable(functions, 'startNewLiveSeason')();
export const manualTrigger = (data) => httpsCallable(functions, 'manualTrigger')(data);
export const migrateUserProfiles = () => httpsCallable(functions, 'migrateUserProfiles')();