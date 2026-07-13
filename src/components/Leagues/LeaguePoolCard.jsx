// LeaguePoolCard — the league's daily prediction pool (the flagship social
// CorpsCoin sink, LIFELONG_GAMIFICATION_ROADMAP.md Step 6). Members buy in
// for a fixed ante; entrants who post a perfect prediction day split the pot
// when the nightly run settles it, otherwise the pot carries to the next
// pool. Zero-sum and escrowed — every coin paid out was staked by a member.

import React, { memo, useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { Coins, Users, Trophy, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { db, paths } from '../../api/client';
import { joinLeaguePool } from '../../api/functions';
import { getGameDay } from '../../utils/dailyChallenges';

// Mirrors POOL_ANTE in functions/src/helpers/leaguePools.js — the server
// validates the real amount; this only drives display.
const POOL_ANTE = 25;

const LeaguePoolCard = memo(({ league, userProfile }) => {
  const [pool, setPool] = useState(null);
  const [joining, setJoining] = useState(false);
  const gameDay = getGameDay();

  useEffect(() => {
    if (!league?.id) return undefined;
    const ref = doc(db, paths.leaguePool(league.id, gameDay));
    return onSnapshot(
      ref,
      (snap) => setPool(snap.exists() ? snap.data() : null),
      () => setPool(null)
    );
  }, [league?.id, gameDay]);

  const entrantCount = Object.keys(pool?.entrants || {}).length;
  const isIn = !!pool?.entrants?.[userProfile?.uid];
  const resolved = !!pool?.resolved;
  // Before anyone buys in, the visible pot is the carried-over amount the
  // first buy-in will fold in.
  const carry = league?.poolCarry || 0;
  const pot = pool ? pool.pot || 0 : carry;
  const winners = pool?.winners || [];

  const handleJoin = async () => {
    setJoining(true);
    try {
      const result = await joinLeaguePool({ leagueId: league.id });
      if (result.data.success && !result.data.alreadyIn) {
        toast.success(`You're in — the pot is ${result.data.pot} CC`);
      }
    } catch (error) {
      toast.error(error.message || 'Could not join the pool');
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="bg-surface-card border border-line overflow-hidden">
      <div className="bg-surface-raised px-4 py-3 border-b border-line flex items-center justify-between">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted flex items-center gap-2">
          <Coins className="w-3.5 h-3.5 text-brand" />
          Daily Prediction Pool
        </h3>
        <span className="text-[10px] text-muted flex items-center gap-1 font-data tabular-nums">
          <Users className="w-3 h-3" />
          {entrantCount} in
        </span>
      </div>

      <div className="p-4 flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-2xl font-bold text-brand font-data tabular-nums">
            {pot.toLocaleString()} <span className="text-sm">CC</span>
          </p>
          <p className="text-[10px] text-muted">
            {resolved
              ? winners.length > 0
                ? `Settled — ${winners.length} perfect day${winners.length > 1 ? 's' : ''} split the pot`
                : 'No perfect day — the pot carries over'
              : 'A perfect prediction day splits the pot; no winner rolls it over'}
          </p>
        </div>

        {resolved ? (
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Settled</span>
        ) : isIn ? (
          <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
            <Trophy className="w-3.5 h-3.5" />
            You&apos;re in
          </span>
        ) : (
          <button
            onClick={handleJoin}
            disabled={joining}
            className="h-9 px-4 text-xs font-bold uppercase tracking-wider bg-interactive hover:bg-interactive-hover disabled:bg-line text-white transition-colors press-feedback flex items-center gap-1.5"
          >
            {joining ? '...' : `Buy in · ${POOL_ANTE} CC`}
            {!joining && <ArrowRight className="w-3 h-3" />}
          </button>
        )}
      </div>
    </div>
  );
});

LeaguePoolCard.displayName = 'LeaguePoolCard';

export default LeaguePoolCard;
