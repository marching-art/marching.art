const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { DATA_NAMESPACE } = require("../config");

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
exports.getAvailableStaff = functions.https.onCall(async (data, context) => {
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
exports.purchaseStaffMember = functions.https.onCall(async (data, context) => {
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
      isActive: false, // Not assigned to any caption yet
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
      throw error; // Re-throw Firebase function errors
    }
    throw new functions.https.HttpsError("internal", "An error occurred while purchasing staff member.");
  }
});

/**
 * Get user's owned staff members
 */
exports.getUserStaff = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "You must be logged in.");
  }

  const uid = context.auth.uid;

  try {
    const userStaffRef = admin.firestore().collection(`artifacts/${DATA_NAMESPACE}/users/${uid}/staff`);
    const staffSnapshot = await userStaffRef.orderBy('purchaseDate', 'desc').get();
    
    const staffList = staffSnapshot.docs.map(doc => {
      const staffData = doc.data();
      const currentMarketValue = calculateMarketValue(
        staffData.purchasePrice || staffData.currentValue,
        staffData.seasonsCompleted || 0,
        staffData.performanceBonus || 0
      );
      
      return {
        id: doc.id,
        ...staffData,
        currentMarketValue: currentMarketValue
      };
    });

    return {
      success: true,
      staff: staffList,
      totalCount: staffList.length,
      activeCount: staffList.filter(s => s.isActive).length,
      listedCount: staffList.filter(s => s.isListedForSale).length
    };

  } catch (error) {
    console.error("Error fetching user staff:", error);
    throw new functions.https.HttpsError("internal", "An error occurred while fetching your staff.");
  }
});

/**
 * Assign staff member to a caption
 */
exports.assignStaffToCaption = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "You must be logged in.");
  }

  const { staffId, caption } = data;
  const uid = context.auth.uid;

  if (!staffId || !caption) {
    throw new functions.https.HttpsError("invalid-argument", "Staff ID and caption are required.");
  }

  const validCaptions = ["GE1", "GE2", "Visual Proficiency", "Visual Analysis", "Color Guard", "Brass", "Music Analysis", "Percussion"];
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
    
    // Check if staff member's caption matches the assignment
    if (staffData.caption !== caption) {
      throw new functions.https.HttpsError("invalid-argument", `This staff member specializes in ${staffData.caption}, not ${caption}.`);
    }

    // Check if staff is listed for sale
    if (staffData.isListedForSale) {
      throw new functions.https.HttpsError("failed-precondition", "Cannot assign staff that is listed for sale.");
    }

    // Check if another staff member is already assigned to this caption
    const assignedStaffQuery = admin.firestore()
      .collection(`artifacts/${DATA_NAMESPACE}/users/${uid}/staff`)
      .where('assignedCaption', '==', caption)
      .where('isActive', '==', true);
    
    const assignedStaffSnap = await assignedStaffQuery.get();
    
    if (!assignedStaffSnap.empty) {
      throw new functions.https.HttpsError("failed-precondition", `Another staff member is already assigned to ${caption}.`);
    }

    // Assign the staff member
    await userStaffRef.update({
      isActive: true,
      assignedCaption: caption,
      assignedDate: admin.firestore.FieldValue.serverTimestamp()
    });

    return {
      success: true,
      message: `${staffData.name} has been assigned to ${caption}!`
    };

  } catch (error) {
    console.error("Error assigning staff to caption:", error);
    if (error.code && error.code.startsWith('functions/')) {
      throw error;
    }
    throw new functions.https.HttpsError("internal", "An error occurred while assigning staff member.");
  }
});

/**
 * Remove staff member from caption assignment
 */
exports.unassignStaffFromCaption = functions.https.onCall(async (data, context) => {
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
exports.sellStaffMember = functions.https.onCall(async (data, context) => {
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

    // Cannot sell active staff members
    if (staffData.isActive) {
      throw new functions.https.HttpsError("failed-precondition", "Cannot sell an active staff member. Remove them from caption assignment first.");
    }

    // Cannot sell staff already listed
    if (staffData.isListedForSale) {
      throw new functions.https.HttpsError("failed-precondition", "Staff member is already listed for sale.");
    }

    // Get seller's display name
    const userProfileRef = admin.firestore().doc(`artifacts/${DATA_NAMESPACE}/users/${uid}/profile/data`);
    const userProfileSnap = await userProfileRef.get();
    const sellerName = userProfileSnap.exists ? userProfileSnap.data().displayName : 'Anonymous';

    const batch = admin.firestore().batch();

    // Create marketplace listing
    const marketplaceRef = admin.firestore().collection('staff_marketplace').doc();
    batch.set(marketplaceRef, {
      staffId: staffId,
      sellerId: uid,
      sellerName: sellerName,
      staffName: staffData.name,
      caption: staffData.caption,
      yearInducted: staffData.yearInducted,
      biography: staffData.biography,
      seasonsCompleted: staffData.seasonsCompleted || 0,
      performanceBonus: staffData.performanceBonus || 0,
      askingPrice: askingPrice,
      listedDate: admin.firestore.FieldValue.serverTimestamp(),
      isActive: true,
      views: 0,
      priceHistory: []
    });

    // Mark staff as listed for sale
    batch.update(userStaffRef, {
      isListedForSale: true,
      listedPrice: askingPrice,
      marketplaceListingId: marketplaceRef.id,
      listedDate: admin.firestore.FieldValue.serverTimestamp()
    });

    await batch.commit();

    return {
      success: true,
      message: `${staffData.name} has been listed for sale at ${askingPrice} CorpsCoin!`,
      listingId: marketplaceRef.id
    };

  } catch (error) {
    console.error("Error selling staff member:", error);
    if (error.code && error.code.startsWith('functions/')) {
      throw error;
    }
    throw new functions.https.HttpsError("internal", "An error occurred while listing staff member for sale.");
  }
});

/**
 * Get active marketplace listings with pagination and filtering
 */
exports.getMarketplaceListings = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "You must be logged in.");
  }

  const { caption, minPrice, maxPrice, limit = 20, lastDoc } = data;

  try {
    let query = admin.firestore()
      .collection('staff_marketplace')
      .where('isActive', '==', true);

    // Apply filters
    if (caption) {
      query = query.where('caption', '==', caption);
    }

    if (minPrice !== undefined) {
      query = query.where('askingPrice', '>=', minPrice);
    }

    if (maxPrice !== undefined) {
      query = query.where('askingPrice', '<=', maxPrice);
    }

    // Order by listing date (newest first)
    query = query.orderBy('listedDate', 'desc').limit(limit);

    // Pagination
    if (lastDoc) {
      const lastDocRef = await admin.firestore().doc(`staff_marketplace/${lastDoc}`).get();
      if (lastDocRef.exists) {
        query = query.startAfter(lastDocRef);
      }
    }

    const snapshot = await query.get();
    
    const listings = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      listedDate: doc.data().listedDate?.toDate?.() || null
    }));

    return {
      success: true,
      listings: listings,
      hasMore: snapshot.size === limit,
      lastDoc: snapshot.size > 0 ? snapshot.docs[snapshot.size - 1].id : null
    };

  } catch (error) {
    console.error("Error fetching marketplace listings:", error);
    throw new functions.https.HttpsError("internal", "An error occurred while fetching marketplace listings.");
  }
});

/**
 * Purchase a staff member from the marketplace
 */
exports.purchaseFromMarketplace = functions.https.onCall(async (data, context) => {
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
      throw new functions.https.HttpsError("not-found", "Marketplace listing not found.");
    }

    const listingData = listingSnap.data();

    if (!listingData.isActive) {
      throw new functions.https.HttpsError("failed-precondition", "This listing is no longer active.");
    }

    if (listingData.sellerId === buyerId) {
      throw new functions.https.HttpsError("invalid-argument", "You cannot purchase your own listing.");
    }

    // Get buyer's profile to check CorpsCoin balance
    const buyerProfileRef = admin.firestore().doc(`artifacts/${DATA_NAMESPACE}/users/${buyerId}/profile/data`);
    const buyerSnap = await buyerProfileRef.get();
    
    if (!buyerSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Buyer profile not found.");
    }

    const buyerData = buyerSnap.data();
    const buyerCorpsCoin = buyerData.corpsCoin || 0;

    if (buyerCorpsCoin < listingData.askingPrice) {
      throw new functions.https.HttpsError("failed-precondition", 
        `Insufficient CorpsCoin. Need ${listingData.askingPrice}, have ${buyerCorpsCoin}.`);
    }

    // Check if buyer already owns this staff member
    const buyerStaffRef = admin.firestore().doc(`artifacts/${DATA_NAMESPACE}/users/${buyerId}/staff/${listingData.staffId}`);
    const existingStaff = await buyerStaffRef.get();
    
    if (existingStaff.exists) {
      throw new functions.https.HttpsError("already-exists", "You already own this staff member.");
    }

    // Get the staff member from seller's collection
    const sellerStaffRef = admin.firestore().doc(`artifacts/${DATA_NAMESPACE}/users/${listingData.sellerId}/staff/${listingData.staffId}`);
    const sellerStaffSnap = await sellerStaffRef.get();

    if (!sellerStaffSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Staff member not found in seller's collection.");
    }

    const staffData = sellerStaffSnap.data();

    // Execute the marketplace transaction
    const batch = admin.firestore().batch();

    // Transfer CorpsCoin: buyer to seller
    batch.update(buyerProfileRef, {
      corpsCoin: admin.firestore.FieldValue.increment(-listingData.askingPrice),
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    });

    const sellerProfileRef = admin.firestore().doc(`artifacts/${DATA_NAMESPACE}/users/${listingData.sellerId}/profile/data`);
    batch.update(sellerProfileRef, {
      corpsCoin: admin.firestore.FieldValue.increment(listingData.askingPrice),
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    });

    // Transfer staff member: seller to buyer
    batch.set(buyerStaffRef, {
      ...staffData,
      previousOwner: listingData.sellerId,
      purchaseDate: admin.firestore.FieldValue.serverTimestamp(),
      purchasePrice: listingData.askingPrice,
      marketplacePurchase: true,
      isActive: false, // Not assigned to any caption
      assignedCaption: null,
      isListedForSale: false,
      listedPrice: null,
      marketplaceListingId: null
    });

    // Remove staff from seller
    batch.delete(sellerStaffRef);

    // Deactivate marketplace listing
    batch.update(listingRef, {
      isActive: false,
      soldDate: admin.firestore.FieldValue.serverTimestamp(),
      buyerId: buyerId,
      finalPrice: listingData.askingPrice
    });

    // Log transactions for both users
    const buyerTransactionRef = admin.firestore().collection(`corps_coin_transactions/${buyerId}/transactions`).doc();
    batch.set(buyerTransactionRef, {
      type: 'marketplace_purchase',
      amount: -listingData.askingPrice,
      staffId: listingData.staffId,
      staffName: listingData.staffName,
      sellerId: listingData.sellerId,
      listingId: listingId,
      description: `Purchased ${listingData.staffName} from marketplace`,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    const sellerTransactionRef = admin.firestore().collection(`corps_coin_transactions/${listingData.sellerId}/transactions`).doc();
    batch.set(sellerTransactionRef, {
      type: 'marketplace_sale',
      amount: listingData.askingPrice,
      staffId: listingData.staffId,
      staffName: listingData.staffName,
      buyerId: buyerId,
      listingId: listingId,
      description: `Sold ${listingData.staffName} on marketplace`,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    await batch.commit();

    return {
      success: true,
      message: `Successfully purchased ${listingData.staffName} for ${listingData.askingPrice} CorpsCoin!`,
      staff: {
        id: listingData.staffId,
        name: listingData.staffName,
        caption: listingData.caption,
        purchasePrice: listingData.askingPrice
      },
      remainingCorpsCoin: buyerCorpsCoin - listingData.askingPrice
    };

  } catch (error) {
    console.error("Error purchasing from marketplace:", error);
    if (error.code && error.code.startsWith('functions/')) {
      throw error;
    }
    throw new functions.https.HttpsError("internal", "An error occurred while purchasing from marketplace.");
  }
});

/**
 * Cancel a marketplace listing
 */
exports.cancelMarketplaceListing = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "You must be logged in.");
  }

  const { listingId } = data;
  const userId = context.auth.uid;

  if (!listingId) {
    throw new functions.https.HttpsError("invalid-argument", "Listing ID is required.");
  }

  try {
    const listingRef = admin.firestore().doc(`staff_marketplace/${listingId}`);
    const listingSnap = await listingRef.get();

    if (!listingSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Marketplace listing not found.");
    }

    const listingData = listingSnap.data();

    if (listingData.sellerId !== userId) {
      throw new functions.https.HttpsError("permission-denied", "You can only cancel your own listings.");
    }

    if (!listingData.isActive) {
      throw new functions.https.HttpsError("failed-precondition", "This listing is already inactive.");
    }

    const batch = admin.firestore().batch();

    // Deactivate marketplace listing
    batch.update(listingRef, {
      isActive: false,
      cancelledDate: admin.firestore.FieldValue.serverTimestamp(),
      cancelledBy: userId
    });

    // Update staff member to remove marketplace listing info
    const userStaffRef = admin.firestore().doc(`artifacts/${DATA_NAMESPACE}/users/${userId}/staff/${listingData.staffId}`);
    batch.update(userStaffRef, {
      isListedForSale: false,
      listedPrice: null,
      marketplaceListingId: null,
      unlistedDate: admin.firestore.FieldValue.serverTimestamp()
    });

    await batch.commit();

    return {
      success: true,
      message: `Successfully cancelled listing for ${listingData.staffName}.`
    };

  } catch (error) {
    console.error("Error cancelling marketplace listing:", error);
    if (error.code && error.code.startsWith('functions/')) {
      throw error;
    }
    throw new functions.https.HttpsError("internal", "An error occurred while cancelling the listing.");
  }
});

/**
 * Get user's marketplace listings (both active and sold)
 */
exports.getUserMarketplaceListings = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "You must be logged in.");
  }

  const userId = context.auth.uid;

  try {
    const listingsQuery = admin.firestore()
      .collection('staff_marketplace')
      .where('sellerId', '==', userId)
      .orderBy('listedDate', 'desc');

    const snapshot = await listingsQuery.get();
    
    const listings = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      listedDate: doc.data().listedDate?.toDate?.() || null,
      soldDate: doc.data().soldDate?.toDate?.() || null,
      cancelledDate: doc.data().cancelledDate?.toDate?.() || null
    }));

    const stats = {
      active: listings.filter(l => l.isActive).length,
      sold: listings.filter(l => l.soldDate).length,
      cancelled: listings.filter(l => l.cancelledDate).length,
      totalRevenue: listings.filter(l => l.soldDate).reduce((sum, l) => sum + (l.finalPrice || 0), 0)
    };

    return {
      success: true,
      listings: listings,
      statistics: stats
    };

  } catch (error) {
    console.error("Error fetching user marketplace listings:", error);
    throw new functions.https.HttpsError("internal", "An error occurred while fetching your listings.");
  }
});

/**
 * Update marketplace listing price
 */
exports.updateListingPrice = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "You must be logged in.");
  }

  const { listingId, newPrice } = data;
  const userId = context.auth.uid;

  if (!listingId || !newPrice || newPrice < 1) {
    throw new functions.https.HttpsError("invalid-argument", "Listing ID and valid new price are required.");
  }

  try {
    const listingRef = admin.firestore().doc(`staff_marketplace/${listingId}`);
    const listingSnap = await listingRef.get();

    if (!listingSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Marketplace listing not found.");
    }

    const listingData = listingSnap.data();

    if (listingData.sellerId !== userId) {
      throw new functions.https.HttpsError("permission-denied", "You can only update your own listings.");
    }

    if (!listingData.isActive) {
      throw new functions.https.HttpsError("failed-precondition", "Cannot update inactive listings.");
    }

    const batch = admin.firestore().batch();

    // Update marketplace listing
    batch.update(listingRef, {
      askingPrice: newPrice,
      priceUpdatedDate: admin.firestore.FieldValue.serverTimestamp(),
      priceHistory: admin.firestore.FieldValue.arrayUnion({
        price: listingData.askingPrice,
        date: admin.firestore.FieldValue.serverTimestamp()
      })
    });

    // Update staff member listing price
    const userStaffRef = admin.firestore().doc(`artifacts/${DATA_NAMESPACE}/users/${userId}/staff/${listingData.staffId}`);
    batch.update(userStaffRef, {
      listedPrice: newPrice
    });

    await batch.commit();

    return {
      success: true,
      message: `Successfully updated listing price to ${newPrice} CorpsCoin.`,
      newPrice: newPrice
    };

  } catch (error) {
    console.error("Error updating listing price:", error);
    if (error.code && error.code.startsWith('functions/')) {
      throw error;
    }
    throw new functions.https.HttpsError("internal", "An error occurred while updating the listing price.");
  }
});