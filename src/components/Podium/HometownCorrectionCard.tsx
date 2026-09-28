// HometownCorrectionCard — the one-time free hometown correction (design §5.3).
// Directors who founded their corps while the official home had to be a
// historical show city can move it to ANY real US/Canadian town once, free,
// mid-season. Shown only while the server says the correction is open
// (`hometown.canCorrect`); "Keep" collapses it to a one-line reminder rather
// than hiding it, so the fix stays one tap away all season.

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Home, Loader2 } from 'lucide-react';
import TownPicker, { type SelectedHome } from './TownPicker';
import type { PodiumHometownStatus } from '../../api/podium';

interface HometownCorrectionCardProps {
  podium: {
    data?: {
      hometown?: PodiumHometownStatus;
      currentLocation?: { atHome?: boolean } | null;
      state?: Record<string, unknown>;
    } | null;
    correctHometown: (
      location: string
    ) => Promise<{ home: string; previous: string | null; touring: boolean }>;
  };
}

const collapseKey = (seasonUid: string) => `podium.hometownCorrection.collapsed.${seasonUid}`;

function readCollapsed(seasonUid: string): boolean {
  try {
    return window.localStorage.getItem(collapseKey(seasonUid)) === '1';
  } catch {
    return false;
  }
}

function writeCollapsed(seasonUid: string, collapsed: boolean) {
  try {
    if (collapsed) window.localStorage.setItem(collapseKey(seasonUid), '1');
    else window.localStorage.removeItem(collapseKey(seasonUid));
  } catch {
    /* per-viewer convenience only */
  }
}

export default function HometownCorrectionCard({ podium }: HometownCorrectionCardProps) {
  const status = podium.data?.hometown;
  const seasonUid = String(podium.data?.state?.seasonUid || 'current');
  const [collapsed, setCollapsed] = useState(() => readCollapsed(seasonUid));
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<SelectedHome | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!status?.canCorrect) return null;

  const current = status.city;
  const atHome = podium.data?.currentLocation?.atHome !== false;
  const unchanged = Boolean(selected && current && selected.label === current);

  const collapse = (value: boolean) => {
    writeCollapsed(seasonUid, value);
    setCollapsed(value);
  };

  const save = async () => {
    if (!selected || unchanged) return;
    setSaving(true);
    setError(null);
    try {
      const result = await podium.correctHometown(selected.label);
      toast.success(
        result.touring
          ? `Home moved to ${result.home}. Your tour keeps running from your last show.`
          : `Home moved to ${result.home}. Your route is now priced from there.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change your hometown.');
      setSaving(false);
    }
  };

  if (collapsed) {
    return (
      <div className="bg-surface-card border border-line rounded-none px-3 py-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 text-[11px] text-muted">
          <Home className="w-3.5 h-3.5 shrink-0 text-interactive" />
          <span className="truncate">
            Hometown: <span className="text-secondary">{current || 'not set'}</span> · one free
            change available
          </span>
        </div>
        <button
          type="button"
          onClick={() => collapse(false)}
          className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-interactive hover:underline"
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="bg-interactive/5 border border-interactive/30 rounded-none p-4 space-y-3">
      <div className="flex items-start gap-2">
        <Home className="w-4 h-4 shrink-0 mt-0.5 text-interactive" />
        <div className="space-y-1">
          <div className="text-xs font-bold text-white uppercase tracking-wider">
            Your hometown can be any town now
          </div>
          <p className="text-[11px] text-secondary leading-relaxed">
            When you founded your corps, your home had to be a city that hosts shows
            {current ? (
              <>
                {' '}
                — you picked <span className="font-bold text-white">{current}</span>
              </>
            ) : null}
            . You can move it to your real hometown once, for free.{' '}
            {atHome
              ? "Your tour hasn't started yet, so your route will be priced from the new town."
              : 'Your tour keeps running from your last show, so no travel you’ve paid for changes.'}{' '}
            Your profile shows the new home, and next season starts from it.
          </p>
        </div>
      </div>

      <TownPicker
        query={query}
        onQueryChange={setQuery}
        selected={selected}
        onSelect={setSelected}
      />

      {unchanged && (
        <p className="text-[10px] text-muted">That&apos;s already your home — pick another town.</p>
      )}
      {error && <p className="text-[11px] text-red-400">{error}</p>}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => collapse(true)}
          className="h-9 px-3 text-[10px] font-bold uppercase tracking-wider text-muted hover:text-white"
        >
          {current ? `Keep ${current}` : 'Not now'}
        </button>
        <button
          type="button"
          onClick={save}
          disabled={!selected || unchanged || saving}
          className="h-9 px-3 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider bg-interactive text-white disabled:opacity-50"
        >
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {selected && !unchanged ? `Move home to ${selected.label}` : 'Move home'}
        </button>
      </div>
      <p className="text-[10px] text-muted">
        One free change. After that, you can move your home between seasons when you register.
      </p>
    </div>
  );
}
