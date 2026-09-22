// Admin > Content > Podium staff names. The game-wide registry of names
// directors have given their Podium staff (one row per claimed name), with
// the moderation controls: remove one name (a strike — three strikes turn
// naming off for that director automatically), revoke naming for a director
// outright, or restore it. The director is notified in-app by the backend.

import { useCallback, useEffect, useState } from 'react';
import { Ban, Loader2, RefreshCw, Search, ShieldCheck, ShieldOff, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { listPodiumStaffNames, moderatePodiumStaffName } from '../../api/admin';
import { SPECIALTY_LABELS } from '../Podium/podiumConstants';

/** @typedef {import('../../api/admin').PodiumStaffNameRow} PodiumStaffNameRow */
/** @typedef {import('../../api/admin').PodiumStaffNameModerationAction} ModerationAction */

const SPECIALTY = /** @type {Record<string, string>} */ (SPECIALTY_LABELS);

/** @param {unknown} error @param {string} fallback */
const messageOf = (error, fallback) => (error instanceof Error && error.message) || fallback;

/** @param {string | null} iso */
function claimedLabel(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * One pending action awaiting a reason + confirm: which row, which action.
 * @typedef {{ row: PodiumStaffNameRow | null, uid: string, action: ModerationAction }} Pending
 */

export default function StaffNamesModeration() {
  const [rows, setRows] = useState(/** @type {PodiumStaffNameRow[]} */ ([]));
  const [cursor, setCursor] = useState(/** @type {string | null} */ (null));
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pending, setPending] = useState(/** @type {Pending | null} */ (null));
  const [reason, setReason] = useState('');
  const [working, setWorking] = useState(false);
  const [restoreUid, setRestoreUid] = useState('');

  const load = useCallback(
    /** @param {string} q @param {string | null} after */
    async (q, after) => {
      const result = await listPodiumStaffNames({
        limit: 50,
        search: q || undefined,
        cursor: after,
      });
      return result.data;
    },
    []
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await load(query, null);
      setRows(data.names);
      setCursor(data.nextCursor);
    } catch (error) {
      toast.error(messageOf(error, 'Could not load staff names'));
    } finally {
      setLoading(false);
    }
  }, [load, query]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const loadMore = async () => {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const data = await load(query, cursor);
      setRows((prev) => [...prev, ...data.names]);
      setCursor(data.nextCursor);
    } catch (error) {
      toast.error(messageOf(error, 'Could not load more'));
    } finally {
      setLoadingMore(false);
    }
  };

  /** @param {Pending} p */
  const openPending = (p) => {
    setPending(p);
    setReason('');
  };

  const confirmPending = async () => {
    if (!pending || working) return;
    setWorking(true);
    try {
      const result = await moderatePodiumStaffName({
        uid: pending.uid,
        action: pending.action,
        ...(pending.row && pending.action === 'clear'
          ? { staffId: pending.row.staffId || undefined, key: pending.row.key }
          : {}),
        reason: reason.trim() || undefined,
      });
      const { staffNaming, cleared } = result.data;
      if (pending.action === 'clear') {
        toast.success(
          `Removed "${cleared[0]?.name || pending.row?.name}" — strike ${staffNaming.strikes}` +
            (staffNaming.revoked ? '; naming now disabled for this director' : '')
        );
      } else if (pending.action === 'revoke') {
        toast.success(
          `Naming disabled for this director` +
            (cleared.length
              ? ` (${cleared.length} name${cleared.length > 1 ? 's' : ''} removed)`
              : '')
        );
      } else {
        toast.success('Naming restored for this director');
      }
      setPending(null);
      setReason('');
      if (pending.action !== 'restore') {
        // Every name that director held is gone on a revoke; one row on a clear.
        setRows((prev) =>
          prev.filter((r) =>
            pending.action === 'revoke' ? r.uid !== pending.uid : r.key !== pending.row?.key
          )
        );
      }
    } catch (error) {
      toast.error(messageOf(error, 'Moderation failed'));
    } finally {
      setWorking(false);
    }
  };

  const restore = async () => {
    const uid = restoreUid.trim();
    if (!uid) return;
    openPending({ row: null, uid, action: 'restore' });
  };

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-muted">
        Every name a director has given a Podium staff member, newest first. Names are unique across
        the game and are released automatically when the staffer leaves. Removing a name is a
        strike; three strikes disable naming for that director. Revoking disables it at once and
        clears every name they hold.
      </p>

      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(search.trim());
        }}
      >
        <label className="relative flex-1 min-w-[180px]">
          <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search names (prefix)"
            aria-label="Search staff names"
            className="w-full bg-surface-sunken border border-line rounded-none pl-7 pr-2 py-1.5 text-xs text-white placeholder:text-muted/60 focus:border-interactive focus:outline-none"
          />
        </label>
        <button
          type="submit"
          className="px-2.5 py-1.5 border border-line text-[10px] uppercase tracking-wider text-muted hover:text-white hover:border-line-strong"
        >
          Search
        </button>
        {query && (
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setQuery('');
            }}
            className="px-2 py-1.5 border border-line text-[10px] text-muted hover:text-white"
            aria-label="Clear search"
          >
            <X className="w-3 h-3" />
          </button>
        )}
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-1 px-2.5 py-1.5 border border-line text-[10px] uppercase tracking-wider text-muted hover:text-white hover:border-line-strong disabled:opacity-40"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </form>

      {loading ? (
        <div className="flex items-center gap-2 text-[11px] text-muted py-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
        </div>
      ) : rows.length === 0 ? (
        <div className="text-[11px] text-muted py-2">
          {query ? `No staff names start with "${query}".` : 'No staff names claimed yet.'}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px]">
            <thead>
              <tr className="text-[9px] uppercase tracking-wider text-muted border-b border-line">
                <th className="py-1.5 pr-2 font-bold">Name</th>
                <th className="py-1.5 pr-2 font-bold">Corps</th>
                <th className="py-1.5 pr-2 font-bold">Role</th>
                <th className="py-1.5 pr-2 font-bold">Director</th>
                <th className="py-1.5 pr-2 font-bold">Claimed</th>
                <th className="py-1.5 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-b border-line-muted align-middle">
                  <td className="py-1.5 pr-2 font-bold text-white">{row.name || row.key}</td>
                  <td className="py-1.5 pr-2 text-secondary">{row.corpsName || '—'}</td>
                  <td className="py-1.5 pr-2 text-muted">
                    {(row.specialty && SPECIALTY[row.specialty]) || row.specialty || '—'}
                  </td>
                  <td className="py-1.5 pr-2 text-muted font-mono text-[10px]">
                    {row.uid ? <span title={row.uid}>{row.uid.slice(0, 10)}…</span> : '—'}
                  </td>
                  <td className="py-1.5 pr-2 text-muted whitespace-nowrap">
                    {claimedLabel(row.claimedAt)}
                  </td>
                  <td className="py-1.5 text-right whitespace-nowrap">
                    <button
                      type="button"
                      disabled={working}
                      onClick={() => openPending({ row, uid: row.uid || '', action: 'clear' })}
                      title="Remove this name (a strike for the director)"
                      className="inline-flex items-center gap-1 px-1.5 py-1 border border-line text-[10px] text-muted hover:text-warning hover:border-warning/60 disabled:opacity-40 mr-1"
                    >
                      <Trash2 className="w-3 h-3" /> Remove
                    </button>
                    <button
                      type="button"
                      disabled={working || !row.uid}
                      onClick={() => openPending({ row, uid: row.uid || '', action: 'revoke' })}
                      title="Disable staff naming for this director and clear every name they hold"
                      className="inline-flex items-center gap-1 px-1.5 py-1 border border-line text-[10px] text-muted hover:text-red-400 hover:border-red-400/60 disabled:opacity-40"
                    >
                      <ShieldOff className="w-3 h-3" /> Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {cursor && (
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              className="mt-2 px-2.5 py-1.5 border border-line text-[10px] uppercase tracking-wider text-muted hover:text-white disabled:opacity-40"
            >
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
          )}
        </div>
      )}

      {/* Restore naming for a director whose names are (by definition) no
          longer in the list — by uid. */}
      <form
        className="flex flex-wrap items-center gap-2 pt-2 border-t border-line"
        onSubmit={(e) => {
          e.preventDefault();
          restore();
        }}
      >
        <span className="text-[9px] font-bold uppercase tracking-wider text-muted">
          Restore naming
        </span>
        <input
          type="text"
          value={restoreUid}
          onChange={(e) => setRestoreUid(e.target.value)}
          placeholder="Director uid"
          aria-label="Director uid to restore naming for"
          className="flex-1 min-w-[180px] bg-surface-sunken border border-line rounded-none px-2 py-1.5 text-xs font-mono text-white placeholder:text-muted/60 focus:border-interactive focus:outline-none"
        />
        <button
          type="submit"
          disabled={!restoreUid.trim() || working}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-line text-[10px] uppercase tracking-wider text-muted hover:text-teal-400 hover:border-teal-400/60 disabled:opacity-40"
        >
          <ShieldCheck className="w-3 h-3" /> Restore
        </button>
      </form>

      {pending && (
        <section
          aria-label="Confirm staff name moderation"
          className="border border-line bg-surface-sunken p-3 space-y-2"
        >
          <div className="flex items-center gap-2 text-[11px] text-white font-bold">
            <Ban className="w-3.5 h-3.5 text-warning" />
            {pending.action === 'clear' && `Remove "${pending.row?.name}"?`}
            {pending.action === 'revoke' && 'Disable staff naming for this director?'}
            {pending.action === 'restore' && 'Restore staff naming for this director?'}
          </div>
          <p className="text-[10px] text-muted">
            {pending.action === 'clear' &&
              'The name is released, the staffer goes back to their role, and the director gets a strike and an in-app notice. Three strikes disable naming automatically.'}
            {pending.action === 'revoke' &&
              'Every name this director holds is released and they can no longer name staff. Their staff keep working. Reversible with Restore.'}
            {pending.action === 'restore' &&
              'They can name staff again. Their strike count stays on record.'}
            {pending.uid && (
              <span className="block font-mono text-[10px] mt-1">uid {pending.uid}</span>
            )}
          </p>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={300}
            placeholder="Reason (shown to the director, optional)"
            aria-label="Moderation reason"
            className="w-full bg-surface-card border border-line rounded-none px-2 py-1.5 text-xs text-white placeholder:text-muted/60 focus:border-interactive focus:outline-none"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={working}
              onClick={confirmPending}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 border text-[10px] uppercase tracking-wider disabled:opacity-40 ${
                pending.action === 'restore'
                  ? 'border-teal-400/60 text-teal-400 hover:bg-teal-400/10'
                  : 'border-red-400/60 text-red-400 hover:bg-red-400/10'
              }`}
            >
              {working ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              {pending.action === 'clear' && 'Remove name'}
              {pending.action === 'revoke' && 'Revoke naming'}
              {pending.action === 'restore' && 'Restore naming'}
            </button>
            <button
              type="button"
              disabled={working}
              onClick={() => setPending(null)}
              className="px-2.5 py-1.5 border border-line text-[10px] uppercase tracking-wider text-muted hover:text-white"
            >
              Cancel
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
