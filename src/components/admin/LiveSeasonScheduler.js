const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions/v2");
const { getDb } = require("../../config");

/**
 * Live Season Scheduler - Handles real-time DCI season events
 * Runs daily during live season to sync with actual DCI schedule
 */
exports.liveSeasonScheduler = onSchedule({
    schedule: "every day 06:00",
    timeZone: "America/New_York",
}, async () => {
    logger.info("Running Live Season Scheduler...");
    
    try {
        const db = getDb();
        
        // Check if we have an active live season
        const seasonDoc = await db.doc("game-settings/season").get();
        
        if (!seasonDoc.exists) {
            logger.info("No active season found. Skipping live season processing.");
            return;
        }
        
        const seasonData = seasonDoc.data();
        
        if (seasonData.status !== "live-season") {
            logger.info(`Current season status is "${seasonData.status}". Live season scheduler only runs during live seasons.`);
            return;
        }
        
        // Check if live season template exists, create if missing
        await ensureLiveSeasonTemplate(db);
        
        // Process today's live events
        await processLiveSeasonDay(db, seasonData);
        
        logger.info("Live Season Scheduler completed successfully");
        
    } catch (error) {
        logger.error("Error in Live Season Scheduler:", error);
        // Don't throw - we want the scheduler to continue running
    }
});

/**
 * Ensure live season template document exists
 */
const ensureLiveSeasonTemplate = async (db) => {
    try {
        const templateDoc = await db.doc("templates/live-season").get();
        
        if (!templateDoc.exists) {
            logger.info("Live season template document does not exist. Creating default template...");
            
            // Create default live season template
            const defaultTemplate = {
                name: "Live Season Template",
                description: "Template for live DCI season events",
                eventTypes: [
                    {
                        name: "DCI Regional",
                        duration: 240, // 4 hours
                        startTime: "19:00",
                        classRestrictions: ["worldClass", "openClass", "aClass"]
                    },
                    {
                        name: "DCI Major",
                        duration: 300, // 5 hours  
                        startTime: "18:00",
                        classRestrictions: ["worldClass", "openClass", "aClass"]
                    },
                    {
                        name: "DCI Championship",
                        duration: 360, // 6 hours
                        startTime: "17:00", 
                        classRestrictions: ["worldClass", "openClass", "aClass"]
                    }
                ],
                venues: [
                    "Lucas Oil Stadium, Indianapolis, IN",
                    "Stanford Stadium, Palo Alto, CA", 
                    "Mercedes-Benz Stadium, Atlanta, GA",
                    "Rose Bowl, Pasadena, CA",
                    "Alamodome, San Antonio, TX"
                ],
                createdAt: new Date(),
                version: "1.0"
            };
            
            await db.doc("templates/live-season").set(defaultTemplate);
            logger.info("Created default live season template");
        } else {
            logger.info("Live season template found");
        }
        
    } catch (error) {
        logger.error("Error ensuring live season template:", error);
        throw error;
    }
};

/**
 * Process live season events for today
 */
const processLiveSeasonDay = async (db, seasonData) => {
    try {
        const today = new Date();
        const seasonStartDate = seasonData.schedule.startDate.toDate();
        
        // Calculate current day in live season
        const diffInMillis = today.getTime() - seasonStartDate.getTime();
        const currentDay = Math.floor(diffInMillis / (1000 * 60 * 60 * 24)) + 1;
        
        logger.info(`Processing live season day ${currentDay}`);
        
        // Sync with DCI data (or create placeholder events)
        const todaysEvents = await syncWithDCIData(db, currentDay);
        
        if (todaysEvents.length > 0) {
            // Update season events with today's data
            await updateSeasonEvents(db, seasonData, currentDay, todaysEvents);
            
            // Process live scores if events are happening
            await processLiveScores(db, todaysEvents);
            
            // Notify users about live events
            await notifyUsersOfLiveEvents(db, todaysEvents);
        }
        
        // Update last processed day
        await db.doc("game-settings/season").update({
            lastProcessedDay: currentDay,
            lastProcessedAt: new Date()
        });
        
        logger.info(`Live season day ${currentDay} processed successfully`);
        
    } catch (error) {
        logger.error("Error processing live season day:", error);
        throw error;
    }
};

/**
 * Sync with external DCI data (placeholder)
 * In production, this would integrate with DCI's API or data feeds
 */
const syncWithDCIData = async (db, currentDay) => {
    try {
        logger.info(`Syncing DCI data for day ${currentDay}`);
        
        // Check if today is a weekend (when most DCI events happen)
        const today = new Date();
        const dayOfWeek = today.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday
        
        if (!isWeekend) {
            logger.info("No DCI events typically scheduled on weekdays");
            return [];
        }
        
        // Placeholder for DCI API integration
        // This would fetch real event schedules, results, and scores
        const mockDCIEvents = [
            {
                eventName: `DCI Regional Championship`,
                location: "Lucas Oil Stadium, Indianapolis, IN",
                startTime: "19:00",
                duration: 240,
                classRestrictions: ["worldClass", "openClass", "aClass"],
                isLive: true,
                dciEventId: `dci-${currentDay}-${Date.now()}`,
                registrationCounts: {
                    worldClass: 0,
                    openClass: 0,
                    aClass: 0
                }
            }
        ];
        
        logger.info(`Found ${mockDCIEvents.length} DCI events for today`);
        return mockDCIEvents;
        
    } catch (error) {
        logger.error("Error syncing with DCI data:", error);
        return [];
    }
};

/**
 * Update season events with today's live data
 */
const updateSeasonEvents = async (db, seasonData, currentDay, todaysEvents) => {
    try {
        logger.info(`Updating season events for day ${currentDay}`);
        
        const events = seasonData.events || [];
        
        // Find or create today's event entry
        let todayEvent = events.find(e => e.dayIndex === currentDay);
        
        if (!todayEvent) {
            todayEvent = {
                dayIndex: currentDay,
                date: new Date(),
                shows: []
            };
            events.push(todayEvent);
        }
        
        // Update with live DCI data
        todayEvent.shows = todaysEvents;
        todayEvent.lastUpdated = new Date();
        todayEvent.isLive = true;
        
        // Save updated events
        await db.doc("game-settings/season").update({
            events: events,
            lastLiveUpdate: new Date()
        });
        
        logger.info("Season events updated with live data");
        
    } catch (error) {
        logger.error("Error updating season events:", error);
        throw error;
    }
};

/**
 * Process live scores and updates
 */
const processLiveScores = async (db, eventData) => {
    try {
        logger.info("Processing live scores...");
        
        // In production, this would:
        // 1. Fetch real-time scores from DCI
        // 2. Update user fantasy scores
        // 3. Send notifications for score updates
        // 4. Update leaderboards
        
        // For now, just log that we're processing
        logger.info(`Processing scores for ${eventData.length} live events`);
        
        // Placeholder for score processing logic
        const scorePromises = eventData.map(async (event) => {
            try {
                // This would fetch real scores from DCI API
                logger.info(`Processing scores for ${event.eventName}`);
                
                // Update live scores collection
                const scoreDoc = {
                    eventName: event.eventName,
                    location: event.location,
                    scoresLastUpdated: new Date(),
                    isLive: true,
                    // Real score data would go here
                    scores: []
                };
                
                await db.doc(`live_scores/${event.dciEventId}`).set(scoreDoc);
                
            } catch (error) {
                logger.error(`Error processing scores for ${event.eventName}:`, error);
            }
        });
        
        await Promise.allSettled(scorePromises);
        logger.info("Live scores processed successfully");
        
    } catch (error) {
        logger.error("Error processing live scores:", error);
        throw error;
    }
};

/**
 * Send notifications to users about live events
 */
const notifyUsersOfLiveEvents = async (db, events) => {
    try {
        if (!events || events.length === 0) return;
        
        logger.info(`Sending notifications for ${events.length} live events`);
        
        // Get users who have notification preferences enabled
        const usersSnapshot = await db.collection('artifacts/prod/users').get();
        const notificationPromises = [];
        
        usersSnapshot.forEach((userDoc) => {
            try {
                const userData = userDoc.data();
                const settings = userData.settings?.account;
                
                // Check if user wants live event notifications
                if (settings?.showNotifications !== false) {
                    events.forEach(event => {
                        const notification = {
                            type: 'show',
                            title: 'Live Event Starting Soon',
                            message: `${event.eventName} begins at ${event.startTime}`,
                            eventData: {
                                eventName: event.eventName,
                                location: event.location,
                                startTime: event.startTime
                            },
                            createdAt: new Date(),
                            read: false
                        };
                        
                        const notificationRef = db.doc(`artifacts/prod/users/${userDoc.id}/notifications/${event.dciEventId}`);
                        notificationPromises.push(notificationRef.set(notification));
                    });
                }
            } catch (error) {
                logger.error(`Error creating notification for user ${userDoc.id}:`, error);
            }
        });
        
        await Promise.allSettled(notificationPromises);
        logger.info(`Sent ${notificationPromises.length} live event notifications`);
        
    } catch (error) {
        logger.error("Error sending live event notifications:", error);
        throw error;
    }
};

/**
 * Cleanup old live data
 */
const cleanupOldLiveData = async (db) => {
    try {
        logger.info("Cleaning up old live data...");
        
        // Remove live scores older than 7 days
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 7);
        
        const oldScoresSnapshot = await db.collection('live_scores')
            .where('scoresLastUpdated', '<', cutoffDate)
            .get();
        
        const deletePromises = [];
        oldScoresSnapshot.forEach(doc => {
            deletePromises.push(doc.ref.delete());
        });
        
        await Promise.all(deletePromises);
        logger.info(`Cleaned up ${deletePromises.length} old live score documents`);
        
    } catch (error) {
        logger.error("Error cleaning up old live data:", error);
        // Don't throw - this is non-critical
    }
};

module.exports = {
    liveSeasonScheduler,
    ensureLiveSeasonTemplate,
    processLiveSeasonDay,
    syncWithDCIData,
    processLiveScores,
    notifyUsersOfLiveEvents,
    cleanupOldLiveData
};