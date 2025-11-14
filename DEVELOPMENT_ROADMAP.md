# marching.art Development Roadmap
*Based on Ultimate Fantasy Drum Corps Game Guidelines*
*Last Updated: November 14, 2025*

## Executive Summary

This roadmap outlines the comprehensive implementation plan to transform marching.art into the ultimate fantasy drum corps game. All code must meet pinnacle standards of design, architecture, and scalability for 10,000+ users.

---

## Current State Assessment ✓

### ✅ Foundation Complete
- **React 18** with modern hooks and Suspense
- **Firebase v11** integration (Auth, Firestore, Functions, Storage, Analytics)
- **Tailwind CSS** with custom cream/black/gold theme
- **Framer Motion** animations
- **React Router v6** with protected routes
- **Comprehensive Firestore security rules**
- **Basic season calculation helpers**
- **Backend functions structure** (callable, scheduled, triggers)

### ✅ Partially Implemented
- **Dashboard** - Corps registration modal, basic UI
- **Caption Selection** - Modal exists but missing dynamic pricing
- **Profile System** - Basic XP tracking but not progression unlocks
- **Authentication** - Email/password working
- **Leaderboard** - Structure exists but needs data

### ❌ Critical Missing Features

#### 1. **Game Mechanics** (PRIORITY 1)
- [ ] Dynamic caption pricing (25 corps with values 1-25)
- [ ] Point limits enforcement (SoundSport: 90, A: 60, Open: 120, World: 150)
- [ ] XP progression with class unlock requirements
- [ ] Show selection system (4 shows/week, unlimited final week)
- [ ] Caption change limits and tracking
- [ ] No duplicate lineup validation (first submitted wins)

#### 2. **Season Management** (PRIORITY 1)
- [ ] Automated 49-week cycle (6x7 off-season + 1x10 live season)
- [ ] Season reset at 0300 after finals (2nd Saturday of August)
- [ ] Competition schedule with specific championship days:
  - Day 28: Southwestern Championship
  - Day 35: Season Championship
  - Days 41-42: Eastern Classic (random performance day assignment)
  - Day 45: Open/A Class Prelims (Marion, IN)
  - Day 46: Open/A Class Finals (Marion, IN)
  - Day 47: World Championships Prelims (Indianapolis, IN)
  - Day 48: World Championships Semifinals (Indianapolis, IN)
  - Day 49: World Championships Finals + SoundSport Festival (Indianapolis, IN)

#### 3. **Scoring System** (PRIORITY 1)
- [ ] Historical score data integration from `historical_scores/{year}/data`
- [ ] Generative scoring with curves when data unavailable
- [ ] Caption-specific scoring with staff member bonuses
- [ ] Caption award winners at all events
- [ ] Tie-breaking logic (staff bonuses, then random)
- [ ] GE = 40pts, Visual Total = 30pts, Music Total = 30pts
- [ ] Proper score calculation: Visual = (VP + VA + CG)/2, Music = (B + MA + P)/2

#### 4. **Gamification** (PRIORITY 2)
- [ ] **XP System:**
  - Daily rehearsal button (once per 23 hours)
  - League engagement rewards
  - Comment/chat participation
  - Performance completion bonuses
  - Level-based progression (1-10+)
- [ ] **Class Unlocking:**
  - SoundSport: Always available
  - A Class: Level 3, locks 4 weeks before season end
  - Open Class: Level 5, locks 5 weeks before season end
  - World Class: Level 10, locks 6 weeks before season end
- [ ] **CorpsCoin Currency:**
  - Earned per performance (tiered by class)
  - Staff member marketplace
  - Equipment purchases (buses, trucks)
  - Direct unlock purchases for locked classes

#### 5. **Staff Management System** (PRIORITY 2)
- [ ] Admin panel for staff database management
- [ ] Staff fields: Name, Caption, Year Inducted, Biography
- [ ] Value based on induction year (oldest = least, newest = most)
- [ ] Purchase with CorpsCoin
- [ ] Apply one staff per caption per corps per season
- [ ] Staff value increases after each completed season
- [ ] Staff marketplace for resale
- [ ] Caption-specific staff assignment
- [ ] Staff bonus scoring logic

#### 6. **Equipment & Logistics** (PRIORITY 3)
- [ ] Bus and truck purchase/upgrade system
- [ ] Equipment health tracking
- [ ] Random breakdown events (small % chance of 0 score if health < 10)
- [ ] Repair and maintenance costs

#### 7. **Social Features** (PRIORITY 2)
- [ ] **Leagues:**
  - Creation and management
  - Public/private settings
  - Membership directory with profile links
  - League-specific leaderboards
  - Weekly matchups generation
- [ ] **League Chat:**
  - Real-time messaging
  - Message history
  - Notifications
- [ ] **Profile Pages:**
  - Public visibility
  - Active corps display with latest scores
  - Season schedules
  - Corps bios and show concepts
  - Historical stats and milestones
  - Comment sections
  - Rivalry/alliance declarations
- [ ] **Comment System:**
  - Profile comments
  - Notifications
  - Moderation tools

#### 8. **Advanced Features** (PRIORITY 3)
- [ ] **Uniform Builder:**
  - 3D model (three.js or react-three-fiber)
  - Color pickers
  - Pattern/texture selectors
  - Save configurations
  - Public showcase with voting
- [ ] **Show Concept Synergy:**
  - Theme selection (Primary Theme, Music Source, Drill Style)
  - Synergy bonuses in scoring
  - Tags matching system
- [ ] **Historical DCI Analytics:**
  - Comprehensive score analysis tools
  - Trend charts and comparisons
  - Hide future scores/curves (no cheating)
  - Filter by corps, year, caption

#### 9. **Admin Tools** (PRIORITY 2)
- [ ] Season management controls
- [ ] Staff database management
- [ ] Manual season triggers
- [ ] User role management
- [ ] Corps data curation (25 corps per season)
- [ ] Historical data import tools
- [ ] Monitoring dashboard

---

## Database Schema (Firestore)

### Critical Collections

```
artifacts/marching-art/users/{uid}/
  ├── profile/data
  │   ├── uid, email, displayName
  │   ├── xp, xpLevel
  │   ├── unlockedClasses: ['soundSport', 'aClass', 'open', 'world']
  │   ├── corpsCoin: number
  │   ├── achievements: []
  │   ├── stats: { seasonsPlayed, championships, topTenFinishes }
  │   ├── corps: {
  │   │   soundSport: { name, location, showConcept, class, lineup, score, rank, seasonId }
  │   │   aClass: { ... }
  │   │   open: { ... }
  │   │   world: { ... }
  │   │ }
  │   ├── staff: [{ staffId, caption, purchaseDate, value, seasonsCompleted }]
  │   └── equipment: { bus: { level, health }, truck: { level, health } }
  │
  ├── comments/{commentId}
  ├── notifications/{notificationId}
  └── showSelections/{seasonId}

dci_data/{seasonId}/
  └── corpsValues/{corpsId}
      ├── name, year, value (1-25)
      └── captions: { GE1, GE2, VP, VA, CG, B, MA, P } (historical scores)

historical_scores/{year}/
  └── data/{corpsId}
      └── performances: [{ date, show, scores: { GE1, GE2, ... }, total }]

fantasy_recaps/{seasonId}/
  └── recaps: [{ date, showName, userId, corpsName, scores, rank, totalScore }]

leaderboards/{seasonId}/
  └── rankings: [{ userId, corpsName, class, score, rank, lastUpdated }]

season_settings/current
  ├── seasonId, type ('live' | 'off'), year
  ├── startDate, endDate, currentWeek, currentDay
  ├── events: [{ day, name, location, type, eligibleClasses }]
  └── registrationLocks: { world: 6, open: 5, aClass: 4 }

activeLineups/{lineup}/{seasonId}_{uid}
  └── lineup hash for duplicate prevention

staff_database/{staffId}
  ├── name, caption, yearInducted, biography
  ├── baseValue: number
  └── available: boolean

staff_marketplace/{listingId}
  ├── staffId, sellerId, price, seasonsCompleted, currentValue
  └── listedAt

leagues/{leagueId}/
  ├── name, description, isPublic, members: []
  ├── chat/{messageId}
  └── matchups/{week}
```

---

## Implementation Phases

### Phase 1: Core Game Mechanics (Weeks 1-2)

#### Week 1: Caption Selection & Pricing
1. **Create 25-corps value system**
   - Implement `dci_data/{seasonId}/corpsValues` structure
   - Add value assignment (1-25) based on historical performance
   - Build caption-specific score tracking

2. **Dynamic pricing in caption selection**
   - Update `CaptionSelectionModal` component
   - Display corps value next to each option
   - Calculate total point value in real-time
   - Enforce class-specific limits (90/60/120/150)
   - Visual indicators for point budget

3. **Lineup validation**
   - Hash lineup to unique string
   - Check `activeLineups/{lineup}` collection
   - Prevent duplicate submissions (first wins)
   - Notify users of conflicts

#### Week 2: XP & Progression
1. **XP earning mechanisms**
   - Daily rehearsal button (Dashboard)
   - Cloud function: `dailyRehearsal` (+10 XP, 23hr cooldown)
   - Performance completion bonuses (tiered by class)
   - League engagement tracking
   - Comment/chat participation (+1 XP per action)

2. **Level calculation**
   - XP thresholds: Level = floor(XP / 1000) + 1
   - Update `profile.xpLevel` on XP change
   - Unlock classes based on level:
     - Level 3: A Class
     - Level 5: Open Class
     - Level 10: World Class

3. **Registration restrictions**
   - Update `CorpsRegistrationModal` component
   - Check `unlockedClasses` array
   - Check weeks remaining vs class locks
   - Show XP progress to next unlock
   - Option to unlock with CorpsCoin

### Phase 2: Season Automation (Weeks 3-4)

#### Week 3: Season Scheduler
1. **Automated season transitions**
   - Cloud function: `seasonScheduler` (runs daily at 0300)
   - Calculate current season based on finals date
   - Generate new season on reset
   - Update `season_settings/current`

2. **Competition schedule generation**
   - Create events array for 49-day cycle
   - Assign specific championship days (28, 35, 41-49)
   - Random performance day for Eastern Classic (41-42)
   - Set eligible classes per event

3. **Show selection UI**
   - Dashboard component: Weekly show selector
   - Display available shows for current week
   - 4-show limit (except final week)
   - Save to `showSelections/{seasonId}`

#### Week 4: Scoring Engine
1. **Historical data integration**
   - Import script for `historical_scores/{year}/data`
   - Firestore batch writes (500 docs at a time)
   - Organize by year, corps, performance

2. **Daily scoring processor**
   - Cloud function: `processDailyScores` (runs at 0200)
   - Fetch selected shows for the day
   - Match historical scores or generate via curve
   - Calculate GE (40pts), Visual (30pts), Music (30pts)
   - Apply staff bonuses
   - Determine caption winners
   - Write to `fantasy_recaps/{seasonId}`

3. **Leaderboard updates**
   - Update `leaderboards/{seasonId}/rankings`
   - Separate by class (World, Open, A, SoundSport)
   - Real-time ranking calculation
   - Update user profiles with latest rank

### Phase 3: CorpsCoin & Staff (Weeks 5-6)

#### Week 5: Currency System
1. **CorpsCoin earning**
   - Award after each performance
   - Tiered by class:
     - SoundSport: 0
     - A Class: 50
     - Open Class: 100
     - World Class: 200
   - Update `profile.corpsCoin`

2. **Spending mechanics**
   - Staff purchases
   - Equipment upgrades
   - Class unlocks (premium path)
   - Validation and transaction logging

#### Week 6: Staff Management
1. **Admin panel**
   - Staff database CRUD operations
   - Fields: Name, Caption, Year Inducted, Bio
   - Value calculation (based on year)
   - Caption distribution counter

2. **Staff marketplace**
   - Browse available staff
   - Filter by caption, value range
   - Purchase with CorpsCoin
   - Add to `profile.staff` array
   - Assign to corps caption

3. **Staff in scoring**
   - Fetch assigned staff for each corps
   - Apply bonus to caption score
   - Tie-breaking logic
   - Value increase after season completion

### Phase 4: Social & Leagues (Weeks 7-8)

#### Week 7: Profile Pages
1. **Public profile UI**
   - Route: `/profile/:userId`
   - Display: Name, location, about
   - Active corps cards with uniforms
   - Season schedules
   - Historical stats and milestones
   - Comment section

2. **Comment system**
   - Create/read/update/delete comments
   - Notifications for profile owner
   - Moderation tools (report, delete)

#### Week 8: Leagues
1. **League creation & management**
   - Cloud function: `createLeague`
   - Public/private settings
   - Commissioner role
   - Member invitations

2. **League chat**
   - Real-time messaging (Firestore subcollection)
   - Message notifications
   - Chat history pagination

3. **League leaderboards**
   - Filter rankings by league members
   - Weekly matchups generation
   - Head-to-head comparisons

### Phase 5: Advanced Features (Weeks 9-10)

#### Week 9: Analytics & Tools
1. **Historical DCI data tools**
   - Dashboard analytics component
   - Chart.js integration
   - Score trend visualization
   - Corps comparison tools
   - Caption-specific analysis

2. **Show concept synergy**
   - Theme selector UI
   - Synergy tag system
   - Bonus calculation in scoring
   - Theme library

#### Week 10: Polish & Optimization
1. **Uniform builder (MVP)**
   - Basic 3D model or 2D configurator
   - Color pickers
   - Save to profile
   - Display on profile page

2. **Performance optimization**
   - Code splitting
   - Image optimization
   - Bundle size reduction
   - Lighthouse score > 90

3. **Testing & QA**
   - End-to-end testing
   - Load testing (10k users simulation)
   - Security audit
   - Bug fixes

---

## Technical Standards

### Code Quality
- **TypeScript** conversion for type safety (future enhancement)
- **ESLint** with strict rules
- **Prettier** for formatting
- **Component documentation** with JSDoc
- **Error boundaries** for graceful failures
- **Loading states** for all async operations
- **Optimistic UI updates** where appropriate

### Performance Targets
- **First Contentful Paint:** < 1.5s
- **Time to Interactive:** < 3s
- **Lighthouse Score:** 90+
- **Bundle Size:** < 500KB gzipped
- **Firestore reads:** Minimize with caching
- **Cloud Functions:** Cold start < 2s

### Security
- **Input validation** on all forms
- **XSS prevention** (React default + sanitization)
- **CSRF protection** via Firebase tokens
- **Rate limiting** on functions
- **Content moderation** for user-generated content
- **Firestore rules** comprehensive coverage

### Scalability (10,000 Users)
- **Firestore indexing** for all queries
- **Pagination** for large lists
- **Batch operations** for writes
- **Cloud Functions** horizontal scaling
- **CDN** for static assets (Vercel)
- **Database sharding** if needed (by season)

---

## Development Workflow

### Daily Practices
1. **Feature branch** per task
2. **Commit early and often** with descriptive messages
3. **Test locally** before pushing
4. **Code review** (self-review checklist)
5. **Deploy to preview** before production

### Git Workflow
```bash
# Always work on feature branches starting with 'claude/'
git checkout -b claude/feature-name-{session-id}

# Commit with clear messages
git commit -m "feat: Add dynamic caption pricing system"

# Push with tracking
git push -u origin claude/feature-name-{session-id}
```

### Testing Strategy
- **Unit tests:** Critical functions
- **Integration tests:** API calls
- **E2E tests:** User flows (Cypress future)
- **Manual testing:** UI/UX verification
- **Load testing:** Firebase emulator with 100+ users

---

## Monitoring & Analytics

### Firebase Analytics Events
- `login` - User authentication
- `sign_up` - New account creation
- `corps_created` - Corps registration
- `caption_selected` - Caption lineup saved
- `league_joined` - League membership
- `show_selected` - Show selection
- `staff_purchased` - Staff acquisition
- `daily_rehearsal` - XP earning action

### Performance Monitoring
- **Cloud Functions:** Execution time, errors, concurrency
- **Firestore:** Read/write counts, query performance
- **Vercel:** Response times, cache hit rates
- **User engagement:** DAU, retention, session length

---

## Risk Mitigation

### Data Loss Prevention
- **Firestore backups:** Automated daily
- **Transaction logs:** All CorpsCoin and XP changes
- **Rollback procedures:** Cloud Functions versioning
- **User data export:** GDPR compliance

### Performance Degradation
- **Monitoring alerts:** Response time thresholds
- **Fallback mechanisms:** Cached data when Firestore slow
- **Circuit breakers:** Disable expensive features if needed
- **Load shedding:** Queue system for scoring

### Security Incidents
- **Incident response plan:** Documented procedures
- **User reporting:** Easy moderation tools
- **Rate limiting:** Prevent abuse
- **Audit logs:** Admin actions tracked

---

## Success Metrics

### Engagement (Primary)
- **Daily Active Users (DAU):** > 40% of registered
- **Average Session Duration:** > 10 minutes
- **Retention:** 50% Day-7, 30% Day-30
- **Corps per User:** Average 2+

### Performance (Technical)
- **Uptime:** 99.9%
- **Error Rate:** < 0.1%
- **Avg Response Time:** < 500ms
- **Lighthouse Score:** > 90

### Growth (Secondary)
- **New Users:** 50+ per week
- **League Creation:** 10+ per month
- **Buy Me a Coffee:** Support tier unlocked

---

## Next Steps (Immediate)

1. ✅ Complete this roadmap document
2. [ ] Set up development environment variables
3. [ ] Begin Phase 1, Week 1: Caption Selection & Pricing
4. [ ] Create reusable UI components library
5. [ ] Import initial historical scores data
6. [ ] Build admin panel foundation

---

*This is a living document. Update as features evolve and priorities shift.*
*All development must follow the "pinnacle standard" of quality and scalability.*
