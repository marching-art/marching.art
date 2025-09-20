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
        
        // Create date in Eastern timezone to match drum corps schedule
        const startInET = new Date(baseDate.toLocaleString("en-US", {timeZone: DRUM_CORPS_TIMEZONE}));
        
        // Add the day offset
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
        const today = new Date();
        const targetDate = date instanceof Date ? date : date.toDate();
        
        // Compare dates in Eastern timezone
        const todayInET = new Date(today.toLocaleString("en-US", {timeZone: DRUM_CORPS_TIMEZONE}));
        const targetInET = new Date(targetDate.toLocaleString("en-US", {timeZone: DRUM_CORPS_TIMEZONE}));
        
        return todayInET.toDateString() === targetInET.toDateString();
    } catch (error) {
        console.error('Error checking if date is today:', error);
        return false;
    }
};

/**
 * Check if a date is in the past in the target timezone
 */
export const isPastDate = (date) => {
    if (!date) return false;
    
    try {
        const today = new Date();
        const targetDate = date instanceof Date ? date : date.toDate();
        
        // Compare dates in Eastern timezone
        const todayInET = new Date(today.toLocaleString("en-US", {timeZone: DRUM_CORPS_TIMEZONE}));
        const targetInET = new Date(targetDate.toLocaleString("en-US", {timeZone: DRUM_CORPS_TIMEZONE}));
        
        // Set time to start of day for accurate comparison
        todayInET.setHours(0, 0, 0, 0);
        targetInET.setHours(0, 0, 0, 0);
        
        return targetInET < todayInET;
    } catch (error) {
        console.error('Error checking if date is past:', error);
        return false;
    }
};

/**
 * Check if a date is in the future in the target timezone
 */
export const isFutureDate = (date) => {
    if (!date) return false;
    
    try {
        const today = new Date();
        const targetDate = date instanceof Date ? date : date.toDate();
        
        // Compare dates in Eastern timezone
        const todayInET = new Date(today.toLocaleString("en-US", {timeZone: DRUM_CORPS_TIMEZONE}));
        const targetInET = new Date(targetDate.toLocaleString("en-US", {timeZone: DRUM_CORPS_TIMEZONE}));
        
        // Set time to start of day for accurate comparison
        todayInET.setHours(0, 0, 0, 0);
        targetInET.setHours(0, 0, 0, 0);
        
        return targetInET > todayInET;
    } catch (error) {
        console.error('Error checking if date is future:', error);
        return false;
    }
};

/**
 * Get the current day number for the season
 */
export const getCurrentDayNumber = (seasonStartDate) => {
    if (!seasonStartDate) return 0;
    
    try {
        const startDate = seasonStartDate instanceof Date ? seasonStartDate : seasonStartDate.toDate();
        const now = new Date();
        
        // Calculate in Eastern timezone
        const startInET = new Date(startDate.toLocaleString("en-US", {timeZone: DRUM_CORPS_TIMEZONE}));
        const nowInET = new Date(now.toLocaleString("en-US", {timeZone: DRUM_CORPS_TIMEZONE}));
        
        const diffInMillis = nowInET.getTime() - startInET.getTime();
        const diffInDays = Math.floor(diffInMillis / (1000 * 60 * 60 * 24));
        
        return Math.max(1, diffInDays + 1);
    } catch (error) {
        console.error('Error calculating current day number:', error);
        return 1;
    }
};

/**
 * Get the week number for a given day
 */
export const getWeekNumber = (dayNumber) => {
    return Math.ceil(dayNumber / 7);
};

/**
 * Get days remaining until a specific date
 */
export const getDaysUntil = (targetDate) => {
    if (!targetDate) return null;
    
    try {
        const now = new Date();
        const target = targetDate instanceof Date ? targetDate : targetDate.toDate();
        
        // Calculate in Eastern timezone
        const nowInET = new Date(now.toLocaleString("en-US", {timeZone: DRUM_CORPS_TIMEZONE}));
        const targetInET = new Date(target.toLocaleString("en-US", {timeZone: DRUM_CORPS_TIMEZONE}));
        
        // Set to start of day for accurate comparison
        nowInET.setHours(0, 0, 0, 0);
        targetInET.setHours(0, 0, 0, 0);
        
        const diffInMillis = targetInET.getTime() - nowInET.getTime();
        const diffInDays = Math.ceil(diffInMillis / (1000 * 60 * 60 * 24));
        
        return diffInDays;
    } catch (error) {
        console.error('Error calculating days until date:', error);
        return null;
    }
};

/**
 * Format time remaining until an event
 */
export const formatTimeUntil = (targetDate) => {
    const days = getDaysUntil(targetDate);
    
    if (days === null) return '';
    if (days < 0) return 'Past event';
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    if (days <= 7) return `${days} days`;
    if (days <= 30) return `${Math.ceil(days / 7)} weeks`;
    
    return `${Math.ceil(days / 30)} months`;
};

/**
 * Get a date range string for display
 */
export const formatDateRange = (startDate, endDate, options = {}) => {
    if (!startDate) return '';
    
    const { compact = false } = options;
    
    try {
        const start = startDate instanceof Date ? startDate : startDate.toDate();
        const end = endDate ? (endDate instanceof Date ? endDate : endDate.toDate()) : null;
        
        if (!end || start.toDateString() === end.toDateString()) {
            return formatDate(start, { compact, includeDay: true });
        }
        
        const startFormatted = formatDate(start, { compact, includeDay: true });
        const endFormatted = formatDate(end, { compact, includeDay: true });
        
        return `${startFormatted} - ${endFormatted}`;
    } catch (error) {
        console.error('Error formatting date range:', error);
        return '';
    }
};

/**
 * Create a calendar date object with proper timezone handling
 */
export const createCalendarDate = (year, month, day) => {
    try {
        // Create date in Eastern timezone
        const date = new Date();
        date.setFullYear(year, month - 1, day);
        date.setHours(12, 0, 0, 0); // Set to noon to avoid timezone edge cases
        
        return date;
    } catch (error) {
        console.error('Error creating calendar date:', error);
        return new Date();
    }
};

/**
 * Parse a date string with timezone awareness
 */
export const parseDate = (dateString) => {
    if (!dateString) return null;
    
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return null;
        
        return date;
    } catch (error) {
        console.error('Error parsing date:', error);
        return null;
    }
};

/**
 * Get the season progress as a percentage
 */
export const getSeasonProgress = (startDate, endDate, currentDay = null) => {
    if (!startDate || !endDate) return 0;
    
    try {
        const start = startDate instanceof Date ? startDate : startDate.toDate();
        const end = endDate instanceof Date ? endDate : endDate.toDate();
        const current = currentDay ? 
            getLocalCalendarDate(start, currentDay) : 
            new Date();
        
        if (!current) return 0;
        
        const totalDuration = end.getTime() - start.getTime();
        const elapsed = current.getTime() - start.getTime();
        
        if (elapsed < 0) return 0;
        if (elapsed > totalDuration) return 100;
        
        return Math.round((elapsed / totalDuration) * 100);
    } catch (error) {
        console.error('Error calculating season progress:', error);
        return 0;
    }
};

/**
 * Convert a day number to a calendar date for display
 */
export const dayNumberToCalendarDate = (dayNumber, seasonStartDate) => {
    return getLocalCalendarDate(seasonStartDate, dayNumber);
};

/**
 * Convert a calendar date to a day number
 */
export const calendarDateToDayNumber = (date, seasonStartDate) => {
    if (!date || !seasonStartDate) return null;
    
    try {
        const targetDate = date instanceof Date ? date : date.toDate();
        const startDate = seasonStartDate instanceof Date ? seasonStartDate : seasonStartDate.toDate();
        
        // Calculate in Eastern timezone
        const targetInET = new Date(targetDate.toLocaleString("en-US", {timeZone: DRUM_CORPS_TIMEZONE}));
        const startInET = new Date(startDate.toLocaleString("en-US", {timeZone: DRUM_CORPS_TIMEZONE}));
        
        const diffInMillis = targetInET.getTime() - startInET.getTime();
        const diffInDays = Math.floor(diffInMillis / (1000 * 60 * 60 * 24));
        
        return diffInDays + 1;
    } catch (error) {
        console.error('Error converting calendar date to day number:', error);
        return null;
    }
};

/**
 * Get timezone-aware event time
 */
export const getEventTime = (date, timeString = '8:00 PM') => {
    if (!date) return null;
    
    try {
        const eventDate = date instanceof Date ? date : date.toDate();
        const [time, period] = timeString.split(' ');
        const [hours, minutes] = time.split(':').map(Number);
        
        let hour24 = hours;
        if (period === 'PM' && hours !== 12) hour24 += 12;
        if (period === 'AM' && hours === 12) hour24 = 0;
        
        const eventTime = new Date(eventDate);
        eventTime.setHours(hour24, minutes, 0, 0);
        
        return eventTime;
    } catch (error) {
        console.error('Error getting event time:', error);
        return null;
    }
};

/**
 * Check if an event is happening now
 */
export const isEventLive = (date, startTime = '8:00 PM', duration = 3) => {
    const eventStart = getEventTime(date, startTime);
    if (!eventStart) return false;
    
    const now = new Date();
    const eventEnd = new Date(eventStart.getTime() + (duration * 60 * 60 * 1000));
    
    return now >= eventStart && now <= eventEnd;
};

/**
 * Format a date to a simple string (YYYY-MM-DD)
 */
export const formatDateSimple = (date) => {
    if (!date) return '';
    
    try {
        const targetDate = date instanceof Date ? date : date.toDate();
        return targetDate.toISOString().split('T')[0];
    } catch (error) {
        console.error('Error formatting date simply:', error);
        return '';
    }
};

/**
 * Get the start and end dates for a given week
 */
export const getWeekDateRange = (weekNumber, seasonStartDate) => {
    if (!seasonStartDate || weekNumber < 1) return null;
    
    try {
        const startDay = (weekNumber - 1) * 7 + 1;
        const endDay = weekNumber * 7;
        
        const weekStart = getLocalCalendarDate(seasonStartDate, startDay);
        const weekEnd = getLocalCalendarDate(seasonStartDate, endDay);
        
        return { start: weekStart, end: weekEnd };
    } catch (error) {
        console.error('Error getting week date range:', error);
        return null;
    }
};

/**
 * Check if a date falls within a specific week
 */
export const isDateInWeek = (date, weekNumber, seasonStartDate) => {
    const weekRange = getWeekDateRange(weekNumber, seasonStartDate);
    if (!weekRange || !date) return false;
    
    try {
        const targetDate = date instanceof Date ? date : date.toDate();
        return targetDate >= weekRange.start && targetDate <= weekRange.end;
    } catch (error) {
        console.error('Error checking if date is in week:', error);
        return false;
    }
};

/**
 * Get a user-friendly relative time string
 */
export const getRelativeTimeString = (date) => {
    if (!date) return '';
    
    try {
        const targetDate = date instanceof Date ? date : date.toDate();
        const now = new Date();
        const diffInMillis = targetDate.getTime() - now.getTime();
        const diffInDays = Math.floor(diffInMillis / (1000 * 60 * 60 * 24));
        const diffInHours = Math.floor(diffInMillis / (1000 * 60 * 60));
        const diffInMinutes = Math.floor(diffInMillis / (1000 * 60));
        
        if (Math.abs(diffInDays) >= 1) {
            if (diffInDays > 0) {
                return diffInDays === 1 ? 'Tomorrow' : `In ${diffInDays} days`;
            } else {
                return Math.abs(diffInDays) === 1 ? 'Yesterday' : `${Math.abs(diffInDays)} days ago`;
            }
        } else if (Math.abs(diffInHours) >= 1) {
            if (diffInHours > 0) {
                return `In ${diffInHours} hour${diffInHours === 1 ? '' : 's'}`;
            } else {
                return `${Math.abs(diffInHours)} hour${Math.abs(diffInHours) === 1 ? '' : 's'} ago`;
            }
        } else if (Math.abs(diffInMinutes) >= 1) {
            if (diffInMinutes > 0) {
                return `In ${diffInMinutes} minute${diffInMinutes === 1 ? '' : 's'}`;
            } else {
                return `${Math.abs(diffInMinutes)} minute${Math.abs(diffInMinutes) === 1 ? '' : 's'} ago`;
            }
        } else {
            return 'Now';
        }
    } catch (error) {
        console.error('Error getting relative time string:', error);
        return '';
    }
};

/**
 * Utility to safely handle date operations
 */
export const safeDate = (dateInput) => {
    if (!dateInput) return null;
    
    try {
        if (dateInput instanceof Date) {
            return isNaN(dateInput.getTime()) ? null : dateInput;
        }
        
        if (dateInput.toDate && typeof dateInput.toDate === 'function') {
            return dateInput.toDate();
        }
        
        const parsed = new Date(dateInput);
        return isNaN(parsed.getTime()) ? null : parsed;
    } catch (error) {
        console.error('Error creating safe date:', error);
        return null;
    }
};