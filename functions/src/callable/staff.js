/**
 * Staff Management Functions
 * Handles staff purchases, assignments, and marketplace
 * 
 * Location: functions/src/callable/staff.js
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { 
  DATA_NAMESPACE, 
  getFunctionConfig,
  STAFF_CONFIG,
  XP_CONFIG,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES
} = require('../../config');

/**
 * Purchase a staff member from the Hall of Fame
 */
exports.purchaseStaffMember = functions
  .runWith(getFunctionConfig('light'))
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', ERROR_MESSAGES.UNAUTHENTICATED);
    }

    const { staffId } = data;
    const uid = context.auth.uid;

    if (!staffId) {
      throw new functions.https.HttpsError('invalid-argument', 'Staff ID is required');
    }

    try {
      const db = admin.firestore();
      
      // Get staff details from Hall of Fame
      const staffRef = db.doc(`hall-of-fame/${staffId}`);
      const staffSnap = await staffRef.get();

      if (!staffSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Staff member not found');
      }

      const staffData = staffSnap.data();
      const profileRef = db.doc(`artifacts/${DATA_NAMESPACE}/users/${uid}/profile/data`);

      // Use transaction to ensure atomicity
      const result = await db.runTransaction(async (transaction) => {
        const profileSnap = await transaction.get(profileRef);
        
        if (!profileSnap.exists) {
          throw new functions.https.HttpsError('not-found', ERROR_MESSAGES.NOT_FOUND);
        }

        const profile = profileSnap.data();
        const currentCorpsCoin = profile.corpsCoin || 0;

        // Check if user can afford
        if (currentCorpsCoin < staffData.price) {
          throw new functions.https.HttpsError(
            'failed-precondition',
            `${ERROR_MESSAGES.INSUFFICIENT_FUNDS}. Need ${staffData.price}, have ${currentCorpsCoin}`
          );
        }

        // Check if user already owns this staff member
        const userStaffRef = db.doc(`artifacts/${DATA_NAMESPACE}/users/${uid}/staff/${staffId}`);
        const userStaffSnap = await transaction.get(userStaffRef);

        if (userStaffSnap.exists) {
          throw new functions.https.HttpsError('already-exists', 'You already own this staff member');
        }

        // Deduct CorpsCoin
        transaction.update(profileRef, {
          corpsCoin: admin.firestore.FieldValue.increment(-staffData.price),
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        });

        // Add staff to user's collection
        transaction.set(userStaffRef, {
          id: staffId,
          name: staffData.name,
          caption: staffData.caption,
          yearInducted: staffData.yearInducted,
          biography: staffData.biography,
          price: staffData.price,
          purchasedAt: admin.firestore.FieldValue.serverTimestamp(),
          experience: 0,
          assignedTo: null // Not assigned to any corps initially
        });

        // Log transaction
        const transactionRef = db.collection(`corps_coin_transactions/${uid}/transactions`).doc();
        transaction.set(transactionRef, {
          type: 'staff_purchase',
          amount: -staffData.price,
          staffId: staffId,
          staffName: staffData.name,
          balanceBefore: currentCorpsCoin,
          balanceAfter: currentCorpsCoin - staffData.price,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        return {
          newBalance: currentCorpsCoin - staffData.price,
          staffName: staffData.name
        };
      });

      // Award XP outside transaction
      await db.collection(`xp_transactions/${uid}/transactions`).add({
        type: 'staff_purchase',
        amount: XP_CONFIG.STAFF_PURCHASE,
        description: `Purchased ${result.staffName}`,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      await profileRef.update({
        xp: admin.firestore.FieldValue.increment(XP_CONFIG.STAFF_PURCHASE)
      });

      functions.logger.info(`User ${uid} purchased staff ${staffId}`);

      return {
        success: true,
        message: `${SUCCESS_MESSAGES.STAFF_PURCHASED} (+${XP_CONFIG.STAFF_PURCHASE} XP)`,
        newBalance: result.newBalance,
        xpAwarded: XP_CONFIG.STAFF_PURCHASE
      };

    } catch (error) {
      functions.logger.error('Error purchasing staff:', error);
      
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      
      throw new functions.https.HttpsError('internal', 'Failed to purchase staff member');
    }
  });

/**
 * Assign staff member to a caption for a specific corps
 */
exports.assignStaffToCaption = functions
  .runWith(getFunctionConfig('light'))
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', ERROR_MESSAGES.UNAUTHENTICATED);
    }

    const { staffId, caption, corpsId } = data;
    const uid = context.auth.uid;

    if (!staffId || !caption || !corpsId) {
      throw new functions.https.HttpsError('invalid-argument', 'Staff ID, caption, and corps ID are required');
    }

    try {
      const db = admin.firestore();
      
      // Verify user owns this corps
      const corpsRef = db.doc(`artifacts/${DATA_NAMESPACE}/users/${uid}/corps/${corpsId}`);
      const corpsSnap = await corpsRef.get();

      if (!corpsSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Corps not found');
      }

      const staffRef = db.doc(`artifacts/${DATA_NAMESPACE}/users/${uid}/staff/${staffId}`);
      const staffSnap = await staffRef.get();

      if (!staffSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Staff member not found in your collection');
      }

      const staffData = staffSnap.data();

      // Verify caption matches staff specialty
      if (staffData.caption !== caption) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          `This staff member specializes in ${staffData.caption}, not ${caption}`
        );
      }

      // Update staff assignment
      await staffRef.update({
        assignedTo: {
          corpsId: corpsId,
          corpsName: corpsSnap.data().corpsName,
          caption: caption,
          assignedAt: admin.firestore.FieldValue.serverTimestamp()
        },
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      });

      functions.logger.info(`User ${uid} assigned staff ${staffId} to ${caption} for corps ${corpsId}`);

      return {
        success: true,
        message: `${SUCCESS_MESSAGES.STAFF_ASSIGNED}: ${caption}`
      };

    } catch (error) {
      functions.logger.error('Error assigning staff:', error);
      
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      
      throw new functions.https.HttpsError('internal', 'Failed to assign staff member');
    }
  });

/**
 * Unassign staff member from caption
 */
exports.unassignStaffFromCaption = functions
  .runWith(getFunctionConfig('light'))
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', ERROR_MESSAGES.UNAUTHENTICATED);
    }

    const { staffId, corpsId } = data;
    const uid = context.auth.uid;

    if (!staffId || !corpsId) {
      throw new functions.https.HttpsError('invalid-argument', 'Staff ID and corps ID are required');
    }

    try {
      const db = admin.firestore();
      
      const staffRef = db.doc(`artifacts/${DATA_NAMESPACE}/users/${uid}/staff/${staffId}`);
      const staffSnap = await staffRef.get();

      if (!staffSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Staff member not found');
      }

      const staffData = staffSnap.data();

      // Verify staff is assigned to this corps
      if (!staffData.assignedTo || staffData.assignedTo.corpsId !== corpsId) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Staff member is not assigned to this corps'
        );
      }

      // Unassign staff
      await staffRef.update({
        assignedTo: null,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      });

      functions.logger.info(`User ${uid} unassigned staff ${staffId} from corps ${corpsId}`);

      return {
        success: true,
        message: SUCCESS_MESSAGES.STAFF_UNASSIGNED
      };

    } catch (error) {
      functions.logger.error('Error unassigning staff:', error);
      
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      
      throw new functions.https.HttpsError('internal', 'Failed to unassign staff member');
    }
  });

/**
 * Sell staff member to marketplace
 */
exports.sellStaffMember = functions
  .runWith(getFunctionConfig('light'))
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', ERROR_MESSAGES.UNAUTHENTICATED);
    }

    const { staffId, price } = data;
    const uid = context.auth.uid;

    if (!staffId || !price || price < 1) {
      throw new functions.https.HttpsError('invalid-argument', 'Valid staff ID and price are required');
    }

    try {
      const db = admin.firestore();
      
      const staffRef = db.doc(`artifacts/${DATA_NAMESPACE}/users/${uid}/staff/${staffId}`);
      const staffSnap = await staffRef.get();

      if (!staffSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Staff member not found');
      }

      const staffData = staffSnap.data();

      // Check if staff is assigned to a corps
      if (staffData.assignedTo) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Cannot sell staff that is assigned to a corps. Unassign first.'
        );
      }

      // Create marketplace listing
      const listingRef = db.collection('staff_marketplace').doc();
      await listingRef.set({
        id: listingRef.id,
        staffId: staffId,
        name: staffData.name,
        caption: staffData.caption,
        yearInducted: staffData.yearInducted,
        biography: staffData.biography,
        experience: staffData.experience,
        originalPrice: staffData.price,
        price: price,
        sellerId: uid,
        sellerName: (await db.doc(`artifacts/${DATA_NAMESPACE}/users/${uid}/profile/data`).get()).data()?.alias || 'Anonymous',
        isActive: true,
        listedAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: null // No expiration
      });

      // Mark staff as listed
      await staffRef.update({
        listedForSale: true,
        listingId: listingRef.id,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      });

      functions.logger.info(`User ${uid} listed staff ${staffId} for ${price}`);

      return {
        success: true,
        message: 'Staff member listed on marketplace!',
        listingId: listingRef.id
      };

    } catch (error) {
      functions.logger.error('Error selling staff:', error);
      
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      
      throw new functions.https.HttpsError('internal', 'Failed to list staff member');
    }
  });

/**
 * Purchase staff from marketplace
 */
exports.purchaseFromMarketplace = functions
  .runWith(getFunctionConfig('light'))
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', ERROR_MESSAGES.UNAUTHENTICATED);
    }

    const { listingId } = data;
    const uid = context.auth.uid;

    if (!listingId) {
      throw new functions.https.HttpsError('invalid-argument', 'Listing ID is required');
    }

    try {
      const db = admin.firestore();
      
      const listingRef = db.doc(`staff_marketplace/${listingId}`);
      const listingSnap = await listingRef.get();

      if (!listingSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Listing not found');
      }

      const listing = listingSnap.data();

      if (!listing.isActive) {
        throw new functions.https.HttpsError('failed-precondition', 'This listing is no longer active');
      }

      if (listing.sellerId === uid) {
        throw new functions.https.HttpsError('invalid-argument', 'Cannot buy your own listing');
      }

      const profileRef = db.doc(`artifacts/${DATA_NAMESPACE}/users/${uid}/profile/data`);
      const sellerProfileRef = db.doc(`artifacts/${DATA_NAMESPACE}/users/${listing.sellerId}/profile/data`);

      // Use transaction for atomicity
      const result = await db.runTransaction(async (transaction) => {
        const profileSnap = await transaction.get(profileRef);
        const sellerProfileSnap = await transaction.get(sellerProfileRef);

        if (!profileSnap.exists || !sellerProfileSnap.exists) {
          throw new functions.https.HttpsError('not-found', 'User profile not found');
        }

        const buyerCorpsCoin = profileSnap.data().corpsCoin || 0;
        const sellerCorpsCoin = sellerProfileSnap.data().corpsCoin || 0;

        // Check buyer can afford
        if (buyerCorpsCoin < listing.price) {
          throw new functions.https.HttpsError(
            'failed-precondition',
            `${ERROR_MESSAGES.INSUFFICIENT_FUNDS}. Need ${listing.price}, have ${buyerCorpsCoin}`
          );
        }

        // Calculate marketplace fee (10%)
        const fee = Math.floor(listing.price * STAFF_CONFIG.MARKETPLACE_FEE || 0.1);
        const sellerProceeds = listing.price - fee;

        // Update buyer CorpsCoin
        transaction.update(profileRef, {
          corpsCoin: admin.firestore.FieldValue.increment(-listing.price)
        });

        // Update seller CorpsCoin
        transaction.update(sellerProfileRef, {
          corpsCoin: admin.firestore.FieldValue.increment(sellerProceeds)
        });

        // Transfer staff to buyer
        const sellerStaffRef = db.doc(`artifacts/${DATA_NAMESPACE}/users/${listing.sellerId}/staff/${listing.staffId}`);
        const buyerStaffRef = db.doc(`artifacts/${DATA_NAMESPACE}/users/${uid}/staff/${listing.staffId}`);

        const sellerStaffSnap = await transaction.get(sellerStaffRef);
        if (sellerStaffSnap.exists) {
          const staffData = sellerStaffSnap.data();
          
          // Add to buyer
          transaction.set(buyerStaffRef, {
            ...staffData,
            listedForSale: false,
            listingId: null,
            assignedTo: null,
            purchasedAt: admin.firestore.FieldValue.serverTimestamp()
          });

          // Remove from seller
          transaction.delete(sellerStaffRef);
        }

        // Mark listing as sold
        transaction.update(listingRef, {
          isActive: false,
          soldAt: admin.firestore.FieldValue.serverTimestamp(),
          buyerId: uid
        });

        // Log transactions
        const buyerTransactionRef = db.collection(`corps_coin_transactions/${uid}/transactions`).doc();
        transaction.set(buyerTransactionRef, {
          type: 'marketplace_purchase',
          amount: -listing.price,
          staffName: listing.name,
          listingId: listingId,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        const sellerTransactionRef = db.collection(`corps_coin_transactions/${listing.sellerId}/transactions`).doc();
        transaction.set(sellerTransactionRef, {
          type: 'marketplace_sale',
          amount: sellerProceeds,
          staffName: listing.name,
          listingId: listingId,
          fee: fee,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        return {
          buyerNewBalance: buyerCorpsCoin - listing.price,
          staffName: listing.name
        };
      });

      // Award XP to seller outside transaction
      await db.collection(`xp_transactions/${listing.sellerId}/transactions`).add({
        type: 'marketplace_sale',
        amount: XP_CONFIG.MARKETPLACE_SALE,
        description: `Sold ${result.staffName}`,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      await sellerProfileRef.update({
        xp: admin.firestore.FieldValue.increment(XP_CONFIG.MARKETPLACE_SALE)
      });

      functions.logger.info(`User ${uid} purchased staff from marketplace: ${listingId}`);

      return {
        success: true,
        message: `Successfully purchased ${result.staffName}!`,
        newBalance: result.buyerNewBalance
      };

    } catch (error) {
      functions.logger.error('Error purchasing from marketplace:', error);
      
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      
      throw new functions.https.HttpsError('internal', 'Failed to purchase from marketplace');
    }
  });

/**
 * Cancel marketplace listing
 */
exports.cancelMarketplaceListing = functions
  .runWith(getFunctionConfig('light'))
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', ERROR_MESSAGES.UNAUTHENTICATED);
    }

    const { listingId } = data;
    const uid = context.auth.uid;

    if (!listingId) {
      throw new functions.https.HttpsError('invalid-argument', 'Listing ID is required');
    }

    try {
      const db = admin.firestore();
      
      const listingRef = db.doc(`staff_marketplace/${listingId}`);
      const listingSnap = await listingRef.get();

      if (!listingSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Listing not found');
      }

      const listing = listingSnap.data();

      if (listing.sellerId !== uid) {
        throw new functions.https.HttpsError('permission-denied', 'You can only cancel your own listings');
      }

      // Mark listing as inactive
      await listingRef.update({
        isActive: false,
        cancelledAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Update staff
      const staffRef = db.doc(`artifacts/${DATA_NAMESPACE}/users/${uid}/staff/${listing.staffId}`);
      await staffRef.update({
        listedForSale: false,
        listingId: null,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      });

      functions.logger.info(`User ${uid} cancelled listing ${listingId}`);

      return {
        success: true,
        message: 'Listing cancelled successfully'
      };

    } catch (error) {
      functions.logger.error('Error cancelling listing:', error);
      
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      
      throw new functions.https.HttpsError('internal', 'Failed to cancel listing');
    }
  });

/**
 * Update marketplace listing price
 */
exports.updateListingPrice = functions
  .runWith(getFunctionConfig('light'))
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', ERROR_MESSAGES.UNAUTHENTICATED);
    }

    const { listingId, newPrice } = data;
    const uid = context.auth.uid;

    if (!listingId || !newPrice || newPrice < 1) {
      throw new functions.https.HttpsError('invalid-argument', 'Valid listing ID and price are required');
    }

    try {
      const db = admin.firestore();
      
      const listingRef = db.doc(`staff_marketplace/${listingId}`);
      const listingSnap = await listingRef.get();

      if (!listingSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Listing not found');
      }

      const listing = listingSnap.data();

      if (listing.sellerId !== uid) {
        throw new functions.https.HttpsError('permission-denied', 'You can only update your own listings');
      }

      if (!listing.isActive) {
        throw new functions.https.HttpsError('failed-precondition', 'Cannot update inactive listing');
      }

      await listingRef.update({
        price: newPrice,
        priceUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      functions.logger.info(`User ${uid} updated listing ${listingId} price to ${newPrice}`);

      return {
        success: true,
        message: 'Price updated successfully'
      };

    } catch (error) {
      functions.logger.error('Error updating listing price:', error);
      
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      
      throw new functions.https.HttpsError('internal', 'Failed to update listing price');
    }
  });

/**
 * Get user's staff collection
 */
exports.getUserStaff = functions
  .runWith(getFunctionConfig('light'))
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', ERROR_MESSAGES.UNAUTHENTICATED);
    }

    const uid = context.auth.uid;

    try {
      const db = admin.firestore();
      
      const staffSnapshot = await db.collection(`artifacts/${DATA_NAMESPACE}/users/${uid}/staff`).get();

      const staff = [];
      staffSnapshot.forEach(doc => {
        staff.push({
          id: doc.id,
          ...doc.data()
        });
      });

      // Sort by caption and name
      staff.sort((a, b) => {
        if (a.caption !== b.caption) {
          return a.caption.localeCompare(b.caption);
        }
        return a.name.localeCompare(b.name);
      });

      return {
        success: true,
        staff: staff
      };

    } catch (error) {
      functions.logger.error('Error getting user staff:', error);
      throw new functions.https.HttpsError('internal', 'Failed to retrieve staff collection');
    }
  });

/**
 * Get available staff from Hall of Fame
 */
exports.getAvailableStaff = functions
  .runWith(getFunctionConfig('light'))
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', ERROR_MESSAGES.UNAUTHENTICATED);
    }

    const { caption } = data;
    const uid = context.auth.uid;

    try {
      const db = admin.firestore();
      
      // Get staff user already owns
      const ownedStaffSnapshot = await db.collection(`artifacts/${DATA_NAMESPACE}/users/${uid}/staff`).get();
      const ownedStaffIds = new Set();
      ownedStaffSnapshot.forEach(doc => {
        ownedStaffIds.add(doc.id);
      });

      // Get all Hall of Fame staff
      let query = db.collection('hall-of-fame');
      if (caption) {
        query = query.where('caption', '==', caption);
      }

      const staffSnapshot = await query.get();

      const availableStaff = [];
      staffSnapshot.forEach(doc => {
        // Only include staff user doesn't own
        if (!ownedStaffIds.has(doc.id)) {
          availableStaff.push({
            id: doc.id,
            ...doc.data()
          });
        }
      });

      // Sort by price (ascending)
      availableStaff.sort((a, b) => (a.price || 0) - (b.price || 0));

      return {
        success: true,
        staff: availableStaff
      };

    } catch (error) {
      functions.logger.error('Error getting available staff:', error);
      throw new functions.https.HttpsError('internal', 'Failed to retrieve available staff');
    }
  });

/**
 * Get marketplace listings
 */
exports.getMarketplaceListings = functions
  .runWith(getFunctionConfig('light'))
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', ERROR_MESSAGES.UNAUTHENTICATED);
    }

    const { caption } = data;

    try {
      const db = admin.firestore();
      
      let query = db.collection('staff_marketplace').where('isActive', '==', true);
      if (caption) {
        query = query.where('caption', '==', caption);
      }

      const listingsSnapshot = await query.orderBy('listedAt', 'desc').get();

      const listings = [];
      listingsSnapshot.forEach(doc => {
        listings.push({
          id: doc.id,
          ...doc.data()
        });
      });

      return {
        success: true,
        listings: listings
      };

    } catch (error) {
      functions.logger.error('Error getting marketplace listings:', error);
      throw new functions.https.HttpsError('internal', 'Failed to retrieve marketplace listings');
    }
  });

/**
 * Get user's marketplace listings
 */
exports.getUserMarketplaceListings = functions
  .runWith(getFunctionConfig('light'))
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', ERROR_MESSAGES.UNAUTHENTICATED);
    }

    const uid = context.auth.uid;

    try {
      const db = admin.firestore();
      
      const listingsSnapshot = await db.collection('staff_marketplace')
        .where('sellerId', '==', uid)
        .where('isActive', '==', true)
        .orderBy('listedAt', 'desc')
        .get();

      const listings = [];
      listingsSnapshot.forEach(doc => {
        listings.push({
          id: doc.id,
          ...doc.data()
        });
      });

      return {
        success: true,
        listings: listings
      };

    } catch (error) {
      functions.logger.error('Error getting user marketplace listings:', error);
      throw new functions.https.HttpsError('internal', 'Failed to retrieve your listings');
    }
  });