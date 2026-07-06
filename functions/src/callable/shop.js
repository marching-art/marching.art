const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const { getDb, dataNamespaceParam } = require("../config");
const { addCoinHistoryEntryToTransaction, TRANSACTION_TYPES } = require("./economy");
const { assertAuth } = require("../helpers/callableGuards");
const { getShopItem, TYPE_TO_SLOT } = require("../helpers/shopCatalog");

/**
 * Corps Identity Shop — purchase + equip callables.
 *
 * Ownership and equipped state live on the profile under `cosmetics`
 * (a server-only field in firestore.rules, since purchases carry currency
 * and equipped titles display on public profiles):
 *   cosmetics: { owned: string[], equipped: { title?, frame?, cardTheme? } }
 */

const purchaseShopItem = onCall({ cors: true }, async (request) => {
  const uid = assertAuth(request);
  const { itemId } = request.data || {};

  const item = getShopItem(itemId);
  if (!item) {
    throw new HttpsError("invalid-argument", "Unknown shop item.");
  }

  const db = getDb();
  const profileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`);

  try {
    const result = await db.runTransaction(async (transaction) => {
      const profileDoc = await transaction.get(profileRef);
      if (!profileDoc.exists) {
        throw new HttpsError("not-found", "User profile not found.");
      }
      const profileData = profileDoc.data();
      const owned = profileData.cosmetics?.owned || [];

      if (owned.includes(item.id)) {
        throw new HttpsError("already-exists", "You already own this item.");
      }

      const balance = profileData.corpsCoin || 0;
      if (balance < item.price) {
        throw new HttpsError(
          "failed-precondition",
          `Not enough CorpsCoin. Need ${item.price.toLocaleString()}, have ${balance.toLocaleString()}.`
        );
      }

      const newBalance = balance - item.price;
      transaction.update(profileRef, {
        corpsCoin: newBalance,
        'cosmetics.owned': admin.firestore.FieldValue.arrayUnion(item.id),
      });

      addCoinHistoryEntryToTransaction(transaction, db, uid, {
        type: TRANSACTION_TYPES.COSMETIC_PURCHASE,
        amount: -item.price,
        balance: newBalance,
        description: `Shop: ${item.name}`,
        itemId: item.id,
      });

      return { newBalance };
    });

    logger.info(`User ${uid} purchased shop item ${item.id} for ${item.price} CC`);
    return {
      success: true,
      itemId: item.id,
      name: item.name,
      newBalance: result.newBalance,
      message: `${item.name} is yours!`,
    };
  } catch (error) {
    logger.error(`Error purchasing shop item for user ${uid}:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "Failed to purchase item.");
  }
});

/**
 * Equip an owned item into its slot, or unequip a slot by passing
 * { slot, itemId: null }.
 */
const equipShopItem = onCall({ cors: true }, async (request) => {
  const uid = assertAuth(request);
  const { itemId = null, slot: requestedSlot = null } = request.data || {};

  let slot = requestedSlot;
  let item = null;
  if (itemId !== null) {
    item = getShopItem(itemId);
    if (!item) {
      throw new HttpsError("invalid-argument", "Unknown shop item.");
    }
    slot = TYPE_TO_SLOT[item.type];
  }
  if (!slot || !Object.values(TYPE_TO_SLOT).includes(slot)) {
    throw new HttpsError("invalid-argument", "Invalid cosmetic slot.");
  }

  const db = getDb();
  const profileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`);

  try {
    await db.runTransaction(async (transaction) => {
      const profileDoc = await transaction.get(profileRef);
      if (!profileDoc.exists) {
        throw new HttpsError("not-found", "User profile not found.");
      }
      const owned = profileDoc.data().cosmetics?.owned || [];

      if (item && !owned.includes(item.id)) {
        throw new HttpsError("failed-precondition", "You don't own this item yet.");
      }

      transaction.update(profileRef, {
        [`cosmetics.equipped.${slot}`]: item ? item.id : null,
      });
    });

    logger.info(`User ${uid} ${item ? `equipped ${item.id}` : `unequipped ${slot}`}`);
    return {
      success: true,
      slot,
      itemId: item ? item.id : null,
      message: item ? `${item.name} equipped!` : 'Item unequipped.',
    };
  } catch (error) {
    logger.error(`Error equipping shop item for user ${uid}:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "Failed to equip item.");
  }
});

module.exports = { purchaseShopItem, equipShopItem };
