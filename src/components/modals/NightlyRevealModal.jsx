// =============================================================================
// NIGHTLY REVEAL MODAL — the "scores are up" ceremony
// =============================================================================
// The reveal beat of the nightly ritual (GAMEPLAY: the score drop is the
// game's core daily moment). Once per game day, when the just-processed
// night includes the director's own results, this stages them the way scores
// are announced at retreat: show name first, the total counting up, then the
// placement — with resolved predictions and a copy-for-Discord share card.
//
// Design rules honored here:
//   • Pure presentation — every number was computed server-side and read
//     from fantasy_recaps/profile. No rewards for watching (a reveal that
//     pays becomes a claim button).
//   • Skippable, and fully static under prefers-reduced-motion.
//   • Share text carries totals and placement only — public artifacts never
//     include caption-level detail (anti-lineup-harvesting rule).

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, Share2, X, TrendingUp } from 'lucide-react';
import toast from 'react-hot-toast';
import Portal from '../Portal';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { CLASS_DISPLAY_NAMES } from '../Dashboard/sections/constants';
import { getSoundSportRating } from '../../utils/scoresUtils';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const placementLabel = (placement) => {
  if (!placement) return null;
  if (placement === 1) return '🥇 1st';
  if (placement === 2) return '🥈 2nd';
  if (placement === 3) return '🥉 3rd';
  return `${placement}th`;
};

/** Count 0 → target over `duration` ms; jumps straight to target when static. */
function useCountUp(target, run, staticMode, duration = 900) {
  const [value, setValue] = useState(staticMode ? target : 0);
  const frame = useRef(null);
  useEffect(() => {
    if (staticMode || !run) {
      if (staticMode) setValue(target);
      return undefined;
    }
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      // ease-out cubic — fast start, settling landing
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(target * eased);
      if (t < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [target, run, staticMode, duration]);
  return value;
}

const ResultCard = ({ result, run, staticMode }) => {
  const isSoundSport = result.corpsClass === 'soundSport';
  const score = useCountUp(result.totalScore || 0, run, staticMode);
  // Placement lands a beat after the score finishes counting.
  const [showPlacement, setShowPlacement] = useState(staticMode);
  useEffect(() => {
    if (staticMode || !run) return undefined;
    const t = setTimeout(() => setShowPlacement(true), 1100);
    return () => clearTimeout(t);
  }, [run, staticMode]);

  const placement = placementLabel(result.placement);

  return (
    <div className="p-3 bg-background border border-line">
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-white truncate">{result.corpsName}</p>
          <p className="text-[10px] uppercase tracking-wider text-muted truncate">
            {CLASS_DISPLAY_NAMES[result.corpsClass] || result.corpsClass} · {result.eventName}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          {isSoundSport ? (
            <p className="text-lg font-bold text-brand font-data">
              {getSoundSportRating(result.totalScore)}
            </p>
          ) : (
            <p className="text-lg font-bold text-white font-data tabular-nums">
              {score.toFixed(3)}
            </p>
          )}
        </div>
      </div>
      <div
        className={`mt-2 flex items-center justify-between transition-opacity duration-500 ${
          showPlacement ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {!isSoundSport && (
          <p className="text-[10px] uppercase tracking-wider text-muted font-data">
            GE {Number(result.geScore || 0).toFixed(2)} · VIS{' '}
            {Number(result.visualScore || 0).toFixed(2)} · MUS{' '}
            {Number(result.musicScore || 0).toFixed(2)}
          </p>
        )}
        <div className="flex items-center gap-2 ml-auto">
          {placement && !isSoundSport && (
            <span className="text-xs font-bold text-white font-data">
              {placement}
              {result.fieldSize ? (
                <span className="text-muted font-normal"> of {result.fieldSize}</span>
              ) : null}
            </span>
          )}
          {result.seasonRank && (
            <span className="flex items-center gap-1 text-[10px] text-brand font-data">
              <TrendingUp className="w-3 h-3" />#{result.seasonRank}
              {result.seasonRankOf ? ` of ${result.seasonRankOf}` : ''}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

const NightlyRevealModal = ({ reveal, onClose }) => {
  useEscapeKey(onClose);
  const staticMode = useMemo(prefersReducedMotion, []);
  // Cards reveal one at a time, retreat-style; Skip shows everything.
  const [step, setStep] = useState(staticMode ? Number.MAX_SAFE_INTEGER : 0);

  useEffect(() => {
    if (staticMode) return undefined;
    if (step >= reveal.results.length) return undefined;
    const t = setTimeout(() => setStep((s) => s + 1), step === 0 ? 700 : 1600);
    return () => clearTimeout(t);
  }, [step, staticMode, reveal.results.length]);

  const allShown = step >= reveal.results.length;

  const shareText = useMemo(() => {
    const lines = [`🎺 marching.art — Day ${reveal.day}`];
    for (const r of reveal.results) {
      const isSoundSport = r.corpsClass === 'soundSport';
      const scorePart = isSoundSport
        ? getSoundSportRating(r.totalScore)
        : `${Number(r.totalScore).toFixed(3)}${r.placement ? ` — ${placementLabel(r.placement)}` : ''}`;
      lines.push(`${r.corpsName}: ${scorePart} · ${r.eventName}`);
      if (r.seasonRank && !isSoundSport) {
        lines.push(`  Season: #${r.seasonRank}${r.seasonRankOf ? ` of ${r.seasonRankOf}` : ''}`);
      }
    }
    if (reveal.predictions) {
      lines.push(`Predictions: ${reveal.predictions.correct}/${reveal.predictions.total} correct`);
    }
    lines.push('https://marching.art');
    return lines.join('\n');
  }, [reveal]);

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      toast.success('Recap copied — paste it into the league chat or Discord.');
    } catch {
      toast.error('Could not copy to clipboard');
    }
  };

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title-nightly-reveal"
      >
        <div
          className="w-full max-w-lg max-h-[85dvh] bg-surface-card border border-brand/30 rounded-none flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-line bg-surface-raised flex-shrink-0">
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-brand" />
              <div>
                <h2
                  id="modal-title-nightly-reveal"
                  className="text-xs font-bold uppercase tracking-wider text-secondary"
                >
                  Scores Are Up
                </h2>
                <p className="text-[10px] text-muted">Day {reveal.day} · tonight&apos;s recap</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-muted hover:text-white"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-4 overflow-y-auto flex-1 space-y-2">
            {reveal.results.map((result, i) => (
              <div
                key={`${result.corpsClass}-${result.eventName}`}
                className={
                  staticMode
                    ? ''
                    : `transition-opacity duration-500 ${i < step ? 'opacity-100' : 'opacity-0'}`
                }
              >
                {(staticMode || i < step) && (
                  <ResultCard
                    result={result}
                    run={!staticMode && i < step}
                    staticMode={staticMode}
                  />
                )}
              </div>
            ))}

            {(allShown || staticMode) && reveal.predictions && (
              <div className="p-3 bg-brand/10 border border-brand/30 flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-brand">
                  Last Night&apos;s Predictions
                </p>
                <p className="text-sm font-bold text-white font-data">
                  {reveal.predictions.correct}/{reveal.predictions.total} correct
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-line bg-surface-sunken flex items-center justify-between gap-2 flex-shrink-0">
            {!allShown && !staticMode ? (
              <button
                onClick={() => setStep(Number.MAX_SAFE_INTEGER)}
                className="h-9 px-3 text-xs font-bold uppercase tracking-wider text-muted border border-line hover:text-white"
              >
                Skip
              </button>
            ) : (
              <button
                onClick={handleShare}
                className="h-9 px-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted border border-line hover:text-white"
              >
                <Share2 className="w-3.5 h-3.5" />
                Share
              </button>
            )}
            <button
              onClick={onClose}
              className="h-9 px-4 bg-interactive text-white text-sm font-bold uppercase tracking-wider hover:bg-interactive-hover"
            >
              To the Dashboard
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
};

export default NightlyRevealModal;
