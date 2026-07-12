// =============================================================================
// PODIUM PREVIEW — INTERACTIVE "TRY IT OUT" DEMO OF THE PODIUM DAILY LOOP
// =============================================================================
// The Podium equivalent of the index's /preview GuestDashboard: a no-signup
// sample of the core director-sim loop. A visitor allocates rehearsal blocks
// on the Director's Sheet, watches CONTENT install and CLEAN rise caption by
// caption with instant itemized feedback (FMA's "Action Complete!" moment),
// manages stamina/morale, and advances days as a projected box score climbs.
// Everything is computed client-side — no backend, no auth. After a little
// engagement a registration gate invites the visitor to found a real corps.
//
// The real scoring lives server-side (functions/src/helpers/podium/engine.js);
// this is a faithful-in-spirit approximation for feel, not the true engine.

import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { m } from 'framer-motion';
import {
  ChevronLeft,
  LogIn,
  UserPlus,
  Play,
  Moon,
  RotateCcw,
  Zap,
  Medal,
  Sparkles,
  ArrowRight,
  X,
  Info,
} from 'lucide-react';
import { useBodyScroll } from '../hooks/useBodyScroll';
import { useSEO } from '../hooks/useSEO';
import { BLOCKS, PODIUM_CAPTIONS, CAPTION_LABELS } from '../components/Podium/podiumConstants';

const GOLD = '#c9a227';

// Per-caption ceiling on the 20-point DCI caption scale. A fully installed,
// spotless caption approaches this; the total formula halves Visual/Music.
const CAP_L = 19.6;

// Which captions each block feeds. Primary gets the full yield, secondary a
// fraction — mirrors the effect matrix in podiumConstants / the design doc.
const BLOCK_EFFECTS = {
  warmup: { primary: [], secondary: ['VP'] },
  visualBasics: { primary: ['VP'], secondary: ['VA', 'CG'] },
  visualEnsemble: { primary: ['GE2', 'VA'], secondary: ['VP', 'CG'] },
  guardSectionals: { primary: ['CG'], secondary: ['VA', 'GE2'] },
  brassSectionals: { primary: ['B'], secondary: ['GE1', 'MA'] },
  percussionSectionals: { primary: ['P'], secondary: ['GE1', 'MA'] },
  fullEnsemble: { primary: ['GE1', 'GE2', 'MA'], secondary: ['VA', 'CG', 'B', 'P'] },
};

const BLOCKS_PER_DAY = 12;
const DIMINISH = [1, 0.6, 0.35, 0.2, 0.1]; // yield multiplier by same-block repeat count

// Group captions for the box-score subtotal display.
const GE = ['GE1', 'GE2'];
const VIS = ['VP', 'VA', 'CG'];
const MUS = ['B', 'MA', 'P'];

const initCaptions = () =>
  PODIUM_CAPTIONS.reduce((acc, c) => {
    acc[c] = { content: 52, clean: 38 };
    return acc;
  }, {});

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

// A single caption's contribution on the 20-scale: installed content, gated by
// how clean it is, against the caption ceiling.
const captionValue = ({ content, clean }) =>
  clamp(CAP_L * (content / 100) * (0.72 + 0.28 * (clean / 100)), 0, 19.9);

// The game's total formula: GE full weight, Visual + Music halved, hard cap.
const projectedTotal = (caps) => {
  const v = (c) => captionValue(caps[c]);
  const ge = GE.reduce((s, c) => s + v(c), 0);
  const vis = VIS.reduce((s, c) => s + v(c), 0);
  const mus = MUS.reduce((s, c) => s + v(c), 0);
  return clamp(ge + vis / 2 + mus / 2, 0, 99.7);
};

// =============================================================================
// SMALL PRESENTATION COMPONENTS
// =============================================================================

const Meter = ({ label, value, color, note }) => (
  <div>
    <div className="flex items-center justify-between mb-1">
      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</span>
      <span className="text-[11px] font-bold font-data tabular-nums text-white">
        {Math.round(value)}
        <span className="text-muted">/100</span>
      </span>
    </div>
    <div className="h-2 bg-[#111] border border-[#2a2a2a] overflow-hidden">
      <div
        className="h-full transition-all duration-500"
        style={{ width: `${clamp(value, 0, 100)}%`, backgroundColor: color }}
      />
    </div>
    {note && <p className="text-[10px] text-orange-400 mt-1">{note}</p>}
  </div>
);

const CaptionRow = ({ id, caps }) => {
  const { content, clean } = caps[id];
  const val = captionValue(caps[id]);
  return (
    <div className="flex items-center gap-3 px-3 py-2 border-b border-[#222] last:border-0">
      <div className="w-9 flex-shrink-0">
        <div className="text-xs font-bold text-white">{id}</div>
        <div className="text-[9px] text-muted leading-tight">{CAPTION_LABELS[id]}</div>
      </div>
      <div className="flex-1 space-y-1">
        {/* Content bar */}
        <div className="flex items-center gap-2">
          <span className="text-[8px] uppercase text-muted w-12">Content</span>
          <div className="flex-1 h-1.5 bg-[#111] overflow-hidden">
            <div
              className="h-full transition-all duration-500"
              style={{ width: `${content}%`, backgroundColor: GOLD }}
            />
          </div>
        </div>
        {/* Clean bar */}
        <div className="flex items-center gap-2">
          <span className="text-[8px] uppercase text-muted w-12">Clean</span>
          <div className="flex-1 h-1.5 bg-[#111] overflow-hidden">
            <div
              className="h-full bg-[#5a8dd6] transition-all duration-500"
              style={{ width: `${clean}%` }}
            />
          </div>
        </div>
      </div>
      <div className="w-10 text-right text-sm font-bold font-data tabular-nums text-white">
        {val.toFixed(1)}
      </div>
    </div>
  );
};

// =============================================================================
// MAIN
// =============================================================================

const PodiumPreview = () => {
  useBodyScroll();
  useSEO({
    title: 'Podium Class Demo | marching.art — Run a Drum Corps',
    description:
      'Try the Podium Class daily loop free, no signup: allocate rehearsals, manage your corps, and watch your box score climb against real DCI history.',
    path: '/podium/preview',
    noindex: true,
  });

  const [caps, setCaps] = useState(initCaptions);
  const [day, setDay] = useState(1);
  const [stamina, setStamina] = useState(100);
  const [morale, setMorale] = useState(72);
  const [blocksLeft, setBlocksLeft] = useState(BLOCKS_PER_DAY);
  const [dayCounts, setDayCounts] = useState({}); // per-block repeat counter (this day)
  const [warmups, setWarmups] = useState(0); // warmup blocks done today (efficiency)
  const [rehearsedToday, setRehearsedToday] = useState(() => new Set());
  const [log, setLog] = useState([]); // itemized results for today
  const [, setEngagement] = useState(0); // count only drives the gate; value unused
  const [gateOpen, setGateOpen] = useState(false);
  const [gateSeen, setGateSeen] = useState(false);

  const total = useMemo(() => projectedTotal(caps), [caps]);
  const lowStamina = stamina < 25;

  const bumpEngagement = (by) => {
    setEngagement((e) => {
      const next = e + by;
      if (next >= 6 && !gateSeen) {
        setGateOpen(true);
        setGateSeen(true);
      }
      return next;
    });
  };

  const assignBlock = (block) => {
    if (blocksLeft <= 0) return;

    const effects = BLOCK_EFFECTS[block.id] || { primary: [], secondary: [] };
    const repeat = dayCounts[block.id] || 0;
    const dim = DIMINISH[Math.min(repeat, DIMINISH.length - 1)];
    const staminaFactor = lowStamina ? 0.6 : 1; // tired corps rehearses worse

    // Early-season yields lean toward content install.
    const primaryContent = 3.0 * dim * staminaFactor;
    const primaryClean = 1.3 * dim * staminaFactor;
    const secondaryContent = 1.1 * dim * staminaFactor;
    const secondaryClean = 0.5 * dim * staminaFactor;

    const deltas = [];
    const nextCaps = { ...caps };
    const applyGain = (c, dContent, dClean) => {
      const cur = nextCaps[c];
      const content = clamp(cur.content + dContent, 0, 100);
      // Can't clean beyond what's installed — clean chases content.
      const clean = clamp(cur.clean + dClean, 0, content);
      nextCaps[c] = { content, clean };
      deltas.push({
        c,
        text: `${c} +${dContent.toFixed(1)}% content, +${(clean - cur.clean).toFixed(1)}% clean`,
      });
    };

    effects.primary.forEach((c) => applyGain(c, primaryContent, primaryClean));
    effects.secondary.forEach((c) => applyGain(c, secondaryContent, secondaryClean));

    // Warmup is the condition block: negligible caption yield, real efficiency.
    let staminaCost = 6;
    if (block.id === 'warmup') {
      setWarmups((w) => w + 1);
      setMorale((mo) => clamp(mo + 2, 0, 100));
      staminaCost = 2;
      deltas.push({ c: null, text: 'Corps warmed up — cheaper, sharper blocks the rest of today' });
    } else if (warmups > 0) {
      // Each warmup done today trims the drain of later blocks.
      staminaCost = Math.max(3, 6 - warmups * 1.5);
    }

    const touched = new Set(rehearsedToday);
    [...effects.primary, ...effects.secondary].forEach((c) => touched.add(c));

    setCaps(nextCaps);
    setStamina((s) => clamp(s - staminaCost, 0, 100));
    setBlocksLeft((b) => b - 1);
    setDayCounts((d) => ({ ...d, [block.id]: (d[block.id] || 0) + 1 }));
    setRehearsedToday(touched);
    setLog((l) => [{ id: Date.now() + Math.random(), block: block.label, deltas }, ...l]);
    bumpEngagement(1);
  };

  const finishDay = ({ rest }) => {
    // Overnight recovery + grind/rest morale, then neglect decay on any caption
    // not touched today (clean only — you don't forget the book, you get dirty).
    const grind = !rest && blocksLeft === 0;
    setStamina((s) => clamp(s + (rest ? 35 : 22), 0, 100));
    setMorale((mo) => clamp(mo + (rest ? 8 : grind ? -6 : 2), 0, 100));

    if (!rest) {
      setCaps((prev) => {
        const next = { ...prev };
        PODIUM_CAPTIONS.forEach((c) => {
          if (!rehearsedToday.has(c)) {
            next[c] = { ...next[c], clean: clamp(next[c].clean - 1.6, 0, next[c].content) };
          }
        });
        return next;
      });
    }

    setDay((d) => d + 1);
    setBlocksLeft(BLOCKS_PER_DAY);
    setDayCounts({});
    setWarmups(0);
    setRehearsedToday(new Set());
    setLog([]);
    bumpEngagement(2);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0a] text-white">
      {/* HEADER */}
      <header className="flex-shrink-0 h-14 bg-[#1a1a1a] border-b border-[#333] flex items-center px-4">
        <Link
          to="/podium"
          className="inline-flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors press-feedback min-h-touch px-2 -ml-2"
        >
          <ChevronLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Podium</span>
        </Link>
        <div
          className="ml-3 px-2.5 py-1 border rounded-none"
          style={{ borderColor: `${GOLD}66`, backgroundColor: `${GOLD}22` }}
        >
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: GOLD }}>
            Demo
          </span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Link
            to="/podium"
            className="flex items-center gap-1.5 px-3 h-9 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <LogIn className="w-4 h-4" />
            <span className="hidden sm:inline">Sign In</span>
          </Link>
          <Link
            to="/podium"
            className="flex items-center gap-1.5 px-4 h-9 text-black text-sm font-bold rounded-none transition-colors"
            style={{ backgroundColor: GOLD }}
          >
            <UserPlus className="w-4 h-4" />
            <span>Found Corps</span>
          </Link>
        </div>
      </header>

      {/* MAIN — document-body scroll */}
      <main className="flex-1 pb-16">
        <div className="max-w-5xl mx-auto p-4 lg:p-6">
          {/* Notice */}
          <m.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-4 border rounded-none flex flex-col sm:flex-row sm:items-center gap-3"
            style={{
              borderColor: `${GOLD}4d`,
              background: `linear-gradient(90deg, ${GOLD}1f, transparent)`,
            }}
          >
            <div className="flex items-center gap-3 flex-1">
              <Info className="w-5 h-5 flex-shrink-0" style={{ color: GOLD }} />
              <div>
                <p className="text-sm text-white font-medium">
                  This is the Podium daily loop — no signup needed
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Spend today&rsquo;s rehearsal blocks, watch your show grow, then advance the day.
                  Found a corps to keep a real season going.
                </p>
              </div>
            </div>
            <Link
              to="/podium"
              className="flex items-center justify-center gap-2 px-4 h-10 text-black text-sm font-bold rounded-none whitespace-nowrap"
              style={{ backgroundColor: GOLD }}
            >
              Found Your Corps
              <ArrowRight className="w-4 h-4" />
            </Link>
          </m.div>

          {/* Director's Sheet header */}
          <div className="bg-[#1a1a1a] border border-[#333] rounded-none mb-4">
            <div className="flex flex-wrap items-center gap-4 p-4">
              <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                <div
                  className="w-11 h-11 flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${GOLD}22`, border: `1px solid ${GOLD}55` }}
                >
                  <Medal className="w-5 h-5" style={{ color: GOLD }} />
                </div>
                <div>
                  <div className="text-base font-bold text-white leading-tight">
                    Cadence Community Corps
                  </div>
                  <div className="text-[11px] text-muted">
                    Dayton, OH · Community Corps · Day {day} of the season
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted">
                  Projected Total
                </div>
                <div
                  className="text-3xl font-extrabold font-data tabular-nums"
                  style={{ color: GOLD }}
                >
                  {total.toFixed(2)}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 px-4 pb-4">
              <Meter
                label="Stamina"
                value={stamina}
                color={lowStamina ? '#ef4444' : '#22c55e'}
                note={lowStamina ? 'Cooked — rehearsals yield less. Rest soon.' : null}
              />
              <Meter label="Morale" value={morale} color="#a855f7" />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* LEFT: Rehearsal */}
            <div className="space-y-4">
              <div className="bg-[#1a1a1a] border border-[#333] rounded-none">
                <div className="bg-[#222] px-4 py-3 border-b border-[#333] flex items-center justify-between">
                  <h2 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5" style={{ color: GOLD }} />
                    Today&rsquo;s Rehearsal
                  </h2>
                  <span className="text-[11px] font-bold font-data tabular-nums text-white">
                    {blocksLeft}
                    <span className="text-muted">/{BLOCKS_PER_DAY} blocks</span>
                  </span>
                </div>
                <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {BLOCKS.map((block) => (
                    <button
                      key={block.id}
                      onClick={() => assignBlock(block)}
                      disabled={blocksLeft <= 0}
                      className="text-left p-2.5 border border-[#333] bg-[#111] hover:border-[#c9a227]/60 hover:bg-[#161616] active:scale-[0.98] transition-all rounded-none disabled:opacity-40 disabled:cursor-not-allowed group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">{block.label}</span>
                        <span
                          className="text-sm font-bold opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{ color: GOLD }}
                        >
                          +
                        </span>
                      </div>
                      <p className="text-[10px] text-muted leading-tight mt-0.5">
                        {block.detail}
                      </p>
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 p-3 border-t border-[#333]">
                  <button
                    onClick={() => finishDay({ rest: false })}
                    className="flex-1 h-11 flex items-center justify-center gap-2 text-black font-bold text-sm uppercase tracking-wider rounded-none active:scale-[0.98] transition-all"
                    style={{ backgroundColor: GOLD }}
                  >
                    <Moon className="w-4 h-4" />
                    Advance Day
                  </button>
                  <button
                    onClick={() => finishDay({ rest: true })}
                    className="flex-1 h-11 flex items-center justify-center gap-2 border border-[#333] text-gray-300 font-bold text-sm uppercase tracking-wider rounded-none hover:border-[#444] hover:text-white active:scale-[0.98] transition-all"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Rest Day
                  </button>
                </div>
              </div>

              {/* Activity log — the "Action Complete!" feedback */}
              <div className="bg-[#1a1a1a] border border-[#333] rounded-none">
                <div className="bg-[#222] px-4 py-3 border-b border-[#333]">
                  <h2 className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Today&rsquo;s Results
                  </h2>
                </div>
                <div className="max-h-64 overflow-y-auto scroll-momentum">
                  {log.length === 0 ? (
                    <p className="text-xs text-muted p-4">
                      Assign a rehearsal block to see its itemized result here.
                    </p>
                  ) : (
                    log.map((entry) => (
                      <div
                        key={entry.id}
                        className="px-4 py-2.5 border-b border-[#222] last:border-0"
                      >
                        <div className="text-xs font-bold text-white mb-1">{entry.block}</div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                          {entry.deltas.map((d, i) => (
                            <span
                              key={i}
                              className="text-[10px]"
                              style={{ color: d.c ? GOLD : '#9ca3af' }}
                            >
                              {d.text}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT: Caption sheet */}
            <div className="bg-[#1a1a1a] border border-[#333] rounded-none h-fit">
              <div className="bg-[#222] px-4 py-3 border-b border-[#333] flex items-center justify-between">
                <h2 className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Caption Sheet
                </h2>
                <span className="text-[10px] text-muted">all 8 captions · 0–20</span>
              </div>
              <div>
                {PODIUM_CAPTIONS.map((id) => (
                  <CaptionRow key={id} id={id} caps={caps} />
                ))}
              </div>
              <div className="px-4 py-2.5 border-t border-[#333] bg-[#111]">
                <p className="text-[10px] text-muted leading-relaxed">
                  Your captions score inside the real historical envelope of DCI results for the day
                  — content installed, cleaned, and gated by condition. In a real season this drops
                  nightly as a full box score.
                </p>
              </div>
            </div>
          </div>

          {/* Bottom CTA */}
          <div
            className="mt-6 border rounded-none p-5 text-center"
            style={{
              borderColor: `${GOLD}4d`,
              background: `linear-gradient(180deg, ${GOLD}14, transparent)`,
            }}
          >
            <h3 className="text-base font-bold text-white">Ready to run a real season?</h3>
            <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto">
              This demo resets on refresh. Found a free corps to keep your season, route a tour,
              compete on the nightly box score, and climb toward Champion Status.
            </p>
            <Link
              to="/podium"
              className="mt-4 inline-flex items-center gap-2 h-11 px-6 text-black font-bold text-sm uppercase tracking-wider rounded-none"
              style={{ backgroundColor: GOLD }}
            >
              <UserPlus className="w-4 h-4" />
              Found Your Corps — Free
            </Link>
            <div className="flex items-center justify-center gap-2 mt-3 text-muted">
              <Zap className="w-3.5 h-3.5 text-green-500" />
              <span className="text-xs">Always open · takes under two minutes</span>
            </div>
          </div>
        </div>
      </main>

      {/* Registration gate — fires once after a little engagement */}
      {gateOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
          onClick={() => setGateOpen(false)}
        >
          <m.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm bg-[#1a1a1a] border border-[#333] rounded-none p-6 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setGateOpen(false)}
              className="absolute top-3 right-3 p-1.5 text-muted hover:text-white"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
            <div
              className="w-12 h-12 flex items-center justify-center mb-4"
              style={{ backgroundColor: `${GOLD}22`, border: `1px solid ${GOLD}55` }}
            >
              <Medal className="w-6 h-6" style={{ color: GOLD }} />
            </div>
            <h3 className="text-lg font-bold text-white">Nice — the corps is growing.</h3>
            <p className="text-sm text-gray-400 mt-1.5">
              You&rsquo;re getting the loop. Found a free corps and this becomes a real season:
              nightly box scores, a full tour, staff, divisions, and the climb to Champion Status.
            </p>
            <Link
              to="/podium"
              className="mt-5 w-full h-11 flex items-center justify-center gap-2 text-black font-bold text-sm uppercase tracking-wider rounded-none"
              style={{ backgroundColor: GOLD }}
            >
              <UserPlus className="w-4 h-4" />
              Found My Corps — Free
            </Link>
            <button
              onClick={() => setGateOpen(false)}
              className="mt-2 w-full h-10 flex items-center justify-center gap-2 text-gray-400 hover:text-white text-sm font-medium transition-colors"
            >
              <Play className="w-4 h-4" />
              Keep exploring the demo
            </button>
          </m.div>
        </div>
      )}
    </div>
  );
};

export default PodiumPreview;
