// @ts-nocheck -- grandfathered before checkJs; remove when this file is typed or cleaned up
// GAME GUIDE — SECTION CONTENT (/guide). The body of the How-to-Play document,
// split out of HowToPlay.jsx so the shell stays small. Ordering + icons live in
// HowToPlay.jsx's SECTIONS list; this file supplies the matching content. Game
// facts come from howToPlayData.js / progressionGuide.js so nothing can drift.

import React from 'react';
import { Link } from 'react-router-dom';
import { Heading } from '../components/ui';
import {
  Compass,
  Rocket,
  Target,
  Trophy,
  Layers,
  TrendingUp,
  Calendar,
  Coins,
  Users,
  Medal,
  Book,
  HelpCircle,
  ChevronRight,
  Zap,
  Music,
  Eye,
  Sparkles,
  MapPin,
  Clock,
  Shield,
} from 'lucide-react';
import {
  CAPTIONS,
  CLASSES,
  GLOSSARY,
  FAQ,
  RATINGS,
  SCORING_MODEL,
  JOURNEY,
  REP_TIERS,
  REGISTRATION_WINDOWS,
  SEASON_START_OPTIONS,
  MIDSEASON_CORPS_RULES,
} from './howToPlayData';
import {
  XP_PER_LEVEL,
  LEVEL_TITLES,
  XP_SOURCE_GUIDE,
  PROGRESSION_AXES,
  UNLOCK_PATH_GUIDE,
} from '../data/progressionGuide';

// Captions grouped exactly the way scoring groups them (see SCORING_MODEL),
// so the lineup structure and the score are one idea.
const CAPTION_GROUPS = [
  {
    label: 'General Effect',
    abbrs: ['GE1', 'GE2'],
    max: 40,
    icon: Sparkles,
    accent: 'text-secondary',
  },
  { label: 'Visual', abbrs: ['VP', 'VA', 'CG'], max: 30, icon: Eye, accent: 'text-blue-400' },
  { label: 'Music', abbrs: ['B', 'MA', 'P'], max: 30, icon: Music, accent: 'text-purple-400' },
];

const findCaption = (abbr) => CAPTIONS.find((c) => c.abbr === abbr);

// =============================================================================
// PRIMITIVES
// =============================================================================

const Card = ({ className = '', children }) => (
  <div className={`bg-surface-sunken border border-white/10 rounded-none p-4 ${className}`}>
    {children}
  </div>
);

const DataRow = ({ label, value, accent = false }) => (
  <div className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
    <span className="text-muted text-xs">{label}</span>
    <span className={`text-xs font-bold ${accent ? 'text-interactive' : 'text-white'}`}>
      {value}
    </span>
  </div>
);

const SectionHead = ({ icon: Icon, title, kicker }) => (
  <div className="mb-4">
    {kicker && (
      <p className="text-[10px] font-bold uppercase tracking-wider text-interactive mb-1">
        {kicker}
      </p>
    )}
    <div className="flex items-center gap-3">
      <span className="w-9 h-9 bg-interactive/20 rounded-none flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-interactive" />
      </span>
      <Heading level="title">{title}</Heading>
    </div>
  </div>
);

// =============================================================================
// SECTIONS
// =============================================================================

const OverviewSection = () => (
  <>
    <SectionHead
      icon={Compass}
      kicker="The Fantasy Drum Corps Game"
      title="What is marching.art?"
    />
    <p className="text-sm text-secondary leading-relaxed mb-4">
      marching.art is fantasy sports for the marching arts. Instead of drafting quarterbacks, you
      draft <strong className="text-white">caption performances</strong> — General Effect, Visual,
      and Music — from 50 years of Drum Corps International history, build a lineup within a point
      budget, and earn points from real competition scores. It is free, runs year-round, and takes
      about two minutes to start.
    </p>

    {/* The journey, in order */}
    <p className="text-xs font-bold uppercase tracking-wider text-muted mb-2">Your path</p>
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 mb-5">
      {JOURNEY.map((step) => (
        <div key={step.n} className="bg-surface-sunken border border-white/10 rounded-none p-3">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-6 h-6 bg-interactive text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
              {step.n}
            </span>
            <span className="text-xs font-bold text-white leading-tight">{step.title}</span>
          </div>
          <p className="text-[11px] text-muted leading-snug">{step.desc}</p>
        </div>
      ))}
    </div>

    {/* Two ways to play */}
    <p className="text-xs font-bold uppercase tracking-wider text-muted mb-2">Two ways to play</p>
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="bg-interactive/10 border border-interactive/30 rounded-none p-4">
        <div className="flex items-center gap-2 mb-1.5">
          <Target className="w-4 h-4 text-interactive" />
          <span className="text-sm font-bold text-white">Draft — the fantasy classes</span>
        </div>
        <p className="text-xs text-muted leading-relaxed">
          Build a lineup of historical caption performances and let real (or historical) scores do
          the rest. Four classes: SoundSport, A, Open, and World. This is where everyone starts.
        </p>
      </div>
      <div className="bg-brand/10 border border-brand/30 rounded-none p-4">
        <div className="flex items-center gap-2 mb-1.5">
          <Medal className="w-4 h-4 text-brand" />
          <span className="text-sm font-bold text-white">Found — Podium Class</span>
        </div>
        <p className="text-xs text-muted leading-relaxed">
          Run your own corps and earn every point: rehearse, route a tour, and climb from Community
          Corps to Champion. Always open, always free — jump to the Podium Class section below.
        </p>
      </div>
    </div>
  </>
);

const StartSection = () => (
  <>
    <SectionHead icon={Rocket} kicker="Two minutes to your first show" title="Getting Started" />
    <div className="space-y-3">
      {[
        [
          'Create your corps',
          'Register with a unique name. Every director starts in SoundSport class — no unlock needed.',
        ],
        [
          'Draft your lineup',
          'Pick one corps performance for each of the 8 captions. Each has a point cost; stay within your budget (auto-fill can finish it for you).',
        ],
        [
          'Register for shows',
          'Sign up for up to 4 shows a week from the schedule. Attending a show is what puts a score on the board.',
        ],
        [
          'Compete & level up',
          'Scores drop every night — 9:00 PM ET in the off-season, and as soon as the last West Coast show wraps in live season (11 PM–2 AM ET). Earn XP, unlock higher classes, and climb the leaderboards.',
        ],
      ].map(([title, desc], i) => (
        <div key={title} className="flex items-start gap-3">
          <span className="w-7 h-7 bg-interactive text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
            {i + 1}
          </span>
          <div>
            <p className="text-sm font-semibold text-white">{title}</p>
            <p className="text-xs text-muted leading-relaxed">{desc}</p>
          </div>
        </div>
      ))}
    </div>
  </>
);

const CaptionsSection = () => (
  <>
    <SectionHead icon={Target} kicker="Your lineup" title="The 8 Captions You Draft" />
    <p className="text-sm text-secondary leading-relaxed mb-4">
      Your lineup mirrors real DCI judging: one pick in each of eight captions, grouped into three
      families. Each pick comes from a real historical corps and costs{' '}
      <strong className="text-white">1–25 points</strong> based on how that corps actually scored —
      so a legendary line costs far more of your budget than a developing one.
    </p>
    <div className="space-y-3">
      {CAPTION_GROUPS.map((group) => {
        const Icon = group.icon;
        return (
          <div
            key={group.label}
            className="bg-surface-sunken border border-white/10 rounded-none p-3"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Icon className={`w-4 h-4 ${group.accent}`} />
                <span className="text-xs font-bold uppercase tracking-wider text-white">
                  {group.label}
                </span>
              </div>
              <span className="text-[10px] text-muted">scores up to {group.max}</span>
            </div>
            <div className="grid sm:grid-cols-3 gap-2">
              {group.abbrs.map((abbr) => {
                const cap = findCaption(abbr);
                return (
                  <div key={abbr} className="bg-black/30 rounded-none p-2">
                    <p className="text-xs text-white">
                      <span className="font-bold text-interactive mr-1.5">{cap.abbr}</span>
                      {cap.name}
                    </p>
                    <p className="text-[10px] text-muted mt-0.5">{cap.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  </>
);

const ScoringSection = () => (
  <>
    <SectionHead icon={Trophy} kicker="Out of 100" title="How Scoring Works" />
    <p className="text-sm text-secondary leading-relaxed mb-4">
      Every night your corps earns a score out of 100, built the same 40/30/30 way real DCI builds
      it. General Effect counts at full weight, while Visual and Music are each summed and halved.
    </p>
    <Card className="mb-3">
      {SCORING_MODEL.map((g) => (
        <div
          key={g.group}
          className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0"
        >
          <div>
            <span className="text-xs font-bold text-white">{g.group}</span>
            <span className="block text-[10px] text-muted">
              {g.captions} · {g.note}
            </span>
          </div>
          <span className="text-sm font-bold text-muted">up to {g.max}</span>
        </div>
      ))}
      <div className="flex items-center justify-between pt-3 mt-1 border-t border-white/10">
        <span className="text-xs font-bold uppercase tracking-wider text-white">Maximum score</span>
        <span className="text-sm font-bold text-interactive">100</span>
      </div>
    </Card>
    <ul className="space-y-1.5 text-xs text-muted">
      <li className="flex items-start gap-2">
        <ChevronRight className="w-3.5 h-3.5 text-interactive flex-shrink-0 mt-0.5" />
        Each caption is capped, and your score comes straight from the performances you drafted —
        nothing you buy or earn can change it.
      </li>
      <li className="flex items-start gap-2">
        <ChevronRight className="w-3.5 h-3.5 text-interactive flex-shrink-0 mt-0.5" />
        Live Season uses real DCI results as they happen; the Off-Season uses historical data.
      </li>
      <li className="flex items-start gap-2">
        <ChevronRight className="w-3.5 h-3.5 text-interactive flex-shrink-0 mt-0.5" />
        Your class rank uses your most recent night&rsquo;s total, so a strong show night can move
        you fast.
      </li>
    </ul>
  </>
);

const ClassesSection = () => (
  <>
    <SectionHead icon={Layers} kicker="Where you compete" title="Classes & Ratings" />
    <p className="text-sm text-secondary leading-relaxed mb-4">
      Classes set your drafting budget — a bigger budget buys pricier, higher-scoring caption picks.
      Everyone starts in SoundSport. You can field a separate corps in every class you unlock, each
      with its own lineup and ranking.
    </p>

    <div className="grid gap-2 sm:grid-cols-2 mb-4">
      {CLASSES.map((cls) => {
        const ring =
          cls.color === 'green'
            ? 'border-green-500/30'
            : cls.color === 'blue'
              ? 'border-interactive/30'
              : cls.color === 'purple'
                ? 'border-purple-500/30'
                : 'border-line';
        const dot =
          cls.color === 'green'
            ? 'text-green-500'
            : cls.color === 'blue'
              ? 'text-interactive'
              : cls.color === 'purple'
                ? 'text-purple-500'
                : 'text-secondary';
        return (
          <div key={cls.id} className={`bg-surface-sunken border ${ring} rounded-none p-3`}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Trophy className={`w-4 h-4 ${dot}`} />
                <span className="text-sm font-bold text-white">{cls.name}</span>
              </div>
              <span className="text-xs font-bold text-white">{cls.points} pts</span>
            </div>
            <p className="text-[11px] text-muted">{cls.desc}</p>
            <p className="text-[10px] text-muted mt-1">Unlock: {cls.unlock}</p>
          </div>
        );
      })}
    </div>

    {/* Unlock paths */}
    <p className="text-xs font-bold uppercase tracking-wider text-muted mb-2">
      Three ways to unlock — any one is enough
    </p>
    <div className="grid gap-2 sm:grid-cols-3 mb-5">
      {UNLOCK_PATH_GUIDE.map((path) => (
        <div key={path.id} className="bg-black/30 border border-white/10 rounded-none p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Zap className="w-3 h-3 text-brand" />
            <p className="text-xs font-bold text-secondary">{path.label}</p>
          </div>
          <p className="text-[11px] text-muted leading-snug">{path.detail}</p>
        </div>
      ))}
    </div>

    {/* SoundSport ratings — findable, prominent */}
    <div className="bg-surface-sunken border border-green-500/30 rounded-none p-4">
      <div className="flex items-center gap-2 mb-2">
        <Medal className="w-4 h-4 text-green-500" />
        <span className="text-sm font-bold text-white">SoundSport is scored differently</span>
      </div>
      <p className="text-xs text-muted leading-relaxed mb-3">
        SoundSport is the entry class and the only one that never ranks. Instead of a leaderboard
        slot, your out-of-100 score earns a medal rating — recognition while you learn the game.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {RATINGS.map((r) => (
          <div key={r.tier} className="bg-black/30 rounded-none p-2 text-center">
            <p className="text-xs font-bold text-white">{r.tier}</p>
            <p className="text-sm font-bold text-interactive">
              {r.min === 0 ? 'Any' : `${r.min}+`}
            </p>
          </div>
        ))}
      </div>
    </div>
  </>
);

const ProgressionSection = () => (
  <>
    <SectionHead icon={TrendingUp} kicker="Level up" title="Progression" />
    <p className="text-sm text-secondary leading-relaxed mb-4">
      Four separate numbers track your career — nothing overlaps, and each one tells you exactly how
      to raise it.
    </p>
    <div className="space-y-2 mb-5">
      {PROGRESSION_AXES.map((axis) => (
        <div key={axis.id} className="bg-black/30 border border-white/10 rounded-none p-3">
          <p className="text-xs font-bold text-secondary">{axis.label}</p>
          <p className="text-[11px] text-muted leading-snug">{axis.meaning}</p>
          <p className="text-[11px] text-muted mt-0.5">
            <span className="text-interactive font-bold">Raise it:</span> {axis.raise}
          </p>
        </div>
      ))}
    </div>

    {/* XP sources */}
    <p className="text-xs font-bold uppercase tracking-wider text-muted mb-2">
      Every way to earn XP
    </p>
    <Card className="mb-5">
      {XP_SOURCE_GUIDE.map((source) => (
        <div
          key={source.id}
          className="flex items-center justify-between gap-3 py-2 border-b border-white/5 last:border-0"
        >
          <div className="min-w-0">
            <span className="text-xs font-bold text-white">{source.label}</span>
            <span className="block text-[10px] text-muted leading-snug">{source.cadence}</span>
          </div>
          <span className="text-xs font-bold text-interactive whitespace-nowrap flex-shrink-0">
            {typeof source.xp === 'number' ? `${source.xp} XP` : source.xp}
          </span>
        </div>
      ))}
    </Card>

    {/* Level ladder */}
    <p className="text-xs font-bold uppercase tracking-wider text-muted mb-1">The title ladder</p>
    <p className="text-[11px] text-muted mb-2">
      Every {XP_PER_LEVEL.toLocaleString()} XP is one level. Levels never reset, and each brings a
      new title — from Rookie all the way to Eternal.
    </p>
    <div className="flex flex-wrap gap-1.5">
      {Object.entries(LEVEL_TITLES)
        .sort((a, b) => Number(a[0]) - Number(b[0]))
        .map(([lvl, title]) => (
          <div
            key={lvl}
            className="flex items-center gap-1.5 bg-black/30 border border-white/10 rounded-none px-2 py-1"
          >
            <span className="text-[10px] font-mono text-interactive">L{lvl}</span>
            <span className="text-[11px] text-secondary">{title}</span>
          </div>
        ))}
    </div>
  </>
);

const SeasonSection = () => (
  <>
    <SectionHead icon={Calendar} kicker="The calendar" title="Season Calendar" />
    <p className="text-sm text-secondary leading-relaxed mb-4">
      There is always a season running. XP, levels, unlocked classes, and CorpsCoin carry over every
      time — only the leaderboards reset.
    </p>

    <div className="grid gap-3 sm:grid-cols-2 mb-5">
      <div className="bg-surface-sunken border border-interactive/30 rounded-none p-4">
        <div className="flex items-center gap-2 mb-2">
          <Calendar className="w-4 h-4 text-interactive" />
          <span className="text-sm font-bold text-white">Live Season</span>
          <span className="text-[10px] text-muted ml-auto">Jun – Aug</span>
        </div>
        <p className="text-xs text-muted leading-relaxed mb-2">
          Runs alongside the real DCI summer tour, scored from actual results night by night through
          Finals in August.
        </p>
        <DataRow label="Length" value="~10 weeks" />
        <DataRow label="Competition" value="49-day schedule" />
      </div>
      <div className="bg-surface-sunken border border-purple-500/30 rounded-none p-4">
        <div className="flex items-center gap-2 mb-2">
          <Clock className="w-4 h-4 text-purple-500" />
          <span className="text-sm font-bold text-white">Off-Season</span>
          <span className="text-[10px] text-muted ml-auto">Aug – May</span>
        </div>
        <p className="text-xs text-muted leading-relaxed mb-2">
          Six back-to-back 7-week seasons scored with historical DCI data, so there is always a
          leaderboard to climb.
        </p>
        <DataRow label="Length" value="~42 weeks" />
        <DataRow label="Structure" value="6 × 49-day seasons" />
      </div>
    </div>

    {/* Lineup change windows */}
    <p className="text-xs font-bold uppercase tracking-wider text-muted mb-2">
      Lineup change windows
    </p>
    <Card className="mb-2">
      <DataRow label="Days 1–14" value="Unlimited" accent />
      <DataRow label="Days 15–42 (Weeks 3–6)" value="3 per week" />
      <DataRow label="Days 43–44" value="Closed" />
      <DataRow label="Championship Week (45–49)" value="2 per day" />
    </Card>
    <p className="text-[11px] text-muted leading-relaxed">
      Changes lock every Saturday at 8:00 PM ET and reopen at 2:00 AM ET, once that night&apos;s
      scores are final. During Championship Week each competing class gets 2 changes per day,
      resetting nightly at 8:00 PM ET — only Open and A Class compete Days 45–46, all classes Day
      47, and World Class and SoundSport the Days 48–49 Finals. That's the same 6 total changes for
      every class across the days it's guaranteed to compete, so it stays fair even if an Open or A
      Class corps advances to Finals. Weekly changes are per class and can be spent one at a time or
      all at once. You can register for up to 4 shows a week.
    </p>

    {/* Season-start corps decisions */}
    <p className="text-xs font-bold uppercase tracking-wider text-muted mt-5 mb-2">
      Registering your corps at season start
    </p>
    <p className="text-[11px] text-muted leading-relaxed mb-2">
      When a new season opens, the Season Setup Wizard offers a fresh decision for every class you
      have unlocked — each class decides independently:
    </p>
    <div className="grid gap-2 sm:grid-cols-2 mb-5">
      {SEASON_START_OPTIONS.map((opt) => (
        <div key={opt.action} className="bg-black/30 border border-white/10 rounded-none p-3">
          <p className="text-xs font-bold text-secondary">{opt.action}</p>
          <p className="text-[11px] text-muted leading-snug">{opt.desc}</p>
        </div>
      ))}
    </div>

    {/* Mid-season registration windows + restrictions */}
    <p className="text-xs font-bold uppercase tracking-wider text-muted mb-2">
      After the season starts
    </p>
    <p className="text-[11px] text-muted leading-relaxed mb-2">
      You can still found a corps mid-season, but each class closes to new corps a set number of
      weeks before finals so a late entry has enough season left to compete:
    </p>
    <Card className="mb-3">
      {REGISTRATION_WINDOWS.map((w) => (
        <DataRow
          key={w.id}
          label={w.name}
          value={w.lockWeeks === 0 ? 'Open all season' : `Locks ${w.lockWeeks} weeks before finals`}
          accent={w.lockWeeks === 0}
        />
      ))}
    </Card>
    <div className="space-y-2">
      {MIDSEASON_CORPS_RULES.map((rule) => (
        <div key={rule.title} className="bg-black/30 border border-white/10 rounded-none p-3">
          <p className="text-xs font-bold text-secondary">{rule.title}</p>
          <p className="text-[11px] text-muted leading-snug">{rule.desc}</p>
        </div>
      ))}
    </div>
  </>
);

const EconomySection = () => (
  <>
    <SectionHead icon={Coins} kicker="The currency" title="CorpsCoin" />
    <p className="text-sm text-secondary leading-relaxed mb-4">
      CorpsCoin (CC) is the game-wide currency, earned entirely through play. It buys convenience
      and cosmetics — <strong className="text-white">never</strong> a competitive edge. Nothing you
      spend can add a point to a score.
    </p>
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-muted mb-2">Earn it</p>
        <Card>
          <DataRow label="Show participation" value="50–200 CC" />
          <DataRow label="Correct predictions" value="+10 CC each" />
          <DataRow label="Level-up stipend" value="100 CC" />
          <DataRow label="Streak milestones" value="up to 1,000 CC" accent />
        </Card>
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-muted mb-2">Spend it</p>
        <Card>
          <DataRow label="A Class unlock" value="1,000 CC" />
          <DataRow label="Open Class unlock" value="2,500 CC" />
          <DataRow label="World Class unlock" value="5,000 CC" />
          <DataRow label="Streak Freeze" value="300 CC" accent />
        </Card>
      </div>
    </div>
  </>
);

const LeaguesSection = () => (
  <>
    <SectionHead icon={Users} kicker="Play with friends" title="Leagues & Leaderboards" />
    <ul className="space-y-2 text-sm text-secondary">
      {[
        'Create public or private leagues with join codes and go head-to-head with friends.',
        'Global leaderboards for every ranked class, updated as scores come in.',
        'Win your weekly league matchup for bonus XP.',
        'Field a separate corps in each class you have unlocked, each with its own ranking.',
      ].map((line) => (
        <li key={line} className="flex items-start gap-2">
          <ChevronRight className="w-4 h-4 text-interactive flex-shrink-0 mt-0.5" />
          {line}
        </li>
      ))}
    </ul>
  </>
);

const PodiumCard = ({ icon: Icon, title, children }) => (
  <div className="bg-surface-sunken border border-brand/20 rounded-none p-3">
    <div className="flex items-center gap-2 mb-1">
      <Icon className="w-4 h-4 text-brand" />
      <span className="text-xs font-bold uppercase tracking-wider text-white">{title}</span>
    </div>
    <p className="text-[11px] text-muted leading-relaxed">{children}</p>
  </div>
);

const PodiumSection = () => (
  <>
    <SectionHead icon={Medal} kicker="The other way to play" title="Podium Class" />
    <p className="text-sm text-secondary leading-relaxed mb-4">
      Podium Class flips the game. Instead of drafting caption performances, you{' '}
      <strong className="text-white">found your own drum corps</strong> and earn every point — one
      corps per director, always open, always free. No purchase ever adds a point to a score.
    </p>
    <div className="grid gap-2 sm:grid-cols-2">
      <PodiumCard icon={Rocket} title="Found your corps">
        Name it, pick a hometown, and set a show challenge (1–8) for each caption. A brand-new corps
        starts as a Community Corps.
      </PodiumCard>
      <PodiumCard icon={Zap} title="The daily loop">
        Spend 12 rehearsal blocks a day across seven block types — install your show early, clean it
        late. Neglect a caption and it starts to decay.
      </PodiumCard>
      <PodiumCard icon={Shield} title="Condition">
        Stamina, morale, food plans, and rest days all shape your yield. Money buys margin, never
        access — a broke corps can always play.
      </PodiumCard>
      <PodiumCard icon={MapPin} title="The tour & majors">
        Route up to 4 shows a week and hit the three majors — Dallas (Day 28), Atlanta (Day 35), and
        Allentown (Days 41–42) — before Championship Week in Indianapolis.
      </PodiumCard>
      <PodiumCard icon={Trophy} title="Scoring">
        Your 8 captions score against the real historical DCI envelope. Podium is the only class
        that shows all 8 captions in the recap. The all-time ceiling is 99.70 — a
        once-in-a-generation feat.
      </PodiumCard>
      <PodiumCard icon={TrendingUp} title="Divisions">
        Every corps starts in A Class and rises to Open then World by season-end cutoffs — the same
        climb corps made in the old days.
      </PodiumCard>
    </div>

    {/* Reputation ladder */}
    <p className="text-xs font-bold uppercase tracking-wider text-muted mt-4 mb-2">
      Reputation: the climb to Champion Status
    </p>
    <div className="flex flex-wrap items-center gap-1.5 mb-4">
      {REP_TIERS.map((tier, i) => (
        <React.Fragment key={tier}>
          <span
            className={`text-[11px] font-bold rounded-none px-2 py-1 ${
              i === REP_TIERS.length - 1 ? 'bg-brand/20 text-brand' : 'bg-black/30 text-secondary'
            }`}
          >
            {tier}
          </span>
          {i < REP_TIERS.length - 1 && <ChevronRight className="w-3 h-3 text-muted" />}
        </React.Fragment>
      ))}
    </div>
    <p className="text-[11px] text-muted leading-relaxed mb-4">
      Reputation is earned only from competitive results and caps how high you can score. Nobody
      debuts a champion — like Crown or the Bluecoats, Champion Status takes roughly a dozen strong
      seasons. Along the way you can hire persistent staff, host your own shows for CorpsCoin, and
      open live seasons with a 21-day spring training that ends in a Family Day exhibition.
    </p>

    <Link
      to="/podium-guide"
      className="inline-flex items-center gap-2 min-h-[40px] px-4 border border-interactive/50 text-interactive font-bold text-xs uppercase tracking-wider rounded-none hover:bg-interactive/10 transition-colors"
    >
      Read the full Podium guide
      <ChevronRight className="w-4 h-4" />
    </Link>
  </>
);

const GlossarySection = () => (
  <>
    <SectionHead icon={Book} kicker="New to drum corps?" title="Glossary" />
    <div className="grid gap-2 sm:grid-cols-2">
      {GLOSSARY.map((item) => (
        <div key={item.term} className="bg-surface-sunken border border-white/10 rounded-none p-3">
          <span className="text-xs font-bold text-interactive">{item.term}</span>
          <p className="text-xs text-muted mt-1 leading-relaxed">{item.def}</p>
        </div>
      ))}
    </div>
  </>
);

const FaqSection = () => (
  <>
    <SectionHead icon={HelpCircle} kicker="Common questions" title="FAQ" />
    <div className="space-y-3">
      {FAQ.map((item) => (
        <div key={item.q} className="bg-surface-sunken border border-white/10 rounded-none p-4">
          <h3 className="text-sm font-bold text-white mb-1.5">{item.q}</h3>
          <p className="text-xs text-muted leading-relaxed">{item.a}</p>
        </div>
      ))}
    </div>
  </>
);

// Map keyed by the section ids declared in HowToPlay.jsx SECTIONS.
const SECTION_CONTENT = {
  overview: OverviewSection,
  start: StartSection,
  captions: CaptionsSection,
  scoring: ScoringSection,
  classes: ClassesSection,
  progression: ProgressionSection,
  season: SeasonSection,
  economy: EconomySection,
  leagues: LeaguesSection,
  podium: PodiumSection,
  glossary: GlossarySection,
  faq: FaqSection,
};

// Renders the section body for a given id. Exposed as a component (rather than
// exporting the map directly) so this module only exports components and React
// fast refresh keeps working.
export const GuideSection = ({ id }) => {
  const Content = SECTION_CONTENT[id];
  return Content ? <Content /> : null;
};
