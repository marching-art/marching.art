// FanFavoriteCard — the community's ballot (decision 30): prelims at each
// major, finals in championship week, winner's banner at season end. Purely
// cosmetic; any signed-in user can vote, corps or not.

import React, { useEffect, useState } from 'react';
import { Heart, Loader2 } from 'lucide-react';
import { getFanFavorite, castFanFavoriteVote } from '../../api/podium';
import { usePodiumEnabled } from '../../hooks/useFeatures';

const MAJOR_NAMES = { 28: 'Southwestern', 35: 'Southeastern', 41: 'Eastern Classic' };
const DIVISION_SHORT = { aClass: 'A', openClass: 'Open', worldClass: 'World' };

export default function FanFavoriteCard() {
  const enabled = usePodiumEnabled();
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    getFanFavorite()
      .then((result) => {
        if (!cancelled) setData(result.data);
      })
      .catch(() => {
        // No ballot state (feature off / no season) — the card hides itself.
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  if (!enabled || !data || !data.stage) return null;

  const vote = async (corpsUid) => {
    setBusy(corpsUid);
    setError(null);
    try {
      await castFanFavoriteVote({ corpsUid });
      const refreshed = await getFanFavorite();
      setData(refreshed.data);
    } catch (err) {
      setError(err?.message || 'Vote failed.');
    } finally {
      setBusy(null);
    }
  };

  const title =
    data.stage === 'decided'
      ? 'Fan Favorite — decided'
      : data.stage === 'finals'
        ? 'Fan Favorite Finals — vote now'
        : `Fan Favorite — ${MAJOR_NAMES[data.major] || `Day ${data.major}`} ballot open`;

  return (
    <div className="bg-[#1a1a1a] border border-[#5a1a2e] rounded-sm p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-pink-400">
          <Heart className="w-3 h-3" /> {title}
        </span>
        {data.stage !== 'decided' && (
          <span className="text-[9px] text-gray-600">Cosmetic only — one vote per ballot</span>
        )}
      </div>

      {data.stage === 'decided' && data.winner ? (
        <div className="text-sm text-white">
          <span className="font-bold text-pink-300">{data.winner.corpsName}</span> is this
          season&apos;s Fan Favorite.
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {(data.candidates || []).map((candidate) => {
            const isMyVote = data.myVote === candidate.uid;
            return (
              <button
                key={candidate.uid}
                disabled={busy !== null}
                onClick={() => vote(candidate.uid)}
                className={`text-[10px] px-2 py-1 rounded-sm border press-feedback ${
                  isMyVote
                    ? 'border-pink-400 bg-pink-400/10 text-pink-200'
                    : 'border-[#333] text-gray-300 hover:border-pink-400/60 hover:text-white'
                }`}
              >
                {busy === candidate.uid ? (
                  <Loader2 className="w-3 h-3 animate-spin inline" />
                ) : (
                  <>
                    {isMyVote && '♥ '}
                    {candidate.corpsName || 'Unknown corps'}
                    <span className="text-gray-600">
                      {' '}
                      · {DIVISION_SHORT[candidate.division] || 'A'}
                    </span>
                  </>
                )}
              </button>
            );
          })}
          {(data.candidates || []).length === 0 && (
            <span className="text-[10px] text-gray-600">
              Candidates appear once the major&apos;s scores land.
            </span>
          )}
        </div>
      )}

      {error && <div className="text-[11px] text-red-400">{error}</div>}
    </div>
  );
}
