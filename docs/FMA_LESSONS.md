# marching.art — Lessons from Fantasy Marching Arts (August 2026)

An analysis of the full public forum history at **fantasymarchingarts.com**
(FMA) — the spiritual predecessor to marching.art — and what it teaches us
about building and sustaining a year-round fantasy marching game.

FMA (Alex Yoder / Metamorph Games) has run since ~2011 and reached **Season
141** by 2026 with ~133 active groups. Its public forums are a 14-year natural
experiment in what keeps players in a game exactly like ours — and, just as
usefully, a slow-motion record of how such a game declines. Every lesson below
is mapped to a concrete surface in this codebase.

---

## The headline fact

The core concept survived **14+ years and 141 seasons.** marching.art's
year-round loop (live season + off-season, both on the 49-day / 7-week
calendar) is validated by more than a decade of real retention. The question
was never "does this format work?" — it does. The forum's value is in showing
_where the engagement actually lives_ and _what erodes it over time_.

## What the forum's own volume reveals

Ranking FMA's forums by activity is a free readout of what players care about
most. The order is the lesson:

| Forum                          | Volume                    | What it proves                                                       |
| ------------------------------ | ------------------------- | ------------------------------------------------------------------- |
| **Press Releases**             | **1,422 topics** (most)   | Directors _narrating their corps' story_ is the #1 activity         |
| **General Discussion**         | 14,334 posts              | Site-wide social identity, returning-player culture, milestones      |
| **Drum Corps Circuit**         | 6,796 posts               | Talking about the _real_ activity keeps players engaged year-round   |
| **League Discussion**          | 4,969 posts               | Leagues are the social spine                                          |
| **Circuit News / Staff Writers** | 3,157 posts             | Human editorial voice and named commentators drove huge engagement   |
| **Suggestions**                | 2,124 posts               | A steady drumbeat of "please update the game"                        |
| **Bug Reports**                | 1,149 posts               | Concrete QA targets (see §7)                                         |

Press Releases and Leagues — identity and social connection — dwarf everything
else. That ordering should shape where we invest.

---

## The six highest-value lessons

### 1. Player-authored corps narratives are the deepest engagement engine — don't gate them

Press Releases was FMA's most-used forum by a wide margin (1,422 topics).
Directors post things like "Infinity Remains Undefeated with an 88.415 at Their
Home Show," corps returns, closures, and season themes — they _role-play being
a drum corps organization_. This is the identity layer that turns a leaderboard
into a world.

marching.art already has the raw material — `NewsSubmissionModal.jsx`,
`src/types/news.ts` (which already carries `authorUid` / `authorName` /
`authorUsername`), and `ArticleManagement`. **But every submission currently
routes through admin approval.** For a solo operator, that pre-moderation
bottleneck will suppress the exact behavior FMA proved is most valuable.

**Apply it:** give directors a low-friction, first-class "corps newsroom" that
_auto-publishes to their own corps/feed_ (trust + rate-limit + post-hoc
moderation), and reserve admin approval only for promotion to the _site-wide_
news hub. Let the volume happen.

> **Shipped (August 2026) — Director Press Releases.** A press release is
> instant, un-reviewed content a director writes about _their own
> organization_ (season reveals, staff moves, results and rivalries from their
> corps' POV), deliberately distinct from an admin-reviewed **news submission**
> (which covers the shared world). It publishes the moment it's posted, under
> the corps' byline, into the existing `press` news category — so it reuses the
> whole feed/article/reactions/comments/SEO pipeline. Accountability replaces
> the review queue with three constraints: the author must own the corps the
> release is bylined to, a per-uid write budget throttles abuse, and everything
> is moderatable after the fact (authors delete their own; admins remove any).
> Code: `publishPressRelease` / `deleteMyPressRelease`
> (`functions/src/triggers/newsSubmissions.js`), the pure domain logic and its
> tests in `functions/src/helpers/newsSubmissionsShared.js`, and the composer
> at `src/components/modals/PressReleaseModal.tsx`.

### 2. Stagnation — not a competitor — is what kills these games

FMA's Suggestions and Announcements forums read as a decline story:
"Game desperately needs update!", "More Updates Please," a large **"FMA
Rework" (2021)** after years of visible silence, a delayed season start
(S127), and even "Rollback to Post-Finals (sorry about that)." A single
overworked operator plus long, visible gaps produced churn.

**Apply it:** this is marching.art's structural advantage. We have real CI/CD,
seven blocking CI gates, and a high commit cadence. Make that cadence
_player-facing_: ship a persistent in-game changelog / "What's New" and a
public roadmap. FMA players were begging simply to know the game was alive —
we can answer that for free.

> **Shipped (August 2026) — the Updates page.** A public, crawlable `/updates`
> page shows a **changelog** ("Recent updates") and a **roadmap** ("On the
> horizon"). The source of truth is a repo-committed data module
> (`src/data/changelog.ts`) updated in the same PR that ships each change — no
> backend, no admin queue, so the log can't drift from the build. An
> unseen-updates badge (a teal dot on the site-links menu + a count) nudges
> returning directors and clears the moment they open the page; the watermark
> is per-device localStorage via a shared external store
> (`src/hooks/useUnseenUpdates.ts`) so every badge in the tab clears at once.
> The page is in the sitemap, so "the game is alive" is legible to search
> engines and prospective players too.

### 3. Moderation and anti-cheat scale with success; FMA never staffed for it

Recurring threads: "Moderator Desperately Needed" (multiple), "Remove all of
FastForward's alt accounts from FMA," "Suspicious/Controversial Accounts."
Alt-account abuse and thin moderation steadily corroded trust.

**Apply it:** marching.art's leagues, prediction pools, and CorpsCoin economy
are all zero-sum and therefore exploitable. Invest early in multi/alt-account
detection, rate limits, and admin moderation tooling — _before_ it's needed.
The substantial `firestore.rules` surface shows we take integrity seriously;
extend that posture explicitly to social and economic abuse vectors.

### 4. Human editorial voice beat automated content

FMA's "Circuit News / Staff Writers" forum (3,157 posts) and its
repeatedly-celebrated **Commentators** were a major draw — real people
narrating the season. marching.art currently leans on **Gemini-generated**
news.

**Apply it:** blend them. Keep AI for coverage volume, but create _credited
community writer / commentator roles_. The `NewsEntry` schema already stores
author identity, so the data model is ready — this is mostly a
roles-and-surfacing change. A masthead of human voices is retention FMA got
for free from volunteers.

### 5. Directors want to express identity beyond the numbers

FMA's Suggestions and dedicated sub-forums repeatedly asked for a **Uniform
Creator**, and it maintained standing **Artwork**, **Drill**, and **Music**
sub-forums. The most-requested features across 14 years were _creative_, not
competitive.

**Apply it:** our `showConcept`, corps-card, and prestige systems are the
seed. Prioritize cosmetic/creative expression — uniform/corps-identity
customization, show-program pages — which is cheap relative to new gameplay
systems and is precisely what players asked for, repeatedly, for over a decade.

### 6. Leagues + recognition are validated — keep pressing the advantage

Leagues (4,969 posts), a Hall of Fame, Fan-Favorite voting, and milestone
culture ("HELP AARON REACH 1000 POSTS!") were core to FMA retention. **This is
already marching.art's strongest area** — `LeagueActivityFeed`, league
prediction pools, rivalries, Hall of Champions, and weekly matchups all map
directly to what FMA players valued.

The one gap FMA _had_ that we can close: a **public, cross-league community
space**. marching.art currently has no open forum / message board — leagues
are siloed chats. FMA's General Discussion (14,334 posts) is where site-wide
culture and returning-player energy lived. A single lightweight public feed or
board would capture engagement that today has nowhere to go.

---

## 7. Free QA checklist from FMA's bug history

FMA's most common bug reports cluster in exactly the systems marching.art is
building. Treat this as a pre-written regression checklist:

- **League management:** creation failures, member-visibility bugs, invites not
  working, "remove from league" button persisting.
- **Event application / hosting:** double-applications, unable to edit events,
  unable to apply to one's own league events, one ensemble hosting two events.
- **Profile display:** final scores not showing, shows not appearing, avatars
  broken, medals not awarded.

---

## The one-sentence version

FMA proved the year-round fantasy-corps concept can last 14+ years, that
**player-authored corps storytelling and leagues are the engines**, and that
these games die from **operator stagnation, thin moderation, and gated
creativity** — three failure modes marching.art's engineering discipline is
uniquely positioned to avoid, _if_ we unblock director-authored content and
keep our update cadence visible.

---

## Suggested priority order for marching.art

1. **Unblock the corps newsroom** (Lesson 1) — **✅ shipped** (Director Press
   Releases; see the callout under Lesson 1). Natural fast-follow: a per-corps
   "Newsroom" section on the director profile that lists that corps' releases.
2. **Player-facing changelog / roadmap** (Lesson 2) — **✅ shipped** (the
   `/updates` page; see the callout under Lesson 2). Keep it current: add a
   `CHANGELOG` entry in the PR that ships each player-visible change.
3. **Public cross-league community feed** (Lesson 6 gap) — captures the
   site-wide culture layer we currently have nowhere to hold.
4. **Credited community writers/commentators** (Lesson 4) — schema-ready.
5. **Creative/cosmetic identity tools** (Lesson 5) — sustained, decade-long
   demand.
6. **Anti-abuse & moderation tooling** (Lesson 3) — invest ahead of scale, in
   step with economy growth.

---

_Sources: public forums at fantasymarchingarts.com (Announcements,
Suggestions, Bug Reports, General Discussion, League Discussion, Press
Releases, Circuit News), analyzed August 2026, cross-referenced against this
repository's current features and documentation._
