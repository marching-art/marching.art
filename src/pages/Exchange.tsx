// =============================================================================
// DESIGN EXCHANGE — /exchange
// =============================================================================
// The opt-in uniform gallery (docs/UNIFORM_STUDIO.md §7.3): browse published
// designs, like them, and save-a-copy into your own wardrobe with attribution
// (creators earn a small capped CorpsCoin reward per unique save). Entries are
// world-readable pure structured data; every action goes through a callable.

import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Download, Flag, Heart, Loader2, Palette, ShieldOff, Store } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useProfileStore } from '../store/profileStore';
import UniformFigure from '../components/uniform/UniformFigure';
import DesignBriefCard from '../components/uniform/DesignBriefCard';
import ShowcaseCard from '../components/uniform/ShowcaseCard';
import {
  fetchMyLikes,
  likeExchangeDesign,
  listExchange,
  reportExchangeDesign,
  adminRemoveExchangeDesign,
  saveExchangeDesign,
  unpublishUniformDesign,
  type ExchangeEntry,
  type ExchangeSort,
} from '../api/designExchange';
import { useSEO } from '../hooks/useSEO';

const SORTS: Array<{ id: ExchangeSort; label: string }> = [
  { id: 'new', label: 'Newest' },
  { id: 'top', label: 'Most saved' },
];

function EntryCard({
  entry,
  viewerUid,
  liked,
  onLike,
  onSave,
  onReport,
  onUnpublish,
  onAdminRemove,
  isAdmin,
  busy,
}: {
  entry: ExchangeEntry;
  viewerUid: string | null;
  liked: boolean;
  onLike: (entry: ExchangeEntry, liked: boolean) => void;
  onSave: (entry: ExchangeEntry) => void;
  onReport: (entry: ExchangeEntry) => void;
  onUnpublish: (entry: ExchangeEntry) => void;
  onAdminRemove: (entry: ExchangeEntry) => void;
  isAdmin: boolean;
  busy: string | null;
}) {
  const mine = viewerUid === entry.creatorUid;
  return (
    <div className="bg-surface-card border border-line p-3 flex flex-col">
      <div className="max-w-[140px] mx-auto">
        <UniformFigure figure={entry.design.figure} label={`${entry.designName} design`} />
      </div>
      <div className="mt-2 text-center">
        <span className="block text-[11px] font-bold uppercase tracking-wider text-white truncate">
          {entry.designName}
        </span>
        <Link
          to={`/profile/${entry.creatorUid}`}
          className="block text-[10px] text-muted hover:text-interactive truncate"
        >
          by {entry.creatorName}
        </Link>
      </div>
      <div className="flex items-center justify-center gap-2 mt-2 pt-2 border-t border-line">
        <button
          type="button"
          onClick={() => onLike(entry, !liked)}
          disabled={!viewerUid || busy !== null}
          title={viewerUid ? (liked ? 'Remove like' : 'Like this design') : 'Sign in to like'}
          className={`flex items-center gap-1 px-2 py-1.5 text-[10px] font-bold border rounded-none disabled:opacity-40 ${
            liked
              ? 'border-interactive text-interactive'
              : 'border-line text-muted hover:text-white hover:border-interactive'
          }`}
        >
          <Heart className={`w-3 h-3 ${liked ? 'fill-current' : ''}`} />
          {entry.likes}
        </button>
        <button
          type="button"
          onClick={() => onSave(entry)}
          disabled={!viewerUid || busy !== null}
          title={viewerUid ? 'Save a copy to your wardrobe' : 'Sign in to save'}
          className="flex items-center gap-1 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider border border-line text-muted rounded-none hover:text-white hover:border-interactive disabled:opacity-40"
        >
          {busy === `save-${entry.id}` ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Download className="w-3 h-3" />
          )}
          Save · {entry.saves}
        </button>
        {mine ? (
          <button
            type="button"
            onClick={() => onUnpublish(entry)}
            disabled={busy !== null}
            title="Remove your design from the Exchange"
            className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider border border-line text-muted rounded-none hover:text-white hover:border-interactive disabled:opacity-40"
          >
            {busy === `unpub-${entry.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Remove'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onReport(entry)}
            disabled={!viewerUid || busy !== null}
            title="Report this entry"
            aria-label={`Report ${entry.designName}`}
            className="px-2 py-1.5 border border-line text-muted rounded-none hover:text-white hover:border-interactive disabled:opacity-40"
          >
            <Flag className="w-3 h-3" />
          </button>
        )}
        {isAdmin && !mine && (
          <button
            type="button"
            onClick={() => onAdminRemove(entry)}
            disabled={busy !== null}
            title="Admin: take this entry down"
            aria-label={`Take down ${entry.designName} (admin)`}
            className="px-2 py-1.5 border border-danger/60 text-danger rounded-none hover:bg-danger/10 disabled:opacity-40"
          >
            {busy === `admin-${entry.id}` ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <ShieldOff className="w-3 h-3" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}

export default function Exchange() {
  // Auth-walled: without `path` the canonical fell back to the homepage, and
  // without `noindex` a crawler that reached the login bounce indexed it.
  useSEO({
    title: 'Design Exchange | marching.art',
    description: 'Browse, like, and save uniform designs shared by other directors.',
    path: '/exchange',
    noindex: true,
  });
  const { user } = useAuth() || {};
  const uid = user?.uid || null;
  const isAdmin = useProfileStore((state) => state.isAdmin);

  const [sort, setSort] = useState<ExchangeSort>('new');
  const [entries, setEntries] = useState<ExchangeEntry[]>([]);
  const [likes, setLikes] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listExchange(sort);
      setEntries(list);
      if (uid && list.length > 0) {
        setLikes(
          await fetchMyLikes(
            list.map((e) => e.id),
            uid
          )
        );
      }
    } catch {
      toast.error("Couldn't load the Design Exchange.");
    } finally {
      setLoading(false);
    }
  }, [sort, uid]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const doLike = async (entry: ExchangeEntry, liked: boolean) => {
    // optimistic: flip the heart + count, revert on failure
    setLikes((prev) => {
      const next = new Set(prev);
      if (liked) next.add(entry.id);
      else next.delete(entry.id);
      return next;
    });
    setEntries((prev) =>
      prev.map((e) => (e.id === entry.id ? { ...e, likes: e.likes + (liked ? 1 : -1) } : e))
    );
    try {
      await likeExchangeDesign({ entryId: entry.id, liked });
    } catch {
      toast.error("Couldn't update your like.");
      void refresh();
    }
  };

  const doSave = async (entry: ExchangeEntry) => {
    setBusy(`save-${entry.id}`);
    try {
      const result = await saveExchangeDesign({ entryId: entry.id });
      toast.success(result.data.message);
      setEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...e, saves: e.saves + 1 } : e)));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save that design.");
    } finally {
      setBusy(null);
    }
  };

  const doReport = async (entry: ExchangeEntry) => {
    setBusy(`report-${entry.id}`);
    try {
      const result = await reportExchangeDesign({ entryId: entry.id });
      toast.success(result.data.message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send the report.");
    } finally {
      setBusy(null);
    }
  };

  const doAdminRemove = async (entry: ExchangeEntry) => {
    if (
      !window.confirm(
        `Take down "${entry.designName}" by ${entry.creatorName}? This cannot be undone.`
      )
    ) {
      return;
    }
    setBusy(`admin-${entry.id}`);
    try {
      const result = await adminRemoveExchangeDesign({ entryId: entry.id });
      toast.success(result.data.message);
      setEntries((prev) => prev.filter((e) => e.id !== entry.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't take that entry down.");
    } finally {
      setBusy(null);
    }
  };

  const doUnpublish = async (entry: ExchangeEntry) => {
    setBusy(`unpub-${entry.id}`);
    try {
      await unpublishUniformDesign({ entryId: entry.id });
      toast.success('Removed from the Exchange.');
      setEntries((prev) => prev.filter((e) => e.id !== entry.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't remove the entry.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="h-full overflow-y-auto scroll-momentum">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 pb-24">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-3 py-4 border-b border-line">
          <h1 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
            <Store className="w-4 h-4 text-interactive" />
            Design Exchange
          </h1>
          <div className="flex gap-1 ml-auto">
            {SORTS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSort(s.id)}
                className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider border rounded-none min-h-touch sm:min-h-0 ${
                  s.id === sort
                    ? 'bg-interactive border-interactive text-white'
                    : 'bg-background border-line text-muted hover:border-interactive hover:text-white'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <p className="text-xs text-muted mt-3">
          Designs shared by directors across the activity. Save a copy to remix it in your own
          wardrobe — the designer keeps the credit (and earns a little CorpsCoin).{' '}
          <Link to="/studio" className="text-interactive hover:underline">
            Publish yours from the Studio
          </Link>
          .
        </p>

        {/* The monthly contest + this week's styling challenge (§7.4) */}
        <ShowcaseCard uid={uid} />
        <DesignBriefCard uid={uid} />

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted" />
          </div>
        ) : entries.length === 0 ? (
          <div className="bg-surface-card border border-line p-8 mt-4 text-center">
            <Palette className="w-6 h-6 text-muted mx-auto mb-2" />
            <p className="text-xs text-muted">
              Nothing here yet — be the first:{' '}
              <Link to="/studio" className="text-interactive hover:underline">
                open the Studio
              </Link>{' '}
              and publish a design.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-4">
            {entries.map((entry) => (
              <EntryCard
                key={entry.id}
                entry={entry}
                viewerUid={uid}
                liked={likes.has(entry.id)}
                onLike={doLike}
                onSave={doSave}
                onReport={doReport}
                onUnpublish={doUnpublish}
                onAdminRemove={doAdminRemove}
                isAdmin={isAdmin}
                busy={busy}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
