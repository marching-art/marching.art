const { onRequest } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const { getDb } = require("../config");

// Lazy-load Stripe to avoid initialization errors during deployment
let _stripe = null;
function getStripe() {
  if (!_stripe) {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY environment variable not set");
    }
    _stripe = require("stripe")(stripeKey);
  }
  return _stripe;
}

/**
 * Stripe Webhook Handler
 * Handles payment events from Stripe
 *
 * Currently unused - placeholder for future payment integrations.
 * Configure webhook in Stripe dashboard if needed.
 */
const stripeWebhook = onRequest({ cors: true }, async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

  let event;

  try {
    // Verify webhook signature
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
  } catch (err) {
    logger.error(`Webhook signature verification failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  logger.info(`Received Stripe event: ${event.type}`);

  // Handle the event
  try {
    switch (event.type) {
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
