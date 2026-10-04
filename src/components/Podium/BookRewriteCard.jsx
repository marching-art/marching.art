// BookRewriteCard — the once-a-season book rewrite (2026-10, PODIUM.md decision
// 44). A director may move up to `maxCaptions` captions to a new challenge
// level through `lastDay`, for the arranger fee in Corps Budget. The card
// states the terms only — what a rewrite costs the corps, and when it pays,
// are for directors to discover (decision 47). Terms come from the server.

import React, { useState } from 'react';
import { PenLine, Loader2 } from 'lucide-react';
import { PODIUM_CAPTIONS, CAPTION_LABELS } from './podiumConstants';

/** One-tap caption families — rewriting the closer touches a whole section. */
const FAMILIES = [
  { id: 'music', label: 'Music', captions: ['B', 'MA', 'P'] },
  { id: 'visual', label: 'Visual', captions: ['VP', 'VA', 'CG'] },
  { id: 'ge', label: 'General Effect', captions: ['GE1', 'GE2'] },
];

/** @param {string} caption */
const labelOf = (caption) =>
  /** @type {Record<string, string>} */ (CAPTION_LABELS)[caption] || caption;

/**
 * @param {{ podium: { data?: any, rewriteBook?: (captions: string[], toLevel: number) => Promise<any> } }} props
 */
export default function BookRewriteCard({ podium }) {
  const data = podium.data || {};
  const state = data.state;
  /** @type {{fee: number, lastDay: number, maxCaptions: number} | null} */
  const terms = data.bookRewriteTerms || null;
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(/** @type {string[]} */ ([]));
  const [level, setLevel] = useState(8);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(/** @type {string | null} */ (null));

  if (!terms || !state?.captions) return null;
  const day = data.competitionDay;
  /** @type {{day: number, toLevel: number, from: Record<string, number>} | undefined} */
  const used = state.bookRewrite;

  if (used) {
    return (
      <p className="flex items-start gap-1.5 text-[10px] text-secondary">
        <PenLine className="w-3 h-3 mt-px text-interactive shrink-0" aria-hidden="true" />
        <span>
          Book rewritten on Day {used.day}:{' '}
          {Object.entries(used.from)
            .map(([caption, from]) => `${labelOf(caption)} ${from} → ${used.toLevel}`)
            .join(', ')}
          .
        </span>
      </p>
    );
  }
  if (day > terms.lastDay || data.competitionDay == null) return null;

  /** @param {string} caption */
  const toggle = (caption) =>
    setSelected((prev) =>
      prev.includes(caption)
        ? prev.filter((c) => c !== caption)
        : prev.length < terms.maxCaptions
          ? [...prev, caption]
          : prev
    );
  const unchanged = selected.some((c) => state.captions[c]?.challenge === level);
  const raising = selected.some((c) => (state.captions[c]?.challenge ?? level) < level);

  const submit = async () => {
    if (!podium.rewriteBook) return;
    setBusy(true);
    setError(null);
    try {
      await podium.rewriteBook(selected, level);
      setOpen(false);
      setSelected([]);
    } catch (e) {
      setError(/** @type {any} */ (e)?.message || 'Rewrite failed.');
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted hover:text-white press-feedback"
      >
        <PenLine className="w-3 h-3" aria-hidden="true" />
        Rewrite the book (once a season, through Day {terms.lastDay})
      </button>
    );
  }

  return (
    <div
      className="border border-line bg-surface-sunken p-3 space-y-2"
      role="group"
      aria-label="Rewrite the book"
    >
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-white">
        <PenLine className="w-3 h-3 text-interactive" aria-hidden="true" />
        Rewrite the book
      </div>
      <p className="text-[10px] text-secondary leading-snug">
        Move up to {terms.maxCaptions} captions to a new challenge level. Once per season, through
        Day {terms.lastDay} · {terms.fee} Budget.
      </p>
      <div className="flex flex-wrap gap-2">
        {FAMILIES.map((family) => (
          <button
            key={family.id}
            type="button"
            onClick={() => setSelected(family.captions.slice(0, terms.maxCaptions))}
            className="min-h-touch px-2.5 text-[10px] font-bold uppercase tracking-wider border border-line text-muted hover:text-white press-feedback"
          >
            {family.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
        {PODIUM_CAPTIONS.map((caption) => (
          <label key={caption} className="flex items-center gap-1.5 text-[10px] text-secondary">
            <input
              type="checkbox"
              checked={selected.includes(caption)}
              onChange={() => toggle(caption)}
              disabled={!selected.includes(caption) && selected.length >= terms.maxCaptions}
            />
            {caption} · Lv {state.captions[caption]?.challenge}
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-[10px] text-secondary flex items-center gap-1.5">
          New level
          <select
            value={level}
            onChange={(e) => setLevel(Number(e.target.value))}
            className="bg-surface-sunken border border-line rounded-none px-2 py-1 text-[11px] text-white"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={busy || selected.length === 0 || unchanged}
          onClick={submit}
          className="text-[10px] font-bold uppercase px-2.5 py-1 rounded-none bg-interactive text-white hover:bg-interactive-hover disabled:opacity-50 press-feedback"
        >
          {busy ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            `${raising ? 'Rewrite' : 'Simplify'} · ${terms.fee} Budget`
          )}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[10px] font-bold uppercase text-muted hover:text-white"
        >
          Cancel
        </button>
      </div>
      {unchanged && (
        <p className="text-[10px] text-warning">A picked caption is already at level {level}.</p>
      )}
      {error && <p className="text-[10px] text-red-400">{error}</p>}
    </div>
  );
}
