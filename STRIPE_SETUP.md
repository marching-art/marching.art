# 🔐 Stripe Setup Guide

## Step 1: Get Your Stripe Keys

### A. Publishable Key (Frontend) ✅ You have this!
```
Starts with: rk_test_ or pk_test_
Location: https://dashboard.stripe.com/test/apikeys
Safe to expose: Yes (it's public by design)
```

### B. Secret Key (Backend) - GET THIS NOW:
1. Go to: https://dashboard.stripe.com/test/apikeys
2. Find "Secret key" row
3. Click "Reveal test key"
4. Copy the key (starts with `sk_test_...`)

### C. Webhook Secret - GET THIS AFTER DEPLOYMENT:
1. Deploy Cloud Functions first
2. Go to: https://dashboard.stripe.com/test/webhooks
3. Click "Add endpoint"
4. Enter URL: `https://us-central1-marching-art.cloudfunctions.net/stripeWebhook`
5. Select events:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `charge.refunded`
6. Click "Add endpoint"
7. Copy "Signing secret" (starts with `whsec_...`)

---

## Step 2: Store Keys Securely

### Option A: Environment Variables (Recommended for Development)

Create `.env.local` file in your project root:

```bash
# .env.local (DO NOT COMMIT TO GIT!)
VITE_STRIPE_PUBLISHABLE_KEY=rk_test_YOUR_PUBLISHABLE_KEY_HERE
```

### Option B: Firebase Config (Required for Cloud Functions)

```bash
# Run these commands in your terminal:

# 1. Set Stripe secret key
firebase functions:config:set stripe.secret_key="sk_test_YOUR_KEY_HERE"

# 2. Set publishable key
firebase functions:config:set stripe.publishable_key="rk_test_YOUR_PUBLISHABLE_KEY"

# 3. Set webhook secret (after creating webhook)
firebase functions:config:set stripe.webhook_secret="whsec_YOUR_SECRET_HERE"

# 4. Verify configuration
firebase functions:config:get
```

---

## Step 3: Create Stripe Product

1. Go to: https://dashboard.stripe.com/test/products
2. Click "Add product"
3. Fill in:
   - **Name**: Battle Pass
   - **Description**: Season battle pass with exclusive rewards
   - **Pricing**: One-time payment
   - **Price**: $4.99 USD
4. Click "Save product"
5. Copy the **Product ID** (starts with `prod_...`)
6. Copy the **Price ID** (starts with `price_...`)

```bash
# Set in Firebase config:
firebase functions:config:set stripe.battle_pass_product_id="prod_YOUR_ID"
firebase functions:config:set stripe.battle_pass_price_id="price_YOUR_ID"
```

---

## Step 4: Use Keys in Your Code

### Frontend (React)

```javascript
// src/firebase.js or config file
export const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
```

### Backend (Cloud Functions)

```javascript
// functions/src/index.js
const functions = require('firebase-functions/v2');
const stripe = require('stripe')(functions.config().stripe.secret_key);

// Keys are automatically loaded from Firebase config
```

---

## Step 5: Test Mode vs. Live Mode

### Test Mode (What You're Using Now)
```
✅ Perfect for development
✅ No real money charged
✅ Use test cards (4242 4242 4242 4242)
✅ Test webhooks work exactly like live
```

### Live Mode (For Production)
When ready to launch:

1. Get live keys from: https://dashboard.stripe.com/apikeys
   - Live publishable key: `pk_live_...`
   - Live secret key: `sk_live_...`

2. Update Firebase config:
```bash
firebase functions:config:set stripe.secret_key="sk_live_YOUR_KEY"
firebase functions:config:set stripe.publishable_key="pk_live_YOUR_KEY"
firebase functions:config:set stripe.webhook_secret="whsec_LIVE_SECRET"
```

3. Create live webhook endpoint
4. Deploy functions: `firebase deploy --only functions`

---

## Step 6: Test Card Numbers (Stripe Test Mode)

Use these cards for testing:

### Success
```
Card: 4242 4242 4242 4242
Expiry: Any future date
CVC: Any 3 digits
ZIP: Any 5 digits
```

### Declined
```
Card: 4000 0000 0000 0002
Result: Card declined
```

### Requires Authentication (3D Secure)
```
Card: 4000 0027 6000 3184
Result: Prompts for authentication
```

---

## Security Checklist

- [x] `.env` files in `.gitignore` ✅
- [ ] Never commit secret keys to git
- [ ] Use test keys for development
- [ ] Use environment variables in production
- [ ] Verify webhook signatures (code handles this)
- [ ] Keep publishable key public (it's safe)
- [ ] Keep secret key SECRET (never expose)

---

## Quick Setup Commands

```bash
# 1. Install Stripe SDK in functions
cd functions
npm install stripe

# 2. Create .env.local in root
echo "VITE_STRIPE_PUBLISHABLE_KEY=rk_test_YOUR_PUBLISHABLE_KEY" > .env.local

# 3. Configure Firebase (replace YOUR_KEY with actual keys)
firebase functions:config:set \
  stripe.secret_key="sk_test_YOUR_SECRET_KEY" \
  stripe.publishable_key="rk_test_YOUR_PUBLISHABLE_KEY" \
  stripe.battle_pass_product_id="prod_YOUR_PRODUCT_ID" \
  stripe.battle_pass_price_id="price_YOUR_PRICE_ID"

# 4. Deploy functions
firebase deploy --only functions

# 5. Set up webhook (after deployment)
# Go to dashboard.stripe.com/test/webhooks
# Add endpoint: https://us-central1-marching-art.cloudfunctions.net/stripeWebhook

# 6. Add webhook secret
firebase functions:config:set stripe.webhook_secret="whsec_YOUR_WEBHOOK_SECRET"

# 7. Redeploy with webhook secret
firebase deploy --only functions
```

---

## Troubleshooting

### "No such customer" error
- Make sure you're using the correct API key (test vs. live)
- Verify customer was created in same mode

### Webhook not receiving events
- Check webhook URL is correct
- Verify webhook secret is set
- Check Firebase Functions logs
- Test webhook in Stripe dashboard

### "Invalid API key" error
- Secret key must start with `sk_test_` or `sk_live_`
- Publishable key must start with `pk_test_` or `pk_live_`
- Make sure no extra spaces when copying

---

## Next Steps

Once you have all three keys:
1. ✅ Publishable key (you have)
2. ⏳ Secret key (get from Stripe dashboard)
3. ⏳ Webhook secret (get after deploying functions)

Then you're ready to implement the battle pass system!

**Ready to get your secret key?** Go to https://dashboard.stripe.com/test/apikeys now!
