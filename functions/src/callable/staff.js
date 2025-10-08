/**
 * Staff Management Functions
 * Handles staff purchases, assignments, and marketplace transactions
 * 
 * Location: functions/src/callable/staff.js
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { DATA_NAMESPACE, getFunctionConfig } = require("../../config");

/**
 * Calculate base value for staff members based on induction year
 */
function calculateBaseValue(yearInducted) {
  const currentYear = new Date().getFullYear();
  const yearsElapsed = currentYear - yearInducted;
  
  // More recent inductees are more valuable
  // Base value: 1000 for current year, decreasing by 50 per year
  const baseValue = Math.max(200, 1000 - (yearsElapsed * 50));
  return baseValue;
}

/**
 * Calculate current market value with experience bonus
 */
function calculateMarketValue(baseValue, seasonsCompleted = 0, performanceBonus = 0) {
  const experienceMultiplier = 1 + (seasonsCompleted * 0.1); // 10% increase per season
  const marketValue = Math.floor((baseValue * experienceMultiplier) + performanceBonus);
  return marketValue;
}

// ========================================
// CORE STAFF MANAGEMENT FUNCTIONS
// ========================================

/**
 * Get all available staff members from the hall of fame
 */
exports.getAvailableStaff = functions
  .runWith(getFunctionConfig('light'))
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "You must be logged in.");
    }

    const { caption } = data;

    try {
      let staffQuery = admin.firestore().collection('staff');
      
      // Filter by caption if provided
      if (caption) {
        staffQuery = staffQuery.where('caption', '==', caption);
      }

      const staffSnapshot = await staffQuery.orderBy('yearInducted', 'desc').get();
      
      const staffList = staffSnapshot.docs.map(doc => {
        const staffData = doc.data();
        const baseValue = calculateBaseValue(staffData.yearInducted);
        
        return {
          id: doc.id,
          name: staffData.name,
          caption: staffData.caption,
          yearInducted: staffData.yearInducted,
          biography: staffData.biography,
          baseValue: baseValue,
          currentMarketValue: calculateMarketValue(baseValue, 0, 0),
          achievements: staffData.achievements || []
        };
      });

      return {
        success: true,
        staff: staffList,
        totalCount: staffList.length
      };

    } catch (error) {
      console.error("Error fetching available staff:", error);
      throw new functions.https.HttpsError("internal", "An error occurred while fetching staff.");
    }
  });

/**
 * Purchase a staff member from the hall of fame database
 */
exports.purchaseStaffMember = functions
  .runWith(getFunctionConfig('standard'))
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "You must be logged in.");
    }

    const { staffId } = data;
    const uid = context.auth.uid;

    if (!staffId) {
      throw new functions.https.HttpsError("invalid-argument", "Staff ID is required.");
    }

    try {
      // Get the staff member details
      const staffRef = admin.firestore().doc(`staff/${staffId}`);
      const staffSnap = await staffRef.get();
      
      if (!staffSnap.exists) {
        throw new functions.https.HttpsError("not-found", "Staff member not found.");
      }

      const staffData = staffSnap.data();
      const baseValue = calculateBaseValue(staffData.yearInducted);

      // Get user profile to check CorpsCoin balance
      const userProfileRef = admin.firestore().doc(`artifacts/${DATA_NAMESPACE}/users/${uid}/profile/data`);
      const userSnap = await userProfileRef.get();
      
      if (!userSnap.exists) {
        throw new functions.https.HttpsError("not-found", "User profile not found.");
      }

      const userData = userSnap.data();
      const currentCorpsCoin = userData.corpsCoin || 0;

      if (currentCorpsCoin < baseValue) {
        throw new functions.https.HttpsError("failed-precondition", `Insufficient CorpsCoin. Need ${baseValue}, have ${currentCorpsCoin}.`);
      }

      // Check if user already owns this staff member
      const userStaffRef = admin.firestore().doc(`artifacts/${DATA_NAMESPACE}/users/${uid}/staff/${staffId}`);
      const existingStaff = await userStaffRef.get();
      
      if (existingStaff.exists) {
        throw new functions.https.HttpsError("already-exists", "You already own this staff member.");
      }

      // Execute the purchase transaction
      const batch = admin.firestore().batch();

      // Deduct CorpsCoin from user
      batch.update(userProfileRef, {
        corpsCoin: admin.firestore.FieldValue.increment(-baseValue),
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      });

      // Add staff member to user's collection
      batch.set(userStaffRef, {
        ...staffData,
        purchaseDate: admin.firestore.FieldValue.serverTimestamp(),
        purchasePrice: baseValue,
        seasonsCompleted: 0,
        performanceBonus: 0,
        currentValue: baseValue,
        isActive: false,
        assignedCaption: null,
        isListedForSale: false,
        marketplaceListingId: null
      });

      // Log the transaction
      const transactionRef = admin.firestore().collection(`corps_coin_transactions/${uid}/transactions`).doc();
      batch.set(transactionRef, {
        type: 'staff_purchase',
        amount: -baseValue,
        staffId: staffId,
        staffName: staffData.name,
        description: `Purchased ${staffData.name} (${staffData.caption}) from Hall of Fame`,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      await batch.commit();

      return {
        success: true,
        message: `Successfully purchased ${staffData.name} for ${baseValue} CorpsCoin!`,
        staff: {
          id: staffId,
          name: staffData.name,
          caption: staffData.caption,
          purchasePrice: baseValue
        },
        remainingCorpsCoin: currentCorpsCoin - baseValue
      };

    } catch (error) {
      console.error("Error purchasing staff member:", error);
      if (error.code && error.code.startsWith('functions/')) {
        throw error;
      }
      throw new functions.https.HttpsError("internal", "An error occurred while purchasing staff member.");
    }
  });

/**
 * Get user's owned staff members
 */
exports.getUserStaff = functions
  .runWith(getFunctionConfig('light'))
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "You must be logged in.");
    }

    const uid = context.auth.uid;

    try {
      const staffSnapshot = await admin.firestore()
        .collection(`artifacts/${DATA_NAMESPACE}/users/${uid}/staff`)
        .get();

      const staffList = staffSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      return {
        success: true,
        staff: staffList,
        totalCount: staffList.length
      };

    } catch (error) {
      console.error("Error fetching user staff:", error);
      throw new functions.https.HttpsError("internal", "An error occurred while fetching your staff.");
    }
  });

/**
 * Assign staff member to a caption
 */
exports.assignStaffToCaption = functions
  .runWith(getFunctionConfig('light'))
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "You must be logged in.");
    }

    const { staffId, caption } = data;
    const uid = context.auth.uid;

    if (!staffId || !caption) {
      throw new functions.https.HttpsError("invalid-argument", "Staff ID and caption are required.");
    }

    const validCaptions = ['GE1', 'GE2', 'Visual Proficiency', 'Visual Analysis', 'Color Guard', 'Brass', 'Music Analysis', 'Percussion'];
    if (!validCaptions.includes(caption)) {
      throw new functions.https.HttpsError("invalid-argument", "Invalid caption.");
    }

    try {
      const userStaffRef = admin.firestore().doc(`artifacts/${DATA_NAMESPACE}/users/${uid}/staff/${staffId}`);
      const staffSnap = await userStaffRef.get();
      
      if (!staffSnap.exists) {
        throw new functions.https.HttpsError("not-found", "Staff member not found in your collection.");
      }

      const staffData = staffSnap.data();

      await userStaffRef.update({
        isActive: true,
        assignedCaption: caption,
        assignedDate: admin.firestore.FieldValue.serverTimestamp()
      });

      return {
        success: true,
        message: `${staffData.name} has been assigned to ${caption}.`
      };

    } catch (error) {
      console.error("Error assigning staff to caption:", error);
      throw new functions.https.HttpsError("internal", "An error occurred while assigning staff member.");
    }
  });

/**
 * Unassign staff member from caption
 */
exports.unassignStaffFromCaption = functions
  .runWith(getFunctionConfig('light'))
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "You must be logged in.");
    }

    const { staffId } = data;
    const uid = context.auth.uid;

    if (!staffId) {
      throw new functions.https.HttpsError("invalid-argument", "Staff ID is required.");
    }

    try {
      const userStaffRef = admin.firestore().doc(`artifacts/${DATA_NAMESPACE}/users/${uid}/staff/${staffId}`);
      const staffSnap = await userStaffRef.get();
      
      if (!staffSnap.exists) {
        throw new functions.https.HttpsError("not-found", "Staff member not found in your collection.");
      }

      const staffData = staffSnap.data();

      await userStaffRef.update({
        isActive: false,
        assignedCaption: null,
        unassignedDate: admin.firestore.FieldValue.serverTimestamp()
      });

      return {
        success: true,
        message: `${staffData.name} has been removed from ${staffData.assignedCaption}.`
      };

    } catch (error) {
      console.error("Error unassigning staff from caption:", error);
      throw new functions.https.HttpsError("internal", "An error occurred while unassigning staff member.");
    }
  });

// ========================================
// MARKETPLACE FUNCTIONS
// ========================================

/**
 * List staff member for sale on the marketplace
 */
exports.sellStaffMember = functions
  .runWith(getFunctionConfig('standard'))
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "You must be logged in.");
    }

    const { staffId, askingPrice } = data;
    const uid = context.auth.uid;

    if (!staffId || !askingPrice || askingPrice < 1) {
      throw new functions.https.HttpsError("invalid-argument", "Staff ID and valid asking price are required.");
    }

    try {
      const userStaffRef = admin.firestore().doc(`artifacts/${DATA_NAMESPACE}/users/${uid}/staff/${staffId}`);
      const staffSnap = await userStaffRef.get();
      
      if (!staffSnap.exists) {
        throw new functions.https.HttpsError("not-found", "Staff member not found in your collection.");
      }

      const staffData = staffSnap.data();

      if (staffData.isActive) {
        throw new functions.https.HttpsError("failed-precondition", "Cannot sell an active staff member. Remove them from caption assignment first.");
      }

      if (staffData.isListedForSale) {
        throw new functions.https.HttpsError("failed-precondition", "Staff member is already listed for sale.");
      }

      // Get seller's display name
      const userProfileRef = admin.firestore().doc(`artifacts/${DATA_NAMESPACE}/users/${uid}/profile/data`);
      const userProfileSnap = await userProfileRef.get();
      const sellerName = userProfileSnap.exists ? (userProfileSnap.data().displayName || 'Anonymous') : 'Anonymous';

      // Create marketplace listing
      const listingRef = admin.firestore().collection('staff_marketplace').doc();
      const listingId = listingRef.id;

      const batch = admin.firestore().batch();

      batch.set(listingRef, {
        staffId: staffId,
        staffName: staffData.name,
        caption: staffData.caption,
        yearInducted: staffData.yearInducted,
        sellerId: uid,
        sellerName: sellerName,
        askingPrice: askingPrice,
        purchasePrice: staffData.purchasePrice || 0,
        seasonsCompleted: staffData.seasonsCompleted || 0,
        currentValue: staffData.currentValue || calculateBaseValue(staffData.yearInducted),
        isActive: true,
        listedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      batch.update(userStaffRef, {
        isListedForSale: true,
        marketplaceListingId: listingId
      });

      await batch.commit();

      return {
        success: true,
        message: `${staffData.name} has been listed for sale at ${askingPrice} CorpsCoin.`,
        listingId: listingId
      };

    } catch (error) {
      console.error("Error listing staff for sale:", error);
      if (error.code && error.code.startsWith('functions/')) {
        throw error;
      }
      throw new functions.https.HttpsError("internal", "An error occurred while listing staff member.");
    }
  });

/**
 * Purchase staff from marketplace
 */
exports.purchaseFromMarketplace = functions
  .runWith(getFunctionConfig('standard'))
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "You must be logged in.");
    }

    const { listingId } = data;
    const buyerId = context.auth.uid;

    if (!listingId) {
      throw new functions.https.HttpsError("invalid-argument", "Listing ID is required.");
    }

    try {
      const listingRef = admin.firestore().doc(`staff_marketplace/${listingId}`);
      const listingSnap = await listingRef.get();

      if (!listingSnap.exists) {
        throw new functions.https.HttpsError("not-found", "Listing not found.");
      }

      const listing = listingSnap.data();

      if (!listing.isActive) {
        throw new functions.https.HttpsError("failed-precondition", "This listing is no longer active.");
      }

      if (listing.sellerId === buyerId) {
        throw new functions.https.HttpsError("failed-precondition", "You cannot purchase your own listing.");
      }

      // Get buyer's profile
      const buyerProfileRef = admin.firestore().doc(`artifacts/${DATA_NAMESPACE}/users/${buyerId}/profile/data`);
      const buyerSnap = await buyerProfileRef.get();

      if (!buyerSnap.exists) {
        throw new functions.https.HttpsError("not-found", "Buyer profile not found.");
      }

      const buyerCorpsCoin = buyerSnap.data().corpsCoin || 0;

      if (buyerCorpsCoin < listing.askingPrice) {
        throw new functions.https.HttpsError("failed-precondition", `Insufficient CorpsCoin. Need ${listing.askingPrice}, have ${buyerCorpsCoin}.`);
      }

      // Execute transaction
      const batch = admin.firestore().batch();
      const marketplaceFee = Math.floor(listing.askingPrice * 0.1);
      const sellerProceeds = listing.askingPrice - marketplaceFee;

      // Transfer staff from seller to buyer
      const sellerStaffRef = admin.firestore().doc(`artifacts/${DATA_NAMESPACE}/users/${listing.sellerId}/staff/${listing.staffId}`);
      const buyerStaffRef = admin.firestore().doc(`artifacts/${DATA_NAMESPACE}/users/${buyerId}/staff/${listing.staffId}`);
      
      const staffSnap = await sellerStaffRef.get();
      if (!staffSnap.exists) {
        throw new functions.https.HttpsError("not-found", "Staff member no longer available.");
      }

      const staffData = staffSnap.data();

      // Remove from seller
      batch.delete(sellerStaffRef);

      // Add to buyer
      batch.set(buyerStaffRef, {
        ...staffData,
        purchaseDate: admin.firestore.FieldValue.serverTimestamp(),
        purchasePrice: listing.askingPrice,
        isListedForSale: false,
        marketplaceListingId: null,
        isActive: false,
        assignedCaption: null
      });

      // Update buyer's CorpsCoin
      batch.update(buyerProfileRef, {
        corpsCoin: admin.firestore.FieldValue.increment(-listing.askingPrice)
      });

      // Update seller's CorpsCoin
      const sellerProfileRef = admin.firestore().doc(`artifacts/${DATA_NAMESPACE}/users/${listing.sellerId}/profile/data`);
      batch.update(sellerProfileRef, {
        corpsCoin: admin.firestore.FieldValue.increment(sellerProceeds)
      });

      // Mark listing as sold
      batch.update(listingRef, {
        isActive: false,
        soldAt: admin.firestore.FieldValue.serverTimestamp(),
        buyerId: buyerId
      });

      await batch.commit();

      return {
        success: true,
        message: `Successfully purchased ${listing.staffName} from marketplace!`
      };

    } catch (error) {
      console.error("Error purchasing from marketplace:", error);
      if (error.code && error.code.startsWith('functions/')) {
        throw error;
      }
      throw new functions.https.HttpsError("internal", "An error occurred during marketplace purchase.");
    }
  });

/**
 * Cancel marketplace listing
 */
exports.cancelMarketplaceListing = functions
  .runWith(getFunctionConfig('light'))
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "You must be logged in.");
    }

    const { listingId } = data;
    const uid = context.auth.uid;

    if (!listingId) {
      throw new functions.https.HttpsError("invalid-argument", "Listing ID is required.");
    }

    try {
      const listingRef = admin.firestore().doc(`staff_marketplace/${listingId}`);
      const listingSnap = await listingRef.get();

      if (!listingSnap.exists) {
        throw new functions.https.HttpsError("not-found", "Listing not found.");
      }

      const listing = listingSnap.data();

      if (listing.sellerId !== uid) {
        throw new functions.https.HttpsError("permission-denied", "You can only cancel your own listings.");
      }

      const batch = admin.firestore().batch();

      // Mark listing as inactive
      batch.update(listingRef, {
        isActive: false,
        cancelledAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Update staff member
      const userStaffRef = admin.firestore().doc(`artifacts/${DATA_NAMESPACE}/users/${uid}/staff/${listing.staffId}`);
      batch.update(userStaffRef, {
        isListedForSale: false,
        marketplaceListingId: null
      });

      await batch.commit();

      return {
        success: true,
        message: `Listing cancelled for ${listing.staffName}.`
      };

    } catch (error) {
      console.error("Error cancelling listing:", error);
      if (error.code && error.code.startsWith('functions/')) {
        throw error;
      }
      throw new functions.https.HttpsError("internal", "An error occurred while cancelling listing.");
    }
  });

/**
 * Update marketplace listing price
 */
exports.updateListingPrice = functions
  .runWith(getFunctionConfig('light'))
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "You must be logged in.");
    }

    const { listingId, newPrice } = data;
    const uid = context.auth.uid;

    if (!listingId || !newPrice || newPrice < 1) {
      throw new functions.https.HttpsError("invalid-argument", "Listing ID and valid new price are required.");
    }

    try {
      const listingRef = admin.firestore().doc(`staff_marketplace/${listingId}`);
      const listingSnap = await listingRef.get();

      if (!listingSnap.exists) {
        throw new functions.https.HttpsError("not-found", "Listing not found.");
      }

      const listing = listingSnap.data();

      if (listing.sellerId !== uid) {
        throw new functions.https.HttpsError("permission-denied", "You can only update your own listings.");
      }

      if (!listing.isActive) {
        throw new functions.https.HttpsError("failed-precondition", "Cannot update an inactive listing.");
      }

      await listingRef.update({
        askingPrice: newPrice,
        priceUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return {
        success: true,
        message: `Price updated to ${newPrice} CorpsCoin.`
      };

    } catch (error) {
      console.error("Error updating listing price:", error);
      if (error.code && error.code.startsWith('functions/')) {
        throw error;
      }
      throw new functions.https.HttpsError("internal", "An error occurred while updating price.");
    }
  });

/**
 * Get all active marketplace listings
 */
exports.getMarketplaceListings = functions
  .runWith(getFunctionConfig('light'))
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "You must be logged in.");
    }

    try {
      const listingsSnapshot = await admin.firestore()
        .collection('staff_marketplace')
        .where('isActive', '==', true)
        .orderBy('listedAt', 'desc')
        .limit(50)
        .get();

      const listings = listingsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      return {
        success: true,
        listings: listings,
        totalCount: listings.length
      };

    } catch (error) {
      console.error("Error fetching marketplace listings:", error);
      throw new functions.https.HttpsError("internal", "An error occurred while fetching listings.");
    }
  });

/**
 * Get user's marketplace listings
 */
exports.getUserMarketplaceListings = functions
  .runWith(getFunctionConfig('light'))
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "You must be logged in.");
    }

    const uid = context.auth.uid;

    try {
      const listingsSnapshot = await admin.firestore()
        .collection('staff_marketplace')
        .where('sellerId', '==', uid)
        .where('isActive', '==', true)
        .orderBy('listedAt', 'desc')
        .get();

      const listings = listingsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      return {
        success: true,
        listings: listings,
        totalCount: listings.length
      };

    } catch (error) {
      console.error("Error fetching user marketplace listings:", error);
      throw new functions.https.HttpsError("internal", "An error occurred while fetching your listings.");
    }
  });