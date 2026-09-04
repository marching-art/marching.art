// =============================================================================
// GAME GUIDE DATA - SHARED BY /guide (in-app) AND /how-to-play (public)
// =============================================================================
// Kept in its own module (not exported from a component file) so game facts
// stay in one place without breaking React fast refresh.

import { CAPTIONS as CAPTION_DEFS } from '../data/captions';
import { REGISTRATION_LOCK_WEEKS } from '../utils/classRegistry';
import { CAPTION_CATEGORIES, CAPTION_WARS_SEASON_COST } from '../utils/captionWars';
import { ONE_NIGHT_SEASON_COST } from '../utils/oneNightSlate';
import {
  LEAGUE_WEEKLY_WIN_CC,
  LEAGUE_POOL_ANTE_CC,
  DEFAULT_FINALS_SIZE,
} from '../utils/leagueEconomy';
import { XP_SOURCES } from '../utils/captionPricing';

// The guide labels each caption by id + full name (from the canonical source)
// with its own longer explanatory copy.
const GUIDE_CAPTION_DESCRIPTIONS = {
  GE1: 'Overall show design and creativity',
  GE2: 'Performance quality and audience impact',
  VP: 'Marching and movement execution',
  VA: 'Visual design and staging',
  CG: 'Flag, rifle, and saber performance',
  B: 'Horn line performance quality',
  MA: 'Musical arrangement and design',
  P: 'Battery and front ensemble',
};

export const CAPTIONS = CAPTION_DEFS.map((c) => ({
  abbr: c.id,
  name: c.fullName,
  desc: GUIDE_CAPTION_DESCRIPTIONS[c.id],
}));

export const CLASSES = [
  {
    id: 'soundSport',
    name: 'SoundSport',
    points: 90,
    unlock: 'Default',
    color: 'green',
    desc: 'Entry level - earns medal ratings, never a rank',
  },
  {
    id: 'aClass',
    name: 'A Class',
    points: 60,
    unlock: '1 season or Level 3',
    color: 'blue',
    desc: 'Tighter budget, strategic drafting',
  },
  {
    id: 'openClass',
    name: 'Open Class',
    points: 120,
    unlock: '2 seasons or Level 5',
    color: 'purple',
    desc: 'Expanded options, more competition',
  },
  {
    id: 'worldClass',
    name: 'World Class',
    points: 150,
    unlock: '3 seasons or Level 10',
    color: 'yellow',
    desc: 'Elite competition, maximum flexibility',
  },
];

// New-corps registration windows. Each class stops accepting NEW corps a fixed
// number of weeks before finals so a late entry still has season left to
// compete. The weeks are canonical in src/config/classRegistry.json
// (registrationLockWeeks) and enforced server-side by registerCorps and
// processCorpsDecisions — derived here so the guide can never drift.
export const REGISTRATION_WINDOWS = CLASSES.map((c) => ({
  id: c.id,
  name: c.name,
  lockWeeks: REGISTRATION_LOCK_WEEKS[c.id] ?? 0,
}));

// The per-class choices the Season Setup Wizard offers when a new season
// opens — mirrors the decision actions handled by processCorpsDecisions
// (continue / new / unretire / move / skip / retire).
export const SEASON_START_OPTIONS = [
  {
    action: 'Continue',
    desc: 'Bring the same corps back. Season stats reset; its name, location, and history carry over.',
  },
  {
    action: 'Start new',
    desc: 'Found a fresh corps in the class. Any corps already there retires to your alumni list, and the new name must be unique for the season.',
  },
  {
    action: 'Unretire',
    desc: 'Bring a corps back from your retired list with its identity and history intact.',
  },
  {
    action: 'Move',
    desc: 'Carry a corps into a different class you have unlocked, keeping its name and history. The destination class must not already have an active corps.',
  },
  {
    action: 'Skip',
    desc: 'Sit the class out this season. The corps stays yours and can return when the next season opens.',
  },
  {
    action: 'Retire',
    desc: 'Send the corps to your retired list. You can unretire it in a future season.',
  },
];

// What is (and is not) allowed once the season is underway — mirrors the
// server rules in registerCorps, transferCorps, and retireCorps.
export const MIDSEASON_CORPS_RULES = [
  {
    title: 'Founding a new corps',
    desc: 'Allowed while the class is still open (see the windows above). You also need the class unlocked, no active corps already in it, and a corps name nobody has claimed this season.',
  },
  {
    title: 'Changing class',
    desc: "Only before your corps competes — once it has a score on the board, it's locked into its class until the season ends. A corps that hasn't competed can move once per season to an unlocked class with no active corps; its lineup and show registrations reset on the move.",
  },
  {
    title: 'Retiring',
    desc: 'Same cutoff: a corps that has competed this season cannot retire until the season ends.',
  },
];

// SoundSport is scored out of 100 and earns a medal RATING instead of a rank.
// The tier boundaries are canonical in src/utils/scoresUtils.ts
// getSoundSportRating (Gold >= 85 / Silver >= 75 / Bronze >= 65) — mirror them
// here so the guide can never drift from the score the game actually awards.
export const RATINGS = [
  {
    tier: 'Gold',
    min: 85,
    color: 'yellow',
    blurb: 'An outstanding run — top marks across the board.',
  },
  { tier: 'Silver', min: 75, color: 'gray', blurb: 'A strong, polished performance.' },
  { tier: 'Bronze', min: 65, color: 'orange', blurb: 'A solid showing that meets the standard.' },
  {
    tier: 'Participation',
    min: 0,
    color: 'white',
    blurb: 'Every corps that competes is recognized.',
  },
];

// How a nightly corps score is built — mirrors the engine in
// functions/src/helpers/scoring.js (each caption capped at 20; GE at full
// weight, Visual and Music summed then halved; total capped at 100).
export const SCORING_MODEL = [
  { group: 'General Effect', captions: 'GE1 + GE2', max: 40, note: 'Counts at full value' },
  { group: 'Visual', captions: 'VP + VA + CG', max: 30, note: 'Summed, then halved' },
  { group: 'Music', captions: 'B + MA + P', max: 30, note: 'Summed, then halved' },
];

// The player journey, in order — the spine of the guide's Overview section.
export const JOURNEY = [
  {
    n: 1,
    title: 'Start free in SoundSport',
    desc: 'Every director begins here: a 90-point budget and low-pressure medal ratings.',
  },
  {
    n: 2,
    title: 'Draft & compete',
    desc: 'Pick 8 caption performances, register for shows, and earn a nightly score out of 100.',
  },
  {
    n: 3,
    title: 'Unlock the ranked classes',
    desc: 'Complete seasons, hit level milestones, or spend CorpsCoin to open A, Open, and World.',
  },
  {
    n: 4,
    title: 'Build a legacy',
    desc: 'Climb from Rookie to Eternal, take finals medals, and fill your Trophy Case for good.',
  },
];

// Podium reputation ladder — names are canonical in
// src/components/Podium/podiumConstants.js REP_TIER_NAMES.
export const REP_TIERS = [
  'Community Corps',
  'Regional Contender',
  'National Contender',
  'Finalist',
  'Medalist',
  'Elite',
  'Champion Status',
];

// =============================================================================
// LEAGUES
// =============================================================================
// Numbers come from the mirrored server constants imported above so the guide
// cannot promise a payout the game does not make. Behaviour described here is
// the behaviour in functions/src/helpers/{leagueScoring,weeklyMatchups,
// leagueStandings,leagueChampion,leagueSeasonReset}.js — the code is the
// reference, not docs/LEAGUES_AUDIT_AND_PLAN.md, which records how it got here.

// Re-exported so the guide's sections and search index take every game fact
// from this module, the way they already do for captions, classes and XP.
export { LEAGUE_WEEKLY_WIN_CC, LEAGUE_POOL_ANTE_CC };

/** What a league is and how you get into one. */
export const LEAGUE_BASICS = [
  {
    title: 'Public or private',
    desc: 'Anyone can browse and join a public league. A private one takes an invite code from the commissioner, or a direct invitation to your profile you can accept or decline.',
  },
  {
    title: 'Entry fee and prize pool',
    desc: 'A league can charge a CorpsCoin entry fee. Every fee is escrowed into the league prize pool and paid out to the champion at the end of the season — nothing is skimmed, and the fee is fixed when the league is created so it can never be raised on you mid-season.',
  },
  {
    title: 'One matchup per class you field',
    desc: 'Matchups are paired inside each corps class. A director fielding three classes plays three separate matchups a week, and the standings table adds them all up.',
  },
  {
    title: 'Membership is permanent, participation is per season',
    desc: "You stay on the roster between seasons. Each new season you're counted as active once you register a corps, so a league goes quiet at rollover and lights back up as its members return.",
  },
];

/** How a single league week is decided and what winning pays. */
export const LEAGUE_WEEK_RULES = [
  {
    title: 'Your week is every show you competed in',
    desc: 'A week sums all seven days of scores, not just your latest result. Competing twice counts twice.',
  },
  {
    title: 'Sitting out is a loss, not a hold',
    desc: 'A director who does not compete scores zero for the week. Your last result does not carry forward to cover you.',
  },
  {
    title: 'Byes count as a win',
    desc: 'An odd roster means somebody sits out each week. The bye rotates to whoever has had it least, and pairing avoids rematches by seeding you against the nearby opponent you have faced fewest times.',
  },
  {
    title: 'Winning pays',
    desc: `Every matchup you win is worth ${LEAGUE_WEEKLY_WIN_CC} CC and ${XP_SOURCES.leagueWin} XP, per class. Byes and ties pay nothing.`,
  },
];

/**
 * The league's ordering rule, in order — mirrors compareStandingRows in
 * functions/src/helpers/leagueStandings.js, which the table, the Finals cut
 * line and the champion selector all share so they can never disagree.
 */
export const STANDINGS_TIEBREAKERS = [
  {
    rule: 'Win percentage',
    desc: 'Ties count as half a win. Percentage rather than raw wins, because byes and part-season classes mean members do not all play the same number of matchups.',
  },
  { rule: 'Total wins', desc: 'The straightforward tiebreak when two win percentages are level.' },
  {
    rule: 'Category record',
    desc: 'Caption Wars leagues only. Two directors at 4-2 are separated by how they got there — 12 categories to 6 is a more dominant 4-2 than 7 to 11. Zero for everyone on standard scoring, where this term does nothing.',
  },
  {
    rule: 'Normalized score',
    desc: 'Your mean finishing percentile against your own class field. Matchups are class-segregated but the table is league-wide, so ranking on raw points would sort a mixed-class league by class instead of by performance.',
  },
  { rule: 'Points for', desc: 'Total points scored across the season.' },
  {
    rule: 'Points against',
    desc: 'Fewer is better — the last tiebreak before the order is settled.',
  },
];

/** How a league season ends. */
export const LEAGUE_POSTSEASON = [
  {
    title: 'The Finals field',
    desc: `The top seeds in the regular-season standings qualify — ${DEFAULT_FINALS_SIZE} by default, and the commissioner sets the size when the league is created. The standings table draws the cut line all season so you can see where you stand against it.`,
  },
  {
    title: 'The champion',
    desc: 'Championship week decides the title among the qualifiers. If nobody in the field competes that week, the regular-season leader takes it outright — the standings earn you the right to be there.',
  },
  {
    title: 'The prize pool',
    desc: "The whole escrowed pool goes to the champion, along with anything left carrying over from the league's prediction pools.",
  },
  {
    title: 'The consolation title',
    desc: 'Everyone below the cut runs the same race for a second, lesser title on championship week, so a season that is mathematically over still has something to play for. Recognition only — no CorpsCoin.',
  },
  {
    title: 'What survives the rollover',
    desc: 'Your league keeps its roster, its champions, its chat and its activity history forever. Standings, matchups, recaps and rivalries archive to the season they belong to, and the scoring format resets to standard.',
  },
];

/** Everything a league is between matchups. */
export const LEAGUE_CLUBHOUSE = [
  {
    title: 'Chat',
    desc: 'A league-wide room with unread markers. Your own messages are yours to delete; commissioners can moderate anyone.',
  },
  {
    title: 'Activity feed',
    desc: 'Every result, join, settings change and championship, in order, so nothing about your league happens off-screen.',
  },
  {
    title: 'Weekly recaps',
    desc: 'Written as soon as the week resolves: the highest score, the closest call, who is hot, and in a Caption Wars league, the sweeps and the 2-1 thrillers.',
  },
  {
    title: 'Record book',
    desc: 'Highest single week, biggest blowout, closest call, longest win streak, and the best finish against a class field. Caption Wars leagues also track career sweeps and the longest run holding one category.',
  },
  {
    title: 'Rivalries',
    desc: 'The league detects who you keep drawing and keeps the head-to-head history in front of both of you.',
  },
  {
    title: 'Hall of Fame and career pages',
    desc: 'An all-time table ranked titles-first with dynasty streaks, plus a page per member: record season by season, titles, best week, and head-to-head against every opponent.',
  },
  {
    title: 'Prediction pools',
    desc: `A daily side game. Buy in for ${LEAGUE_POOL_ANTE_CC} CC and every entrant who posts a perfect prediction day splits the pot. If nobody is perfect it carries into the next day's pool — and anything still carrying at season's end goes to the champion. Fully escrowed: every coin paid out was staked by a member.`,
  },
];

/** What running a league lets you do. */
export const LEAGUE_COMMISSIONER_TOOLS = [
  {
    title: 'Settings',
    desc: 'Name, description, public or private, roster cap, and the size of the Finals field. The entry fee is the one thing fixed at creation, because members escrowed real CorpsCoin against it.',
  },
  {
    title: 'Co-commissioners',
    desc: 'Up to four, to share the running of the league. Only the owner can appoint or remove them.',
  },
  {
    title: 'Handing it over',
    desc: 'Transfer the league outright to another member. Leaving a league you run promotes a successor rather than orphaning it.',
  },
  {
    title: 'Fixing a result',
    desc: 'Override a matchup that resolved wrong and the whole table rebuilds from every resolved week, so a correction can never leave the standings half-updated.',
  },
  {
    title: 'Announcements',
    desc: 'Pin a message above every tab for the season.',
  },
  {
    title: 'Scoring format',
    desc: 'Put the league on Caption Wars for the season. See the next section.',
  },
];

// =============================================================================
// CAPTION WARS
// =============================================================================
// The alternate scoring format, mirrored from functions/src/helpers/
// captionWars.js (categories, resolution) and functions/src/callable/
// leagueFormat.js (who pays, when, and what it does not touch).

/** What the commissioner pays, for one season, out of their own balance. */
export const CAPTION_WARS_COST = CAPTION_WARS_SEASON_COST;

/**
 * The three categories, tied back to the caption groups the scorer already
 * persists — same names, same 40/30/30 ceilings, so the format and the score
 * are visibly one idea.
 */
export const CAPTION_WARS_CATEGORIES = CAPTION_CATEGORIES.map((c) => {
  const group = SCORING_MODEL.find((g) => g.group === c.label);
  return {
    key: c.key,
    label: c.label,
    short: c.short,
    max: group?.max,
    captions: group?.captions,
  };
});

export const CAPTION_WARS_RULES = [
  {
    title: 'Win two, win the week',
    desc: "Each week your General Effect, Visual and Music totals are compared against your opponent's separately. Take two of the three and you take the week.",
  },
  {
    title: 'You can win on points and lose the week',
    desc: 'General Effect is worth 40 and the other two 30 each, which is the real DCI ratio. Win GE by twelve, lose Visual and Music by a point apiece, and you lose a week you would have won comfortably on totals. That is the format working, not a bug.',
  },
  {
    title: 'Your lineup never changes',
    desc: 'You draft the same eight captions in the same game. A league turning this on does not ask you to build a different corps.',
  },
  {
    title: 'A category is never drawn',
    desc: 'A tied category goes to whoever posted the higher weekly total. Only when the totals are level too is a category left undecided — and the other two still decide the week.',
  },
  {
    title: 'Category record breaks ties in the standings',
    desc: 'Sitting directly under wins, above every score-based tiebreak, so the Finals field is seeded on the format the league actually played.',
  },
  {
    title: 'Three categories, permanently',
    desc: 'Your eight individual caption scores are never published — an opponent could read your entire lineup off the recap. These three groups blend two, three and three of them, and they were already on the matchup breakdown before this format existed.',
  },
];

/** The purchase, stated the way the commissioner meets it. */
export const CAPTION_WARS_PURCHASE = [
  {
    title: `${CAPTION_WARS_COST.toLocaleString()} CC, paid by the commissioner`,
    desc: 'Out of their own balance, never per member — the format is a property of a matchup, so both sides must be playing the same one. Nobody can buy an advantage with it.',
  },
  {
    title: 'The prize pool is untouched',
    desc: "That pool is members' escrow. It funds the championship and nothing else.",
  },
  {
    title: 'Before the season starts, or not at all',
    desc: "The format locks once the league's first week is generated. Switching mid-season would mix two formats inside one standings table.",
  },
  {
    title: 'One season, no refunds',
    desc: 'It does not renew. The rollover puts the league back on standard scoring, and a commissioner who wants it again buys it again. Turning it off early is free but does not refund.',
  },
];

/** One-Night Slate, stated the way a director meets it. Costs and purchase
 *  terms match Caption Wars' except the price (utils/oneNightSlate.ts). */
export const ONE_NIGHT_COST = ONE_NIGHT_SEASON_COST;

export const ONE_NIGHT_RULES = [
  {
    title: 'Your best night decides the week',
    desc: "Only your highest-scoring single show is compared against your opponent's highest. One great Saturday beats a week of steady Tuesdays.",
  },
  {
    title: 'Showing up still matters',
    desc: 'Every show you attend is another chance at a peak, and if your best nights tie, the higher weekly total takes the week — the fuller week breaks the tie. Sitting the week out is still a forfeit.',
  },
  {
    title: 'Your lineup never changes',
    desc: 'Same eight captions, same game. Only the reading of the week is different — the matchup card shows the two nights that decided it.',
  },
  {
    title: 'Same purchase terms as Caption Wars',
    desc: `${ONE_NIGHT_SEASON_COST.toLocaleString()} CC from the commissioner's own balance, one season, preseason only, prize pool untouched, no refunds.`,
  },
];

export const GLOSSARY = [
  {
    term: 'DCI',
    def: 'Drum Corps International - the governing body for competitive drum corps in North America',
  },
  {
    term: 'Caption',
    def: 'A scoring category (GE, Visual, Music, etc.) - judges score each caption separately',
  },
  {
    term: 'General Effect',
    def: 'How the overall show impacts the audience emotionally and artistically',
  },
  { term: 'Visual', def: 'Marching, staging, and choreography quality' },
  { term: 'Color Guard', def: 'The flag, rifle, and saber performers who add visual artistry' },
  {
    term: 'Finals',
    def: 'Championship competition held in August - the culmination of the DCI season',
  },
  { term: 'World Class', def: 'The top competitive tier in real DCI (and our game!)' },
  { term: 'Open Class', def: 'Developing corps working toward World Class' },
];

export const FAQ = [
  {
    q: 'How are scores calculated?',
    a: 'Each night your corps earns a score out of 100, using the same 40/30/30 split real DCI does. Your two General Effect captions (GE1, GE2) count at full value, up to 40 points. Your three Visual captions (VP, VA, CG) are added together and halved into a 30-point block, and your three Music captions (B, MA, P) the same. Every caption is capped, and the total can never exceed 100. Scores come straight from the historical (or live) performances you drafted — no purchase, streak, or show concept can change them.',
  },
  {
    q: 'When do scores drop?',
    a: "Off-season scores drop at 9:00 PM ET every night, year-round. During live DCI seasons, scores drop once every show from that night has finished and posted — just like real DCI. That means 11:00 PM ET on a night whose westernmost show is on the East Coast, midnight ET for Central, 1:00 AM ET for Mountain, and 2:00 AM ET when there's a West Coast show. Championship Week in Indianapolis drops at midnight ET. Your dashboard countdown always shows tonight's actual drop time.",
  },
  {
    q: 'What score do I need for a Gold rating?',
    a: 'SoundSport earns a medal rating instead of a rank: Gold at 85 and above, Silver at 75, Bronze at 65, and Participation for every corps that competes. Because SoundSport is scored out of 100 like every class, a clean, well-drafted lineup is what pushes you into the medals.',
  },
  {
    q: 'Can I change my lineup?',
    a: "Yes! Caption changes are unlimited for the first two weeks, through Day 14 at 8:00 PM ET. From Week 3 on you get 3 changes per week per class — use them one at a time or all at once. Changes always lock from Saturday 8:00 PM ET until 2:00 AM ET, once that night's scores are final. No changes are allowed on Days 43-44. During Championship Week (Days 45-49) each competing class gets 2 changes per day, resetting nightly at 8:00 PM ET — only Open and A Class compete on Days 45-46, all classes on Day 47, and World Class and SoundSport in the Days 48-49 Finals. That works out to the same 6 total changes for every class across the days it is guaranteed to compete, so it stays fair even if an Open or A Class corps advances to Finals.",
  },
  {
    q: 'Is there a mobile app?',
    a: 'Yes — marching.art installs as an app on iPhone, iPad, Android and desktop straight from your browser, with no App Store or Play Store. Open marching.art/install on your device for a one-tap install or exact steps for your phone and browser (including how to get out of the Instagram, Facebook or Discord mini browser first). The installed app is also what delivers score-drop notifications on iPhone.',
  },
  {
    q: 'What happens when a season ends?',
    a: 'Leaderboards reset and a new season begins. Your XP, level, unlocked classes, and CorpsCoin carry over.',
  },
  {
    q: 'How do I unlock higher classes?',
    a: 'Three ways, any one is enough: complete seasons (1 season unlocks A Class, 2 unlock Open, 3 unlock World — a season counts when you competed in at least one show), reach the required level early (3/5/10), or spend CorpsCoin (1,000/2,500/5,000 CC) to skip ahead. Classes remain unlocked permanently.',
  },
  {
    q: 'Why do some Level 1 directors have multiple classes?',
    a: 'Classes and levels are separate tracks. A class unlocks by seasons completed, by level, or by CorpsCoin — so a director can hold several classes while still climbing levels. Level is pure XP.',
  },
  {
    q: 'Can I compete in multiple classes?',
    a: 'Yes! You can have a separate corps in each unlocked class, each with its own lineup and rankings.',
  },
  {
    q: 'What are my options when a new season begins?',
    a: 'The Season Setup Wizard walks through each of your classes with a fresh decision: continue your corps (stats reset, identity and history carry over), found a new one (the current corps retires to your alumni list), unretire a past corps, move a corps to a different unlocked class, skip the class for the season, or retire the corps. Decisions are per class, so you can continue in one class while starting fresh in another.',
  },
  {
    q: 'Can I create a new corps after the season has started?',
    a: 'Yes, as long as that class is still open. Each ranked class stops accepting new corps a set number of weeks before finals so a late entry still has time to compete: World Class locks 6 weeks out, Open Class 5, and A Class 4, while SoundSport stays open all season. You also need the class unlocked, no active corps already in it, and a corps name nobody has claimed this season.',
  },
  {
    q: 'How do league matchups work?',
    a: `Every week your league pairs you against another member inside each class you field, and the matchup is decided on your total score for that week — every show you competed in across all seven days, not just your latest result. Not competing scores zero, so sitting a week out is a loss rather than a hold. An odd roster gives somebody a bye, which counts as a win and rotates to whoever has had it least. Each matchup you win pays ${LEAGUE_WEEKLY_WIN_CC} CC and ${XP_SOURCES.leagueWin} XP; byes and ties pay nothing.`,
  },
  {
    q: 'What is Caption Wars?',
    a: `An alternate scoring format a commissioner can put their league on for a season. Instead of one comparison of the week's total score, the week is a best-of-three across the same three groups the game already scores you on — General Effect, Visual and Music. Win two of the three and you win the week, whatever the totals say. Nobody's lineup changes: you draft the same eight captions in the same game, and the three groups were already on the matchup breakdown. It costs the commissioner ${CAPTION_WARS_COST.toLocaleString()} CC out of their own balance, covers one season, and can only be switched on before the league's first week is generated. It never touches the league prize pool.`,
  },
  {
    q: 'I scored more points than my opponent and still lost the week. Why?',
    a: 'Your league is running Caption Wars, where a week is a best-of-three across General Effect, Visual and Music rather than a comparison of totals. General Effect is worth 40 points and the other two 30 each — the real DCI ratio — so winning General Effect by a wide margin while dropping Visual and Music by a little loses the week 2-1. Your matchup breakdown shows all three verdicts, so you can see exactly which category went where.',
  },
  {
    q: 'What happens to my league when the season ends?',
    a: 'The champion is decided among the Finals field — the top seeds in your regular-season standings — on championship week, and the whole escrowed prize pool goes to them. Everyone below the cut plays for a consolation title, which is recognition rather than CorpsCoin. Then the league rolls over: standings, matchups, recaps and rivalries archive to the season they belong to, the scoring format resets to standard, and week 1 starts everyone at 0-0. Your roster, your champions, your chat and your activity history all carry over permanently.',
  },
  {
    q: 'Can I move my corps to a different class mid-season?',
    a: "Only before it competes. Once your corps has a score on the board, it's locked into its class until the season ends — the same cutoff applies to retiring it. A corps that hasn't competed yet can move once per season to any class you've unlocked that doesn't already have an active corps; its name and history come along, but its lineup and show registrations reset. When the next season opens, the Season Setup Wizard lets you move any corps freely again.",
  },
];
