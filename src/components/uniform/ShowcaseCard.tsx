// =============================================================================
// SHOWCASE CARD — the monthly contest, on the Exchange page
// =============================================================================
// Phase-aware: submissions (enter a saved design against the theme), voting
// (anonymous head-to-head pairs, click a look to pick it), and last month's
// podium. The server deals every pair and scores every vote — this card
// never sees who designed what until results are final.

import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Crown, Loader2, Swords, Trophy } from 'lucide-react';
import {
  castShowcaseVote,
  getShowcase,
  getShowcasePair,
  submitShowcaseEntry,
  type ShowcaseCycle,
  type ShowcaseDesign,
  type ShowcaseResults,
} from '../../api/showcase';
import { listWardrobe, type WardrobeDesign } from '../../api/uniformStudio';
import UniformFigure from './UniformFigure';
import { friendlyCallableError } from '../../utils/callableErrors';

function ResultsPodium({ results }: { results: ShowcaseResults }) {
  const medals = ['🥇', '🥈', '🥉'];
  return (
    <div>
      <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted mb-2 flex items-center gap-1.5">
        <Trophy className="w-3 h-3 text-brand" />
        Last month — “{results.theme.title}”
      </h4>
      <div className="grid grid-cols-3 gap-2">
        {results.winners.map((winner, i) => (
          <div key={winner.uid} className="bg-background border border-line p-2 text-center">
            {winner.design ? (
              <div className="max-w-[72px] mx-auto">
                <UniformFigure
                  figure={winner.design.figure}
                  label={`${winner.designName} design`}
                />
              </div>
            ) : null}
            <span className="block text-[10px] font-bold text-white truncate mt-1">
              {medals[i] || winner.rank} {winner.designName}
            </span>
            <Link
              to={`/profile/${winner.uid}`}
              className="block text-[9px] text-muted hover:text-interactive truncate"
            >
              {winner.username}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ShowcaseCard({ uid }: { uid: string | null }) {
  const [cycle, setCycle] = useState<ShowcaseCycle | null>(null);
  const [entryCount, setEntryCount] = useState(0);
  const [myEntry, setMyEntry] = useState<{ designName: string } | null>(null);
  const [myVoteCount, setMyVoteCount] = useState(0);
  const [lastResults, setLastResults] = useState<ShowcaseResults | null>(null);
  const [wardrobe, setWardrobe] = useState<WardrobeDesign[]>([]);
  const [pick, setPick] = useState('');
  const [pair, setPair] = useState<Array<{ key: 'a' | 'b'; design: ShowcaseDesign }> | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!uid) return;
    try {
      const [res, designs] = await Promise.all([getShowcase({}), listWardrobe(uid)]);
      setCycle(res.data.cycle);
      setEntryCount(res.data.entryCount);
      setMyEntry(res.data.myEntry);
      setMyVoteCount(res.data.myVoteCount);
      setLastResults(res.data.lastResults);
      setWardrobe(designs);
      setPick((prev) => prev || designs[0]?.id || '');
    } catch {
      // non-fatal: the card just doesn't render this visit
    }
  }, [uid]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!cycle) return null;

  const doEnter = async () => {
    if (!pick) return;
    setBusy('enter');
    try {
      const res = await submitShowcaseEntry({ designId: pick });
      toast.success(res.data.message);
      setMyEntry({ designName: wardrobe.find((w) => w.id === pick)?.name || 'Your design' });
      if (res.data.paid) setEntryCount((n) => n + 1);
    } catch (err) {
      toast.error(friendlyCallableError(err, "Couldn't enter the Showcase."));
    } finally {
      setBusy(null);
    }
  };

  const dealPair = async () => {
    setBusy('deal');
    try {
      const res = await getShowcasePair({});
      setPair(res.data.pair);
    } catch (err) {
      toast.error(friendlyCallableError(err, "Couldn't deal a ballot."));
    } finally {
      setBusy(null);
    }
  };

  const doVote = async (key: 'a' | 'b') => {
    setBusy(`vote-${key}`);
    try {
      const res = await castShowcaseVote({ pick: key });
      toast.success(res.data.message);
      setMyVoteCount(res.data.voteCount);
      setPair(null);
      void dealPair(); // straight into the next head-to-head
    } catch (err) {
      toast.error(friendlyCallableError(err, "Couldn't record that vote."));
      setPair(null);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="bg-surface-card border border-line p-4 mt-4">
      <div className="flex flex-wrap items-baseline gap-2 border-b border-line pb-2">
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-white flex items-center gap-2">
          <Crown className="w-3.5 h-3.5 text-brand" />
          The Showcase
        </h2>
        <span className="text-[10px] uppercase tracking-wider text-muted">{cycle.monthId}</span>
        <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-interactive">
          {cycle.phase === 'submissions'
            ? `Submissions open · voting from the ${cycle.votingOpensDay}st`
            : 'Voting open'}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
        <div>
          <h3 className="text-sm font-bold text-white">“{cycle.theme.title}”</h3>
          <p className="text-xs text-muted mt-1">{cycle.theme.blurb}</p>
          <p className="text-[11px] text-muted mt-2">
            {entryCount} {entryCount === 1 ? 'entry' : 'entries'} this month
            {myEntry ? (
              <>
                {' · yours: '}
                <span className="text-white font-bold">{myEntry.designName}</span>
              </>
            ) : null}
          </p>

          {cycle.phase === 'submissions' ? (
            wardrobe.length > 0 ? (
              <div className="flex gap-2 mt-3">
                <select
                  value={pick}
                  onChange={(e) => setPick(e.target.value)}
                  aria-label="Design to enter"
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
                  onClick={() => void doEnter()}
                  disabled={busy !== null || !pick}
                  className="px-3 py-2 bg-interactive text-white text-[11px] font-bold uppercase tracking-wider hover:bg-interactive-hover disabled:opacity-40 flex items-center gap-1.5"
                >
                  {busy === 'enter' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  {myEntry ? 'Swap entry' : 'Enter'}
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
            )
          ) : (
            <p className="text-[10px] text-muted mt-3">
              Anonymous head-to-heads — no names until the crowning. Ballots cast: {myVoteCount}.
              The champion wears the grant-only Showcase Champion title.
            </p>
          )}
        </div>

        <div>
          {cycle.phase === 'voting' ? (
            pair ? (
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted mb-2 flex items-center gap-1.5">
                  <Swords className="w-3 h-3 text-interactive" />
                  Which look takes the field?
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {pair.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => void doVote(item.key)}
                      disabled={busy !== null}
                      aria-label={`Vote for design ${item.key.toUpperCase()}`}
                      className="bg-background border border-line hover:border-interactive p-2 disabled:opacity-40"
                    >
                      <div className="max-w-[104px] mx-auto">
                        <UniformFigure
                          figure={item.design.figure}
                          label={`Anonymous design ${item.key.toUpperCase()}`}
                        />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => void dealPair()}
                disabled={busy !== null}
                className="w-full h-10 px-3 bg-interactive text-white text-[11px] font-bold uppercase tracking-wider hover:bg-interactive-hover disabled:opacity-40 flex items-center justify-center gap-1.5"
              >
                {busy === 'deal' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                Judge a pair
              </button>
            )
          ) : lastResults ? (
            <ResultsPodium results={lastResults} />
          ) : (
            <p className="text-[11px] text-muted">
              Voting opens on the {cycle.votingOpensDay}st — the whole community judges anonymous
              head-to-heads, and your first ballots each month pay CorpsCoin.
            </p>
          )}
        </div>
      </div>

      {cycle.phase === 'voting' && lastResults ? (
        <div className="mt-3 pt-3 border-t border-line">
          <ResultsPodium results={lastResults} />
        </div>
      ) : null}
    </div>
  );
}
