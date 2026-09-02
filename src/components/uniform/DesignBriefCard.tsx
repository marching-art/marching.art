// =============================================================================
// DESIGN BRIEF CARD — this week's styling challenge, on the Exchange page
// =============================================================================
// Shows the rotating weekly brief (title, blurb, the wants it scores),
// lets a director submit any saved design, and renders the returned
// matched/missed breakdown plus the public leaderboard. All scoring happens
// server-side (api/designBrief) — this card never guesses at a score.

import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Check, ClipboardList, Loader2, X } from 'lucide-react';
import {
  getDesignBrief,
  submitDesignBrief,
  type BriefEntry,
  type BriefView,
  type BriefWant,
} from '../../api/designBrief';
import { listWardrobe, type WardrobeDesign } from '../../api/uniformStudio';
import { ColorwayStrip } from '../scores/SheetPrimitives';
import { friendlyCallableError } from '../../utils/callableErrors';

export default function DesignBriefCard({ uid }: { uid: string | null }) {
  const [brief, setBrief] = useState<BriefView | null>(null);
  const [myEntry, setMyEntry] = useState<BriefEntry | null>(null);
  const [top, setTop] = useState<BriefEntry[]>([]);
  const [wardrobe, setWardrobe] = useState<WardrobeDesign[]>([]);
  const [pick, setPick] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ matched: BriefWant[]; missed: BriefWant[] } | null>(null);

  const refresh = useCallback(async () => {
    if (!uid) return;
    try {
      const [res, designs] = await Promise.all([getDesignBrief({}), listWardrobe(uid)]);
      setBrief(res.data.brief);
      setMyEntry(res.data.myEntry);
      setTop(res.data.top);
      setWardrobe(designs);
      setPick((prev) => prev || designs[0]?.id || '');
    } catch {
      // non-fatal: the card just doesn't render this visit
    }
  }, [uid]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!brief) return null;

  const doSubmit = async () => {
    if (!pick) return;
    setBusy(true);
    try {
      const res = await submitDesignBrief({ designId: pick });
      setResult({ matched: res.data.matched, missed: res.data.missed });
      setMyEntry((prev) => ({
        username: prev?.username || 'you',
        designName: wardrobe.find((w) => w.id === pick)?.name || 'Your design',
        colors: prev?.colors ?? null,
        score: res.data.best,
      }));
      toast.success(res.data.message);
    } catch (err) {
      toast.error(friendlyCallableError(err, "Couldn't score that design."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-surface-card border border-line p-4 mt-4">
      <div className="flex flex-wrap items-baseline gap-2 border-b border-line pb-2">
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-white flex items-center gap-2">
          <ClipboardList className="w-3.5 h-3.5 text-interactive" />
          Weekly Design Brief
        </h2>
        <span className="text-[10px] uppercase tracking-wider text-muted">{brief.weekId}</span>
        {myEntry && (
          <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-interactive">
            Your best: {myEntry.score}/100
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
        <div>
          <h3 className="text-sm font-bold text-white">{brief.title}</h3>
          <p className="text-xs text-muted mt-1">{brief.blurb}</p>
          <ul className="mt-2 space-y-1">
            {(result ? [...result.matched, ...result.missed] : brief.wants).map((want) => {
              const matched = result ? result.matched.includes(want) : null;
              return (
                <li key={want.label} className="flex items-center gap-1.5 text-[11px]">
                  {matched === null ? (
                    <span className="w-3 h-3 border border-line flex-shrink-0" />
                  ) : matched ? (
                    <Check className="w-3 h-3 text-green-400 flex-shrink-0" />
                  ) : (
                    <X className="w-3 h-3 text-muted flex-shrink-0" />
                  )}
                  <span className={matched === false ? 'text-muted' : 'text-white'}>
                    {want.label}
                  </span>
                  <span className="text-muted ml-auto tabular-nums">{want.points}</span>
                </li>
              );
            })}
          </ul>
          {wardrobe.length > 0 ? (
            <div className="flex gap-2 mt-3">
              <select
                value={pick}
                onChange={(e) => setPick(e.target.value)}
                aria-label="Design to submit"
                className="flex-1 min-w-0 bg-background border border-line px-2 py-2 text-xs text-white rounded-none focus:outline-none focus:border-interactive"
              >
                {wardrobe.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void doSubmit()}
                disabled={busy || !pick}
                className="px-3 py-2 bg-interactive text-white text-[11px] font-bold uppercase tracking-wider hover:bg-interactive-hover disabled:opacity-40 flex items-center gap-1.5"
              >
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                Score it
              </button>
            </div>
          ) : (
            <p className="text-[11px] text-muted mt-3">
              Save a design in the{' '}
              <Link to="/studio" className="text-interactive hover:underline">
                Studio
              </Link>{' '}
              to enter.
            </p>
          )}
        </div>

        <div>
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted mb-2">
            This week&rsquo;s board
          </h4>
          {top.length === 0 ? (
            <p className="text-[11px] text-muted">No entries yet — set the bar.</p>
          ) : (
            <ol className="space-y-1">
              {top.map((entry, i) => (
                <li key={entry.uid || i} className="flex items-center gap-2 text-[11px]">
                  <span className="text-muted tabular-nums w-4 flex-shrink-0">{i + 1}.</span>
                  <ColorwayStrip colors={entry.colors} />
                  <span className="text-white font-bold truncate">{entry.designName}</span>
                  <span className="text-muted truncate">{entry.username}</span>
                  <span className="ml-auto font-bold text-interactive tabular-nums">
                    {entry.score}
                  </span>
                </li>
              ))}
            </ol>
          )}
          <p className="text-[10px] text-muted mt-3">
            A new brief lands every Monday. Scoring is automatic — the checklist is the whole rubric
            — and your first entry each week earns CorpsCoin.
          </p>
        </div>
      </div>
    </div>
  );
}
