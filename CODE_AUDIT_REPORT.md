# Code Audit Report - marching.art

**Date:** December 14, 2025
**Auditor:** Claude Code
**Branch:** claude/code-audit-NoYGN

---

## Executive Summary

This comprehensive audit of the marching.art codebase identified **47 issues** across 6 categories. The application is a React-based fantasy drum corps gaming platform using Firebase, Vite, and Tailwind CSS.

### Risk Summary

| Category | Critical | High | Medium | Low |
|----------|----------|------|--------|-----|
| Security | 2 | 4 | 5 | 1 |
| Performance | 1 | 5 | 4 | 2 |
| Code Quality | 2 | 4 | 3 | 1 |
| Accessibility | 4 | 3 | 3 | 0 |
| Dependencies | 0 | 0 | 3 | 0 |

---

## 1. Security Audit

### CRITICAL Issues

#### 1.1 Hardcoded Firebase API Key
- **File:** `src/config/index.ts:69`
- **Issue:** Firebase API key exposed as fallback value
```typescript
apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyA4Qhjpp2MVwo0h0t2dNtznSIDMjlKQ5JE',
```
- **Risk:** API key visible in browser bundle and source code
- **Fix:** Remove hardcoded fallback, require environment variable

#### 1.2 Auth Token Passed via URL Parameter
- **File:** `src/App.jsx:85-92`
- **Issue:** Initial auth token passed via `__initial_auth_token` URL parameter
- **Risk:** Token visible in browser history, referer headers, and server logs
- **Fix:** Use secure HTTP-only cookies or browser storage with CSRF protection

### HIGH Issues

| File | Line | Issue |
|------|------|-------|
| `src/config/index.ts` | 54-56 | Hardcoded admin UID as fallback |
| `firestore.rules` | 8 | Admin UID exposed in security rules |
| `functions/src/callable/admin.js` | 18 | Error messages expose internal details |
| `firestore.rules` | 21-23 | User profiles publicly readable by all |

### MEDIUM Issues

| File | Issue |
|------|-------|
| `functions/middleware/rateLimiter.js:129` | Falls back to IP for unauthenticated users |
| `functions/src/callable/registerCorps.js:7` | Basic regex profanity filter only |
| `firestore.rules:50-52` | Collection group queries allow user enumeration |
| `firestore.rules:27-33` | Comments readable without authentication |
| `functions/src/webhooks/stripe.js:43` | Webhook error exposed in response |

### Recommendations

1. **Immediately** remove all hardcoded API keys and admin UIDs
2. Implement proper token-based auth without URL parameters
3. Restrict Firestore read access to authenticated users
4. Use centralized error handling that logs internally but returns generic messages

---

## 2. Performance Audit

### CRITICAL Issue

#### 2.1 Missing Component Memoization
- **Finding:** Only 1 of 132 React components uses `React.memo()` (SeasonInfo.jsx)
- **Impact:** Excessive re-renders across the entire application

### HIGH Issues

| File | Line | Issue |
|------|------|-------|
| `src/components/Admin/ScoresSpreadsheet.jsx` | 129-140 | N+1 query pattern: `getScore()` called for every cell |
| `src/hooks/useScoresData.js` | 237-270 | Multiple passes over data (flatMap, sort, Set operations) |
| `src/App.jsx` | 109-117 | AuthContext value recreated every render |
| `src/hooks/useDashboardData.js` | 81-110 | Missing dependency optimizations causing cascading re-renders |
| `src/components/Scores/Leaderboard.jsx` | 104 | LeaderboardRow not memoized (renders 50+ items) |

### MEDIUM Issues

| Component | Issue |
|-----------|-------|
| `Celebration.jsx` | `blur-3xl` + `animate-pulse` causes layout thrashing |
| Framer Motion | Not lazy-loaded, included in main bundle |
| Chart.js | Loaded globally instead of dynamically imported |
| ThemeContext | Value object created inline every render |

### Recommendations

1. Add `React.memo()` to list item components (LeaderboardRow, ActivityItem)
2. Wrap event handlers with `useCallback`
3. Memoize AuthContext and ThemeContext values with `useMemo`
4. Refactor `useScoresData` for single-pass data processing
5. Lazy load Framer Motion and Chart.js for non-critical pages

---

## 3. Code Quality Audit

### CRITICAL Issues

#### 3.1 Code Duplication
- `getCorpsClassName` defined 3 times
- `formatSeasonName` defined 4 times
- `getCorpsClassColor` defined 2 times

**Locations:**
- `src/components/SeasonSetupWizard/constants.js`
- `src/hooks/useDashboardData.js`
- `src/hooks/useCorpsSelection.ts`
- `src/api/season.ts`
- `src/firebase.js`

#### 3.2 Oversized Components

| File | Lines | Issue |
|------|-------|-------|
| `src/pages/Profile.jsx` | 1264 | Massive with settings integration |
| `src/components/CaptionSelection/CaptionSelectionModal.jsx` | 1110 | Complex modal with internal state |
| `src/pages/Dashboard.jsx` | 970 | Multiple sections, high state complexity |
| `src/pages/Leagues.jsx` | 920 | Complex league UI and logic |

### HIGH Issues

| Category | Issue |
|----------|-------|
| TypeScript | Mixed .js/.jsx/.ts/.tsx (99 JSX, 28 JS, 56 TS/TSX) |
| Dead Code | ~1238 lines of commented code |
| Error Handling | Only 9 files have try-catch blocks |
| Console | 18+ console.error statements in production code |

### MEDIUM Issues

- Multiple ErrorBoundary implementations (JSX, TSX, PageErrorBoundary)
- Large hook files (useDashboardData 559 lines)
- Inconsistent CorpsClass enum format across files

### Recommendations

1. Consolidate utility functions into `src/utils/`
2. Split large components into focused sub-components
3. Remove all commented code
4. Migrate .js/.jsx to .ts/.tsx gradually
5. Implement centralized logging utility

---

## 4. Accessibility Audit

### CRITICAL Issues

#### 4.1 Broken ARIA References
- **File:** `src/components/ui/Tabs.tsx:110`
- **Issue:** TabTrigger missing `id` attribute, breaking `aria-labelledby` reference

#### 4.2 Missing Dialog Semantics
- **File:** `src/components/Scores/ShowDetailModal.jsx`
- **Missing:** `role="dialog"`, `aria-modal="true"`, `aria-labelledby`

#### 4.3 Non-Keyboard Accessible Interactive Elements
- **File:** `src/components/Scores/ShowCard.jsx:15-19`
- **Issue:** `<motion.div>` with `onClick` is not keyboard accessible

#### 4.4 Focus Not Trapped in Modals
- Modal component has `useFocusTrap` utility but doesn't implement it
- ShowDetailModal and SeasonHistoryModal don't trap focus

### HIGH Issues

| Issue | Files Affected |
|-------|---------------|
| `prefers-reduced-motion` not respected | 93 files use Framer Motion animations |
| Images with empty alt text | Profile.jsx, Settings.jsx |
| Missing `<main>` landmark element | Application layout |

### MEDIUM Issues

- Opacity-reduced text (text-cream-500/40) may not meet WCAG AA contrast
- Form error messages missing `aria-describedby`
- Modal missing explicit `role="dialog"`

### Recommendations

1. Add `id={`tab-${value}`}` to TabTrigger buttons
2. Implement focus trapping in all modals
3. Add `role="dialog"` and `aria-modal="true"` to ShowDetailModal
4. Make ShowCard a `<button>` element
5. Add `useShouldReduceMotion()` checks to all animated components

---

## 5. Dependencies Audit

### Security Vulnerabilities
**Result:** 0 vulnerabilities found (npm audit clean)

### Outdated Packages

| Package | Current | Latest | Priority |
|---------|---------|--------|----------|
| firebase | 11.0.2 | 12.6.0 | **Major** - Review breaking changes |
| framer-motion | 11.11.21 | 12.23.26 | **Major** - Review breaking changes |
| react-router-dom | 6.28.0 | 7.10.1 | **Major** - Significant API changes |
| react | 18.3.1 | 19.2.3 | **Major** - React 19 available |
| lucide-react | 0.460.0 | 0.561.0 | Minor - Safe to update |
| zustand | 4.5.5 | 5.0.9 | **Major** - Review breaking changes |

### Recommendations

1. Review breaking changes for major version updates
2. Update minor/patch versions for security and bug fixes
3. Consider React 19 migration roadmap
4. Test thoroughly after firebase and react-router-dom updates

---

## 6. Architecture Summary

### Strengths
- Well-organized directory structure with path aliases
- Good separation of concerns (API, components, hooks, stores)
- Proper code splitting configured in Vite
- PWA support with service worker
- React Query for server state management
- Zustand for global state

### Areas for Improvement
- TypeScript coverage incomplete
- Component size too large in key pages
- Error handling inconsistent
- Accessibility not prioritized
- Performance optimizations missing

---

## Priority Action Items

### Immediate (This Week)
1. Remove hardcoded API keys from `src/config/index.ts`
2. Remove hardcoded admin UIDs from source code
3. Stop passing auth tokens via URL parameters
4. Fix broken ARIA references in Tabs component

### High Priority (Next 2 Weeks)
5. Add React.memo to top 20 most-rendered components
6. Fix AuthContext value memoization
7. Implement focus trapping in modals
8. Add keyboard accessibility to ShowCard
9. Remove all console statements in production

### Medium Priority (Next Month)
10. Consolidate duplicate utility functions
11. Split oversized components (Profile, Dashboard, Leagues)
12. Migrate remaining .js/.jsx to TypeScript
13. Add prefers-reduced-motion support to animations
14. Update outdated dependencies

---

## Files Requiring Immediate Attention

| File | Issues |
|------|--------|
| `src/config/index.ts` | Hardcoded API key, admin UID |
| `src/App.jsx` | URL token auth, AuthContext not memoized |
| `src/components/ui/Tabs.tsx` | Broken aria-labelledby |
| `src/components/Scores/ShowDetailModal.jsx` | Missing ARIA, no focus trap |
| `src/components/Scores/ShowCard.jsx` | Not keyboard accessible |
| `firestore.rules` | Hardcoded UID, overly permissive reads |
| `src/hooks/useScoresData.js` | Performance issues |
| `src/pages/Profile.jsx` | 1264 lines, needs splitting |

---

*This report was generated by Claude Code. For questions or clarifications, please review the specific files and line numbers referenced above.*
