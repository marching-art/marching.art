# marching.art Priority List

> Generated: December 2025

## Priority 1: Critical (Blocking)

### 1.1 Security: Rotate Exposed Credentials
- **Issue**: Firebase credentials exposed in `.env.production` (committed to git history)
- **Impact**: Security vulnerability
- **Status**: **PARTIALLY FIXED**
  - ✅ Added `.env.production` to `.gitignore`
  - ✅ Removed `.env.production` from git tracking
  - ✅ Created `.env.production.example` template
  - ⚠️ **USER ACTION REQUIRED**: Rotate Firebase API keys in Firebase Console (old keys still in git history)
  - ⚠️ **USER ACTION REQUIRED**: Set env vars in Vercel dashboard instead of committed file

### 1.2 Deploy Cloud Functions
- **Issue**: Functions exist in `functions/` but aren't deployed to production
- **Impact**: Backend features non-functional in production
- **Status**: **USER HANDLING**
- **Action**:
  - Run `firebase deploy --only functions`
  - Verify all 12 callable functions are live
  - Test each endpoint

### 1.3 Remove Exposed Admin UID
- **Issue**: Admin UID hardcoded/exposed in codebase
- **Impact**: Security risk
- **Status**: **FIXED**
  - ✅ Code uses `VITE_ADMIN_UIDS` env var (no hardcoded fallback)
  - ✅ Firestore rules use Firebase custom claims (`request.auth.token.admin`)
  - ✅ Admin UID removed from git tracking (was in `.env.production`)

---

## Priority 2: High (Core Functionality)

### 2.1 Complete League System (Currently 75%)
- **Missing**: Staff trading between league members
- **Impact**: Key social feature incomplete
- **Action**:
  - Implement `proposeStaffTrade()` function
  - Implement `acceptTrade()` / `rejectTrade()` functions
  - Add trade UI to league pages

### 2.2 Fix Firestore Security Rules
- **Issue**: Overly permissive read access
- **Impact**: Data exposure risk
- **Action**:
  - Audit `firestore.rules`
  - Restrict read access to authenticated users where appropriate
  - Add field-level security for sensitive data

### 2.3 Clean Up False Feature Claims
- **Issue**: `HowToPlay.jsx` documents non-existent features (staff marketplace, equipment maintenance)
- **Impact**: User confusion
- **Action**: Update HowToPlay to reflect actual features only

---

## Priority 3: Medium (Quality & Performance)

### 3.1 Performance Optimizations
- **Status**: **PARTIALLY FIXED**
  - ✅ Added React.memo to key list components (ScoreRow, ShowCard, LeagueCard)
  - ✅ Updated logger utility to use Vite's `import.meta.env.DEV`
  - ⚠️ Remaining: N+1 queries, code splitting, bundle size optimization

### 3.2 Remove Console Statements
- **Status**: **FIXED**
  - ✅ Created centralized logger utility (`logError`, `logInfo`, `logWarn`)
  - ✅ Logger only outputs in development mode
  - ✅ Updated firebase.js to use logger

### 3.3 Accessibility Improvements
- **Status**: **FIXED**
  - ✅ Fixed TabTrigger missing `id` attribute (broken aria-labelledby)
  - ✅ Added `tabIndex` management to Tabs
  - ✅ Added focus trapping to Modal component
  - ✅ Added auto-focus on modal open
  - ✅ Added focus restoration on modal close
  - ✅ Fixed ShowDetailModal with role="dialog", aria-modal, ESC key support

### 3.4 Complete ESPN Redesign
- **Status**: **COMPLETE**
  - ✅ Badge integration in navigation (already implemented)
  - ✅ ARIA accessibility improvements
  - ✅ Design system fully implemented in tailwind.config.cjs

---

## Priority 4: Low (Technical Debt)

### 4.1 TypeScript Migration
- **Issue**: Mixed `.js` and `.tsx` files
- **Action**: Convert remaining JS files to TypeScript

### 4.2 Remove Dead Code
- Delete unused type definitions (Equipment, Staff interfaces with no backend)
- Remove commented-out code
- Clean up unused imports

### 4.3 Code Duplication
- Extract shared logic from duplicate implementations
- Create shared utilities where patterns repeat

### 4.4 Update Dependencies
- Update outdated packages
- Address Storybook vulnerability (if still using)

---

## Priority 5: Future Features (Backlog)

These were intentionally removed/simplified per the redesign plan. Only implement if product direction changes:

| Feature | Status | Notes |
|---------|--------|-------|
| Staff System | Types only | No backend, intentionally cut |
| Equipment System | Types only | No backend, intentionally cut |
| Execution Multiplier | Removed | Simplified game design |
| Daily Operations | Minimal | Only XP check-in remains |
| Message Reactions | Stubbed | Low priority social feature |
| Voice Channels | Stubbed | Complex infrastructure needed |

---

## Quick Wins (Can Do Today)

1. ✅ Add `.env.production` to `.gitignore` - **DONE**
2. ⚠️ Update `HowToPlay.jsx` to remove false feature claims - **PENDING**
3. ✅ Remove/replace `console.error` statements - **DONE** (centralized logger)
4. ⚠️ Deploy Cloud Functions to production - **USER HANDLING**

---

## Recommended Order of Execution

```
Week 1: Security (P1)
├── Rotate credentials
├── Deploy functions
└── Fix admin UID exposure

Week 2: Core Features (P2)
├── League trading
├── Firestore rules audit
└── HowToPlay cleanup

Week 3-4: Quality (P3)
├── Performance fixes
├── Accessibility
└── ESPN redesign completion

Ongoing: Technical Debt (P4)
├── TypeScript migration
├── Dead code removal
└── Dependency updates
```

---

## Metrics to Track

| Metric | Current | Target |
|--------|---------|--------|
| Lighthouse Performance | Unknown | 90+ |
| Accessibility Score | ~80% (improved) | 90%+ |
| TypeScript Coverage | Mixed | 100% |
| Test Coverage | Unknown | 80%+ |
| Bundle Size (gzip) | Unknown | <500KB |
