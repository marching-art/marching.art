/**
 * Enhanced Date Utilities for Drum Corps Schedule System
 * Fixes timezone issues and provides consistent date handling
 */

// Target timezone for all drum corps events (Eastern Time)
const DRUM_CORPS_TIMEZONE = 'America/New_York';

/**
 * Get a local calendar date from a day offset, properly handling timezones
 * Fixes the 24-hour offset issue in the original implementation
 */
export const getLocalCalendarDate = (startDate, dayOffset) => {
    if (!startDate || typeof dayOffset !== 'number') return null;
    
    try {
        // Convert Firebase timestamp to Date if needed
        const baseDate = startDate instanceof Date ? startDate : startDate.toDate();
        
        // Create a new date at midnight in Eastern timezone
        const year = baseDate.getFullYear();
        const month = baseDate.getMonth();
        const date = baseDate.getDate();
        
        // Create the start date at midnight ET
        const startInET = new Date();
        startInET.setFullYear(year, month, date);
        startInET.setHours(0, 0, 0, 0);
        
        // Add the day offset (subtract 1 because day 1 = startDate)
        const targetDate = new Date(startInET);
        targetDate.setDate(targetDate.getDate() + dayOffset - 1);
        
        return targetDate;
    } catch (error) {
        console.error('Error calculating calendar date:', error);
        return null;
    }
};

/**
 * Format a date for display in the schedule
 */
export const formatDate = (date, options = {}) => {
    if (!date) return '';
    
    const {
        includeYear = false,
        includeDay = true,
        includeTime = false,
        compact = false
    } = options;
    
    try {
        const formatOptions = {
            timeZone: DRUM_CORPS_TIMEZONE,
            month: compact ? 'short' : 'long',
            day: 'numeric'
        };
        
        if (includeYear) {
            formatOptions.year = 'numeric';
        }
        
        if (includeDay) {
            formatOptions.weekday = compact ? 'short' : 'long';
        }
        
        if (includeTime) {
            formatOptions.hour = 'numeric';
            formatOptions.minute = '2-digit';
            formatOptions.hour12 = true;
        }
        
        return date.toLocaleDateString('en-US', formatOptions);
    } catch (error) {
        console.error('Error formatting date:', error);
        return date.toLocaleDateString();
    }
};

/**
 * Check if a date is today in the target timezone
 */
export const isToday = (date) => {
    if (!date) return false;
    
    try {
        const now = new Date();
        const targetDate = date instanceof Date ? date : new Date(date);
        
        // Compare dates in ET timezone
        const nowET = new Date(now.toLocaleString("en-US", {timeZone: DRUM_CORPS_TIMEZONE}));
        const targetET = new Date(targetDate.toLocaleString("en-US", {timeZone: DRUM_CORPS_TIMEZONE}));
        
        return nowET.toDateString() === targetET.toDateString();
    } catch (error) {
        console.error('Error checking if date is today:', error);
        return false;
    }
};

/**
 * Check if a date is in the past
 */
export const isPastDate = (date) => {
    if (!date) return false;
    
    try {
        const now = new Date();
        const targetDate = date instanceof Date ? date : new Date(date);
        
        // Compare dates in ET timezone, considering only the date part
        const nowET = new Date(now.toLocaleString("en-US", {timeZone: DRUM_CORPS_TIMEZONE}));
        const targetET = new Date(targetDate.toLocaleString("en-US", {timeZone: DRUM_CORPS_TIMEZONE}));
        
        nowET.setHours(0, 0, 0, 0);
        targetET.setHours(0, 0, 0, 0);
        
        return targetET < nowET;
    } catch (error) {
        console.error('Error checking if date is in past:', error);
        return false;
    }
};

/**
 * Check if a date is in the future
 */
export const isFutureDate = (date) => {
    if (!date) return false;
    
    try {
        const now = new Date();
        const targetDate = date instanceof Date ? date : new Date(date);
        
        // Compare dates in ET timezone, considering only the date part
        const nowET = new Date(now.toLocaleString("en-US", {timeZone: DRUM_CORPS_TIMEZONE}));
        const targetET = new Date(targetDate.toLocaleString("en-US", {timeZone: DRUM_CORPS_TIMEZONE}));
        
        nowET.setHours(0, 0, 0, 0);
        targetET.setHours(0, 0, 0, 0);
        
        return targetET > nowET;
    } catch (error) {
        console.error('Error checking if date is in future:', error);
        return false;
    }
};

/**
 * Check if an event is currently live (happening now)
 */
export const isEventLive = (eventDate, duration = 4) => {
    if (!eventDate) return false;
    
    try {
        const now = new Date();
        const startTime = new Date(eventDate);
        const endTime = new Date(eventDate);
        
        // Most drum corps events are 3-4 hours long
        // Start at 7 PM, end around 10-11 PM
        startTime.setHours(19, 0, 0, 0); // 7 PM ET
        endTime.setHours(19 + duration, 0, 0, 0); // 4 hours later
        
        const nowET = new Date(now.toLocaleString("en-US", {timeZone: DRUM_CORPS_TIMEZONE}));
        
        return nowET >= startTime && nowET <= endTime;
    } catch (error) {
        console.error('Error checking if event is live:', error);
        return false;
    }
};

/**
 * Format time until an event
 */
export const formatTimeUntil = (eventDate) => {
    if (!eventDate) return '';
    
    try {
        const now = new Date();
        const targetDate = new Date(eventDate);
        targetDate.setHours(19, 0, 0, 0); // Events start at 7 PM
        
        const diffInMillis = targetDate.getTime() - now.getTime();
        
        if (diffInMillis <= 0) return 'Event started';
        
        const days = Math.floor(diffInMillis / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diffInMillis % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diffInMillis % (1000 * 60 * 60)) / (1000 * 60));
        
        if (days > 0) {
            return `${days}d ${hours}h`;
        } else if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else {
            return `${minutes}m`;
        }
    } catch (error) {
        console.error('Error formatting time until event:', error);
        return '';
    }
};

/**
 * Get current season day based on start date
 */
export const getCurrentSeasonDay = (seasonStartDate) => {
    if (!seasonStartDate) return 1;
    
    try {
        const startDate = seasonStartDate instanceof Date ? seasonStartDate : seasonStartDate.toDate();
        const now = new Date();
        
        // Calculate in ET timezone
        const startET = new Date(startDate.toLocaleString("en-US", {timeZone: DRUM_CORPS_TIMEZONE}));
        const nowET = new Date(now.toLocaleString("en-US", {timeZone: DRUM_CORPS_TIMEZONE}));
        
        // Set to midnight for accurate day calculation
        startET.setHours(0, 0, 0, 0);
        nowET.setHours(0, 0, 0, 0);
        
        const diffInMillis = nowET.getTime() - startET.getTime();
        const dayNumber = Math.floor(diffInMillis / (1000 * 60 * 60 * 24)) + 1;
        
        return Math.max(1, dayNumber);
    } catch (error) {
        console.error('Error calculating current season day:', error);
        return 1;
    }
};

/**
 * Get the proper date display for schedule events
 * Fixes the 24-hour ahead/behind display issues
 */
export const getScheduleDisplayDate = (startDate, dayOffset) => {
    const eventDate = getLocalCalendarDate(startDate, dayOffset);
    if (!eventDate) return '';
    
    return formatDate(eventDate, { includeDay: true, compact: false });
};

/**
 * Helper to check if we should highlight an event as "today"
 */
export const shouldHighlightToday = (startDate, dayOffset) => {
    const eventDate = getLocalCalendarDate(startDate, dayOffset);
    return eventDate ? isToday(eventDate) : false;
};