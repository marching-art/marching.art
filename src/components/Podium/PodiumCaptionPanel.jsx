// @ts-nocheck -- grandfathered before checkJs; remove when this file is typed or cleaned up
// PodiumCaptionPanel — Zone C analyzer analogue for Podium Class (Phase 2).
// Per-caption content/clean progress with challenge level and neglect
// warnings. The full trajectory-vs-percentile-band chart lands with the
// Scores-tab redesign (Phase 6); this is the daily working view.

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { PODIUM_CAPTIONS, CAPTION_LABELS, REP_TIER_NAMES } from './podiumConstants';

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

export default function PodiumCaptionPanel({ podium }) {
  const state = podium.data?.state;
  if (!state?.captions) return null;

  const day = podium.data.competitionDay;
  const repTier = state.repTier || 1;

  return (
    <div className="bg-surface-card border border-line rounded-none p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted">
          Caption Progress
        </h3>
        <span className="text-[10px] font-bold uppercase text-brand">
          {REP_TIER_NAMES[repTier]}
        </span>
      </div>

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
