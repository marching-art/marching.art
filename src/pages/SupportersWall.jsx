// Public Supporters wall — recognition for Buy Me a Coffee members.
//
// Data comes from the getSupportersWall callable, which redacts emails and
// honors each supporter's anonymous opt-out server-side. Corps Angels are
// pinned at the top in gold with their optional message; other tiers follow,
// highest first. Anonymous supporters are counted but not named.

import React, { useEffect, useState } from 'react';
import { Heart, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getSupportersWall } from '../api/functions';
import { BMAC_URL, SUPPORTER_TIERS, getSupporterTier } from '../utils/supporterTiers';
import LoadingScreen from '../components/LoadingScreen';

function SupporterCard({ entry }) {
  const tier = getSupporterTier(entry.tier);
  const isAngel = entry.tier === 'corps_angel';
  return (
    <div
      className={`border p-3 rounded-none ${
        isAngel
          ? 'border-yellow-500/50 bg-yellow-500/5'
          : 'border-line bg-surface-sunken'
      }`}
    >
      <div className={`text-sm font-bold ${tier?.color || 'text-white'}`}>
        {tier?.coffees}{' '}
        {entry.uid ? (
          <Link to={`/profile/${entry.uid}`} className="hover:underline">
            {entry.displayName}
          </Link>
        ) : (
          entry.displayName
        )}
      </div>
      <div className="text-[10px] font-bold text-muted uppercase tracking-wider mt-0.5">
        {tier?.name || 'Supporter'}
      </div>
      {isAngel && entry.message && (
        <p className="text-sm text-yellow-200/90 italic mt-2">“{entry.message}”</p>
      )}
    </div>
  );
}

function SupportersWall() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ supporters: [], anonymousCount: 0 });

  useEffect(() => {
    let active = true;
    getSupportersWall()
      .then((res) => {
        if (active) setData(res.data || { supporters: [], anonymousCount: 0 });
      })
      .catch(() => {
        if (active) setData({ supporters: [], anonymousCount: 0 });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) return <LoadingScreen fullScreen />;

  const angels = data.supporters.filter((s) => s.tier === 'corps_angel');
  const rest = data.supporters.filter((s) => s.tier !== 'corps_angel');

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <header className="text-center mb-8">
        <div className="flex items-center justify-center gap-2 text-interactive mb-2">
          <Heart className="w-5 h-5" />
          <h1 className="text-2xl font-black tracking-tight">Supporters</h1>
        </div>
        <p className="text-muted text-sm max-w-lg mx-auto">
          Directors whose monthly support keeps marching.art scored, running,
          and marching year-round. Thank you.
        </p>
        <a
          href={BMAC_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-interactive/10 border border-interactive/30 text-interactive text-sm font-bold hover:bg-interactive/20 transition-all rounded-none"
        >
          <Heart className="w-4 h-4" />
          Become a supporter
          <ExternalLink className="w-3.5 h-3.5 opacity-70" />
        </a>
      </header>

      {angels.length > 0 && (
        <section className="mb-8">
          <h2 className="text-[10px] font-bold text-yellow-400 uppercase tracking-wider mb-2">
            Corps Angels
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {angels.map((s, i) => (
              <SupporterCard key={`angel-${i}`} entry={s} />
            ))}
          </div>
        </section>
      )}

      {rest.length > 0 && (
        <section>
          <h2 className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2">
            Supporters
          </h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((s, i) => (
              <SupporterCard key={`s-${i}`} entry={s} />
            ))}
          </div>
        </section>
      )}

      {data.supporters.length === 0 && (
        <div className="text-center text-muted text-sm py-12 border border-line rounded-none">
          Be the first to support marching.art.
        </div>
      )}

      {data.anonymousCount > 0 && (
        <p className="text-center text-xs text-muted mt-6">
          …and {data.anonymousCount} anonymous supporter
          {data.anonymousCount === 1 ? '' : 's'}. 💛
        </p>
      )}

      <p className="text-center text-[10px] text-muted/70 mt-8">
        Supporter perks are cosmetic recognition only — no competitive
        advantage. Tiers: {SUPPORTER_TIERS.map((t) => t.name).join(' · ')}.
      </p>
    </div>
  );
}

export default SupportersWall;
