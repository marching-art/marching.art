const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { dciHallOfFameStaff } = require("../data/dci_hall_of_fame");

/**
 * Admin function to initialize the staff database with DCI Hall of Fame members
 * This should only be run once during setup or when adding new staff
 */
exports.initializeStaffDatabase = functions.https.onCall(async (data, context) => {
  // Verify admin access
  if (!context.auth || !context.auth.token.admin) {
    throw new functions.https.HttpsError(
      "permission-denied", 
      "This function requires administrator privileges."
    );
  }

  try {
    const batch = admin.firestore().batch();
    let staffCount = 0;

    // Clear existing staff (optional - remove this if you want to preserve existing data)
    const existingStaffQuery = await admin.firestore().collection('staff').get();
    existingStaffQuery.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    // Add all Hall of Fame staff members
    dciHallOfFameStaff.forEach(staffMember => {
      const staffRef = admin.firestore().collection('staff').doc();
      batch.set(staffRef, {
        ...staffMember,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        isActive: true,
        totalPurchases: 0,
        averageRating: 0
      });
      staffCount++;
    });

    // Commit the batch
    await batch.commit();

    // Log the operation
    console.log(`Successfully initialized staff database with ${staffCount} staff members`);

    return {
      success: true,
      message: `Successfully initialized staff database with ${staffCount} staff members`,
      staffCount: staffCount,
      captions: [...new Set(dciHallOfFameStaff.map(s => s.caption))]
    };

  } catch (error) {
    console.error("Error initializing staff database:", error);
    throw new functions.https.HttpsError(
      "internal", 
      "An error occurred while initializing the staff database."
    );
  }
});

/**
 * Admin function to add a single staff member
 */
exports.addStaffMember = functions.https.onCall(async (data, context) => {
  // Verify admin access
  if (!context.auth || !context.auth.token.admin) {
    throw new functions.https.HttpsError(
      "permission-denied", 
      "This function requires administrator privileges."
    );
  }

  const { name, caption, yearInducted, biography, achievements, specialties } = data;

  // Validation
  if (!name || !caption || !yearInducted || !biography) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Name, caption, year inducted, and biography are required."
    );
  }

  const validCaptions = [
    "GE1", "GE2", "Visual Proficiency", "Visual Analysis", 
    "Color Guard", "Brass", "Music Analysis", "Percussion"
  ];

  if (!validCaptions.includes(caption)) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Invalid caption. Must be one of: " + validCaptions.join(", ")
    );
  }

  try {
    const staffRef = admin.firestore().collection('staff').doc();
    
    await staffRef.set({
      name: name.trim(),
      caption: caption,
      yearInducted: parseInt(yearInducted),
      biography: biography.trim(),
      achievements: achievements || [],
      specialties: specialties || [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      isActive: true,
      totalPurchases: 0,
      averageRating: 0
    });

    console.log(`Successfully added staff member: ${name}`);

    return {
      success: true,
      message: `Successfully added ${name} to the staff database`,
      staffId: staffRef.id
    };

  } catch (error) {
    console.error("Error adding staff member:", error);
    throw new functions.https.HttpsError(
      "internal", 
      "An error occurred while adding the staff member."
    );
  }
});

/**
 * Admin function to get staff statistics
 */
exports.getStaffStatistics = functions.https.onCall(async (data, context) => {
  // Verify admin access
  if (!context.auth || !context.auth.token.admin) {
    throw new functions.https.HttpsError(
      "permission-denied", 
      "This function requires administrator privileges."
    );
  }

  try {
    const staffSnapshot = await admin.firestore().collection('staff').get();
    
    const stats = {
      totalStaff: staffSnapshot.size,
      byCaptions: {},
      byDecade: {},
      totalPurchases: 0,
      activeListings: 0
    };

    staffSnapshot.docs.forEach(doc => {
      const staff = doc.data();
      
      // Count by caption
      stats.byCaptions[staff.caption] = (stats.byCaptions[staff.caption] || 0) + 1;
      
      // Count by decade
      const decade = Math.floor(staff.yearInducted / 10) * 10;
      stats.byDecade[`${decade}s`] = (stats.byDecade[`${decade}s`] || 0) + 1;
      
      // Sum total purchases
      stats.totalPurchases += staff.totalPurchases || 0;
    });

    // Get marketplace statistics
    const marketplaceSnapshot = await admin.firestore()
      .collection('staff_marketplace')
      .where('isActive', '==', true)
      .get();
    
    stats.activeListings = marketplaceSnapshot.size;

    return {
      success: true,
      statistics: stats
    };

  } catch (error) {
    console.error("Error getting staff statistics:", error);
    throw new functions.https.HttpsError(
      "internal", 
      "An error occurred while fetching staff statistics."
    );
  }
});