# Buy Me a Coffee supporters

Recurring "buy me a coffee" memberships grant **cosmetic recognition only** — a
profile flair tier, a spot on the public Supporters wall, and a Discord role
handled natively by BMAC. Nothing here touches CorpsCoin, XP, class unlocks, or
scoring: marching.art is donation-only and stays no-pay-to-win.

## Tiers

Derived from the **monthly USD amount**, so the BMAC membership level prices
must match these floors. We map by amount rather than by BMAC's membership
level name because the same logic also covers generic `recurring_donation`
support (which has no level name) and because amounts are stable across
creators. Yearly plans are normalized to their monthly-equivalent (amount ÷ 12),
so price yearly tiers at exactly 12× the monthly floor to land on the intended
tier. Defined once in `functions/src/helpers/bmacSupporters.js` and mirrored for
display in `src/utils/supporterTiers.ts`.

The parser reads both payload shapes: the **webhook** subscription event
(`supporter_email`, `amount`, `status`, `duration_type`, `membership_level_name`)
and the **REST** `/subscriptions` record used by the nightly reconcile
(`payer_email`, `subscription_coffee_price` × `subscription_coffee_num`).

| Tier | Monthly | Flair |
| --- | --- | --- |
| Rookie | $3 | Supporter heart + listed on the wall |
| Veteran | $6 | + coffee-cup accent |
| Staff | $12 | + rarer badge |
| Corps Angel | $25 | + pinned in gold with a custom wall message |

## Architecture

```
BMAC hosts payment
  → membership.* webhook (HMAC-verified)   → bmacWebhook (functions)
      → supporters/{emailHash} doc (server-only, PII)
  → supporter links the paid email in Settings → linkBmacSupport
      → profile.supporter = { tier } mirrored for flair
  → getSupportersWall (callable) → public /supporters page (emails redacted)
  → reconcileSupporters (nightly) → revokes lapsed memberships
```

- **Supporter doc** `artifacts/{ns}/supporters/{emailHash}` — keyed by the
  SHA-256 of the payer email (raw email kept server-side only). Locked in
  `firestore.rules`; never client-readable.
- **Profile mirror** `profile.data.supporter` — server-only field (added to the
  protected-fields list in `firestore.rules`) that drives flair + the settings
  panel state.

## One-time setup (required to go live)

### 1. Secrets

```bash
# Personal access token from BMAC → Settings → API (for the nightly reconcile)
firebase functions:secrets:set BMAC_ACCESS_TOKEN

# Webhook signing secret from BMAC → Settings → Webhooks (verifies the webhook)
firebase functions:secrets:set BMAC_WEBHOOK_SECRET
```

### 2. Deploy, then register the webhook

```bash
firebase deploy --only functions:bmacWebhook,functions:linkBmacSupport,functions:setSupporterVisibility,functions:setSupporterMessage,functions:getSupportersWall,functions:reconcileSupporters
```

Copy the deployed `bmacWebhook` URL and add it in **BMAC → Settings →
Webhooks**, subscribed to at least:
`membership.started`, `membership.updated`, `membership.cancelled`,
`membership.paused` (and the `recurring_donation.*` equivalents).

### 3. Configure the membership levels

In BMAC, create four membership levels priced **$3 / $6 / $12 / $25** to match
the tier floors above.

### 4. Discord roles (no code)

BMAC assigns Discord roles natively — we build nothing for this:

1. BMAC → authorize your Discord server.
2. On each membership level, enable **"Give members access to selected Discord
   roles"** and pick the role(s).
3. Supporters click **Connect to Discord** in their BMAC membership tab; roles
   are assigned/removed automatically as memberships start/cancel.

## How a supporter gets flair

The email someone pays BMAC with is often a PayPal address that differs from
their marching.art login, so we don't auto-grant on email alone. In **Settings →
Support**, a member enters the email they paid with; `linkBmacSupport` binds it
to their account and grants the tier. They can opt out of being named on the
wall (default is shown), and Corps Angels can set a 60-character wall message.

## Privacy

Payer emails/names are PII. They live only in the locked `supporters`
collection (email stored as a SHA-256 key + raw value server-side for reconcile
matching), never in any client-readable doc. The wall exposes only display
name, username, tier, and the Corps Angel message, and honors the anonymous
opt-out. Add a supporter-data line to the privacy policy and wire a deletion
path for account/data-deletion requests.
