// PodiumCaptionPanel — Zone C analyzer analogue for Podium Class (Phase 2).
// Per-caption content/clean progress with challenge level and neglect
// warnings. The full trajectory-vs-percentile-band chart lands with the
// Scores-tab redesign (Phase 6); this is the daily working view.

import React from 'react';
import { AlertTriangle, Film, CheckCircle2 } from 'lucide-react';
import { PODIUM_CAPTIONS, CAPTION_LABELS, REP_TIER_NAMES } from './podiumConstants';

/**
 * @param {{ content: number, clean: number }} props content/clean fractions (0..1)
 */
function ProgressPair({ content, clean }) {
  return (
    <div className="flex-1 space-y-1">
      <div
        className="h-1.5 bg-surface-elevated rounded-none overflow-hidden"
        title="Content installed"
      >
        <div
          className="h-full bg-interactive rounded-none"
          style={{ width: `${Math.min(100, content * 100)}%` }}
        />
      </div>
      <div className="h-1.5 bg-surface-elevated rounded-none overflow-hidden" title="Cleanliness">
        <div
          className="h-full bg-green-500 rounded-none"
          style={{ width: `${Math.min(100, clean * 100)}%` }}
        />
      </div>
    </div>
  );
}

/**
 * @param {{ podium: { data: { competitionDay: number, state?: Record<string, any>, captionRealization?: Record<string, number> } } }} props
 */
export default function PodiumCaptionPanel({ podium }) {
  const state = podium.data?.state;
  if (!state?.captions) return null;

  const day = podium.data.competitionDay;
  const repTier = state.repTier || 1;
  // Judges' tapes from the latest show (§5.4): the two weakest captions the
  // sheets pointed at, cleaned from the tapes overnight. Shown until the next
  // show replaces them.
  /** @type {{ day: number, captions: string[] } | null} */
  const tapes =
    state.lastTapes &&
    Array.isArray(state.lastTapes.captions) &&
    state.lastTapes.captions.length > 0
      ? state.lastTapes
      : null;
  const tapedCaptions = new Set(tapes ? tapes.captions : []);
  // Book learned (decision 43): a caption fielding its whole book scores at its
  // challenge's cap — more rehearsal no longer raises it, a harder book next
  // season would. Server-computed realization; first-learned day from state.
  /** @type {Record<string, number>} */
  const realization = podium.data?.captionRealization || {};
  /** @type {Record<string, number>} */
  const learnedDay = state.bookLearnedDay || {};
  const learned = PODIUM_CAPTIONS.filter((c) => (realization[c] ?? 0) >= 1);
  // Nudge only when the cap arrives with real season left: most of the book
  // maxed before Championship Week means the challenge was too safe.
  const earlyCap = learned.length >= 4 && day < 45;

  return (
    <div className="bg-surface-card border border-line rounded-none p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted">
          Caption Progress
        </h3>
        <span className="text-[10px] font-bold uppercase text-brand">
          {REP_TIER_NAMES[/** @type {keyof typeof REP_TIER_NAMES} */ (repTier)]}
        </span>
      </div>

      {/* Visible legend for the two-bar rows. The bars carried a hover-only
          title, which a touch device never sees — so on a phone the top bar
          (content) and bottom bar (clean) had no key at all. */}
      <div className="flex items-center gap-4 text-[9px] font-bold uppercase tracking-wider text-muted">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-1.5 bg-interactive" aria-hidden="true" />
          Content
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-1.5 bg-green-500" aria-hidden="true" />
          Clean
        </span>
      </div>

      {earlyCap && (
        <p className="flex items-start gap-1.5 text-[10px] text-secondary">
          <CheckCircle2 className="w-3 h-3 mt-px text-green-400 shrink-0" aria-hidden="true" />
          <span>
            {learned.length} of 8 captions have learned their whole book — more rehearsal won’t
            raise them. Keep them clean, and consider a harder challenge next season to give them
            room to grow.
          </span>
        </p>
      )}

      {tapes && (
        <p className="flex items-start gap-1.5 text-[10px] text-secondary">
          <Film className="w-3 h-3 mt-px text-interactive shrink-0" aria-hidden="true" />
          <span>
            Judges’ tapes, Day {tapes.day}: the sheets flagged{' '}
            {tapes.captions
              .map((c) => /** @type {Record<string, string>} */ (CAPTION_LABELS)[c] || c)
              .join(' and ')}{' '}
            — cleaned from the tapes overnight.
          </span>
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
        {PODIUM_CAPTIONS.map((caption) => {
          const cap = state.captions[caption] || {};
          const idleDays = day - (cap.lastRehearsedDay || 0);
          const neglected = idleDays > 3 && day > 0;
          return (
            <div key={caption} className="flex items-center gap-3">
              <div className="w-28 shrink-0">
                <div className="text-[11px] font-bold text-white flex items-center gap-1">
                  {caption}
                  {neglected && (
                    <span title={`Unrehearsed ${idleDays} days — cleanliness is decaying`}>
                      <AlertTriangle className="w-3 h-3 text-warning" />
                    </span>
                  )}
                  {(realization[caption] ?? 0) >= 1 && (
                    <span
                      title={`Whole book learned${learnedDay[caption] ? ` by Day ${learnedDay[caption]}` : ''} — more rehearsal won't raise this caption; a harder book would`}
                    >
                      <CheckCircle2 className="w-3 h-3 text-green-400" aria-hidden="true" />
                      <span className="sr-only">Whole book learned</span>
                    </span>
                  )}
                  {tapedCaptions.has(caption) && (
                    <span title={`Worked from the Day ${tapes?.day} judges’ tapes`}>
                      <Film className="w-3 h-3 text-interactive" aria-hidden="true" />
                      <span className="sr-only">Worked from the judges’ tapes</span>
                    </span>
                  )}
                </div>
                <div className="text-[9px] text-muted truncate">
                  {CAPTION_LABELS[caption]} · Lv {cap.challenge}
                </div>
              </div>
              <ProgressPair content={cap.content || 0} clean={cap.clean || 0} />
              <div className="w-16 shrink-0 text-right text-[10px] tabular-nums text-muted">
                {Math.round((cap.content || 0) * 100)}% ·{' '}
                <span className="text-green-400">{Math.round((cap.clean || 0) * 100)}%</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-4 text-[9px] text-muted uppercase font-bold">
        <span>
          <span className="inline-block w-2 h-2 bg-interactive rounded-none mr-1" />
          Content installed
        </span>
        <span>
          <span className="inline-block w-2 h-2 bg-green-500 rounded-none mr-1" />
          Cleanliness
        </span>
        {state.lastTotal != null && (
          <span className="ml-auto text-muted normal-case">
            Last score:{' '}
            <span className="text-white tabular-nums font-bold">{state.lastTotal.toFixed(3)}</span>
            {state.seasonRank && (
              <>
                {' '}
                · #{state.seasonRank}/{state.seasonRankOf}
              </>
            )}
          </span>
        )}
      </div>
    </div>
  );
}
