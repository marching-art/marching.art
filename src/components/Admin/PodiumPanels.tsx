// Podium Division controls: the runtime launch flag and the funnel telemetry
// the nightly stage writes. Moved out of the old admin page into the Podium
// section of the console.

import { useEffect, useState } from 'react';
import { collection, doc, getDocs, limit, orderBy, query, setDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { Activity, Power } from 'lucide-react';
import { db } from '../../api';
import { useSeasonStore } from '../../store/seasonStore';
import { usePodiumEnabled } from '../../hooks/useFeatures';
import { Panel } from './AdminUI';

/**
 * The runtime flag lives in game-settings/features.podiumClass (admin-writable
 * by rules; a missing field means OFF). Flipping it opens/closes the class
 * instantly — no deploy. The class-registry `enabled` flag (leagues/economy
 * inclusion) is a code change and stays out of this panel by design.
 */
export function PodiumLaunchPanel({ id }: { id?: string }) {
  const podiumEnabled = usePodiumEnabled();
  const [saving, setSaving] = useState(false);

  const toggle = async () => {
    const next = !podiumEnabled;
    if (
      !window.confirm(
        next
          ? 'Enable the Podium Division for ALL users?\n\nThe Podium tab, hosting card, and Scores tab appear immediately; the nightly stage begins processing.'
          : 'Disable the Podium Division?\n\nThe UI hides and the nightly stage stops. All state is preserved — flipping back on resumes where it left off.'
      )
    ) {
      return;
    }
    setSaving(true);
    try {
      await setDoc(doc(db, 'game-settings', 'features'), { podiumClass: next }, { merge: true });
      toast.success(next ? 'The Podium Division is LIVE.' : 'The Podium Division is disabled.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update the feature flag');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel
      id={id}
      title="Launch Control"
      icon={Power}
      description="Runtime flag — gates every Podium surface and the nightly stage. Balance tuning lives in podium-config/balance (read at runtime; a missing doc means committed defaults)."
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span
            aria-hidden
            className={`w-2.5 h-2.5 rounded-full ${podiumEnabled ? 'bg-green-500' : 'bg-charcoal-600'}`}
          />
          <span className="text-sm font-bold text-white">
            {podiumEnabled ? 'Live for all directors' : 'Disabled'}
          </span>
          <span className="text-[10px] text-muted font-mono truncate">
            game-settings/features.podiumClass
          </span>
        </div>
        <button
          type="button"
          onClick={() => void toggle()}
          disabled={saving}
          className={`flex-shrink-0 px-3 py-1.5 text-[11px] font-bold uppercase disabled:opacity-50 ${
            podiumEnabled ? 'bg-line text-secondary' : 'bg-green-600 text-white'
          }`}
        >
          {saving ? 'Saving…' : podiumEnabled ? 'Disable' : 'Enable'}
        </button>
      </div>
    </Panel>
  );
}

interface FunnelRow {
  calendarDay: number;
  competitionDay?: number;
  corps?: number;
  activeSelf?: number;
  restDays?: number;
  blocksPerActiveCorps?: number;
  pickCoverage?: number | null;
  d1ReturnRate?: number | null;
  d1Cohort?: number;
  d7ReturnRate?: number | null;
  d7Cohort?: number;
}

/**
 * D1/D7 return, blocks-per-active-day, rest-day usage, show-pick coverage —
 * written nightly by the Podium stage to
 * podium-metrics/{seasonUid}/days/{calendarDay} (admin-read only).
 */
export function PodiumFunnelPanel({ id }: { id?: string }) {
  const seasonUid = useSeasonStore((state) => state.seasonUid);
  const [rows, setRows] = useState<FunnelRow[] | null>(null);

  useEffect(() => {
    if (!seasonUid) return undefined;
    let cancelled = false;
    getDocs(
      query(
        collection(db, 'podium-metrics', seasonUid, 'days'),
        orderBy('calendarDay', 'desc'),
        limit(14)
      )
    )
      .then((snapshot) => {
        if (!cancelled) setRows(snapshot.docs.map((d) => d.data() as FunnelRow).reverse());
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, [seasonUid]);

  const pct = (v: number | null | undefined) => (v == null ? '—' : `${Math.round(v * 100)}%`);

  return (
    <Panel id={id} title="Funnel — Last 14 Days" icon={Activity} flush>
      {!rows || rows.length === 0 ? (
        <p className="px-4 py-4 text-[11px] text-muted">
          No funnel data for this season yet — the nightly stage writes a row per day once the
          division is live.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[10px] tabular-nums">
            <thead>
              <tr className="text-muted uppercase text-left">
                <th className="px-3 py-1.5">Day</th>
                <th className="px-2 py-1.5">Corps</th>
                <th className="px-2 py-1.5">Played</th>
                <th className="px-2 py-1.5">Rested</th>
                <th className="px-2 py-1.5">Blocks/active</th>
                <th className="px-2 py-1.5">Pick coverage</th>
                <th className="px-2 py-1.5">D1 return</th>
                <th className="px-2 py-1.5">D7 return</th>
              </tr>
            </thead>
            <tbody className="text-secondary">
              {rows.map((row) => (
                <tr key={row.calendarDay} className="border-t border-line-subtle">
                  <td className="px-3 py-1">
                    {(row.competitionDay ?? 0) >= 1
                      ? `D${row.competitionDay}`
                      : `ST${row.calendarDay}`}
                  </td>
                  <td className="px-2 py-1">{row.corps}</td>
                  <td className="px-2 py-1">{row.activeSelf}</td>
                  <td className="px-2 py-1">{row.restDays}</td>
                  <td className="px-2 py-1">{row.blocksPerActiveCorps}</td>
                  <td className="px-2 py-1">{pct(row.pickCoverage)}</td>
                  <td className="px-2 py-1">
                    {pct(row.d1ReturnRate)}
                    {row.d1Cohort ? ` (${row.d1Cohort})` : ''}
                  </td>
                  <td className="px-2 py-1">
                    {pct(row.d7ReturnRate)}
                    {row.d7Cohort ? ` (${row.d7Cohort})` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
