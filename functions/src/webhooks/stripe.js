const { onRequest } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const { getDb, dataNamespaceParam } = require("../config");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY || "");

/**
 * Stripe Webhook Handler
 * Handles payment events from Stripe
 *
 * Setup: Configure webhook in Stripe dashboard to point to:
 * https://your-region-your-project.cloudfunctions.net/stripeWebhook
 *
 * Events to listen for:
 * - checkout.session.completed (battle pass purchase)
 * - payment_intent.succeeded (successful payment)
 * - payment_intent.payment_failed (failed payment)
 */
const stripeWebhook = onRequest({ cors: true }, async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

  let event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
  } catch (err) {
    logger.error(`Webhook signature verification failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  logger.info(`Received Stripe event: ${event.type}`);

  // Handle the event
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object);
        break;

      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;

      default:
        logger.info(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    logger.error(`Error handling webhook event ${event.type}:`, error);
    res.status(500).send('Webhook handler failed');
  }
});

/**
 * Handle successful checkout session
 * Grants battle pass to user
 */
async function handleCheckoutSessionCompleted(session) {
  logger.info(`Processing checkout session: ${session.id}`);

  const db = getDb();
  const uid = session.metadata.uid || session.client_reference_id;
  const seasonId = session.metadata.seasonId;
  const purchaseType = session.metadata.type;

  if (!uid) {
    logger.error(`No user ID found in session metadata: ${session.id}`);
    return;
  }

  if (purchaseType === 'battle_pass_purchase') {
    await grantBattlePass(uid, seasonId, session);
  }
}

/**
 * Grant Battle Pass to user
 */
async function grantBattlePass(uid, seasonId, session) {
  const db = getDb();
  const profileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`);

  try {
    await db.runTransaction(async (transaction) => {
      const profileDoc = await transaction.get(profileRef);
      if (!profileDoc.exists) {
        throw new Error(`User profile not found: ${uid}`);
      }

      const battlePass = profileDoc.data()?.battlePass;

      // Check if already premium (prevent double-granting)
      if (battlePass?.isPremium && battlePass?.seasonId === seasonId) {
        logger.warn(`User ${uid} already has premium for season ${seasonId}`);
        return;
      }

      // Grant premium battle pass
      const updates = {
        'battlePass.isPremium': true,
        'battlePass.purchaseDate': admin.firestore.FieldValue.serverTimestamp(),
        'battlePass.stripeSessionId': session.id,
        'battlePass.amount': session.amount_total / 100, // Convert from cents
      };

      // If no battle pass exists yet, initialize it
      if (!battlePass || battlePass.seasonId !== seasonId) {
        const seasonDoc = await db.doc("game-settings/battlePassSeason").get();
        if (seasonDoc.exists) {
          const currentSeason = seasonDoc.data();
          updates['battlePass'] = {
            seasonId: currentSeason.seasonId,
            seasonName: currentSeason.name,
            xp: 0,
            level: 1,
            isPremium: true,
            claimedRewards: {
              free: [],
              premium: [],
            },
            purchaseDate: admin.firestore.FieldValue.serverTimestamp(),
            stripeSessionId: session.id,
            amount: session.amount_total / 100,
          };
        }
      }

      transaction.update(profileRef, updates);
    });

    logger.info(`Successfully granted battle pass to user ${uid} for season ${seasonId}`);

    // Send purchase confirmation analytics event (optional)
    await db.collection('analytics_events').add({
      type: 'battle_pass_purchase',
      uid,
      seasonId,
      amount: session.amount_total / 100,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

  } catch (error) {
    logger.error(`Error granting battle pass to user ${uid}:`, error);
    throw error;
  }
}

/**
 * Handle successful payment
 */
async function handlePaymentSucceeded(paymentIntent) {
  logger.info(`Payment succeeded: ${paymentIntent.id}`);

  // Analytics tracking
  const db = getDb();
  await db.collection('analytics_events').add({
    type: 'payment_succeeded',
    paymentIntentId: paymentIntent.id,
    amount: paymentIntent.amount / 100,
    currency: paymentIntent.currency,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });
}

/**
 * Handle failed payment
 */
async function handlePaymentFailed(paymentIntent) {
  logger.error(`Payment failed: ${paymentIntent.id}`, {
    error: paymentIntent.last_payment_error,
  });

  // Analytics tracking
  const db = getDb();
  await db.collection('analytics_events').add({
    type: 'payment_failed',
    paymentIntentId: paymentIntent.id,
    amount: paymentIntent.amount / 100,
    error: paymentIntent.last_payment_error?.message || 'Unknown error',
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });
}

module.exports = {
  stripeWebhook,
};
