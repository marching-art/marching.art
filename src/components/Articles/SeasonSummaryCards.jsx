// Structured panels for the Season Summary article (Article 6): per-class
// standings compared on combined GE / Visual / Music, the rivalries taking
// shape in each class, and the SoundSport / Best-in-Show tally to date.
//
// PRIVACY: this view only ever shows COMBINED family scores (GE, Visual, Music)
// and totals — never individual captions — matching the backend contract that
// keeps directors' lineup picks private. SoundSport is ratings-only (no scores).

import { Trophy, Swords, Medal, Award } from 'lucide-react';

const fmt = (n, d = 2) => (typeof n === 'number' ? n.toFixed(d) : n);

const RATING_STYLES = {
  Gold: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10',
  Silver: 'text-gray-300 border-gray-400/30 bg-gray-400/10',
  Bronze: 'text-orange-400 border-orange-500/30 bg-orange-500/10',
  Participation: 'text-blue-300 border-blue-500/30 bg-blue-500/10',
};

const ClassStandings = ({ block }) => (
  <div className="mb-8">
    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
      <Trophy className="w-4 h-4 text-[#0057B8]" />
      {block.label} — Season Standings
    </h3>

    {/* Combined-family standings table. */}
    <div className="bg-[#111] border border-[#333] overflow-hidden">
      <div className="hidden sm:grid grid-cols-[2.5rem_1fr_5rem_repeat(3,4rem)] gap-2 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-500 border-b border-[#333]">
        <span>#</span>
        <span>Ensemble</span>
        <span className="text-right">Total</span>
        <span className="text-right">GE</span>
        <span className="text-right">Vis</span>
        <span className="text-right">Mus</span>
      </div>
      <div className="divide-y divide-[#333]/50">
        {block.standings.slice(0, 10).map((s) => (
          <div
            key={`${s.rank}-${s.corpsName}`}
            className="grid grid-cols-[2.5rem_1fr_5rem] sm:grid-cols-[2.5rem_1fr_5rem_repeat(3,4rem)] gap-2 px-4 py-3 items-center"
          >
            <span
              className={`w-7 h-7 flex items-center justify-center text-xs font-bold rounded-sm ${
                s.rank <= 3 ? 'bg-[#0057B8] text-white' : 'bg-[#222] text-gray-500'
              }`}
            >
              {s.rank}
            </span>
            <div className="min-w-0">
              <div className="text-sm text-white truncate">
                {s.namePlaceholder ? `${s.director}'s entry` : s.corpsName}
              </div>
              <div className="text-[11px] text-gray-500 truncate">
                {s.director}
                {s.showsCount ? ` · ${s.showsCount} show${s.showsCount === 1 ? '' : 's'}` : ''}
                {s.showWins > 0 ? ` · ${s.showWins} show win${s.showWins === 1 ? '' : 's'}` : ''}
              </div>
            </div>
            <span className="text-sm font-bold font-data text-white tabular-nums text-right">
              {fmt(s.latestTotal, 3)}
            </span>
            <span className="hidden sm:block text-xs font-data text-gray-300 tabular-nums text-right">
              {fmt(s.avgGE)}
            </span>
            <span className="hidden sm:block text-xs font-data text-gray-300 tabular-nums text-right">
              {fmt(s.avgVisual)}
            </span>
            <span className="hidden sm:block text-xs font-data text-gray-300 tabular-nums text-right">
              {fmt(s.avgMusic)}
            </span>
          </div>
        ))}
      </div>
    </div>
    <p className="text-[11px] text-gray-600 mt-2">
      Total is the latest score; GE / Vis / Mus are season-average combined-family scores.
    </p>

    {/* Rivalries within this class. */}
    {block.rivalries?.length > 0 && (
      <div className="mt-4 space-y-2">
        {block.rivalries.map((r, idx) => (
          <div
            key={idx}
            className="flex items-start gap-3 bg-[#0057B8]/5 border border-[#0057B8]/20 p-3"
          >
            <Swords className="w-4 h-4 text-[#0057B8] mt-0.5 shrink-0" />
            <p className="text-xs text-gray-300">
              <span className="font-bold text-white">{r.corpsA}</span> vs{' '}
              <span className="font-bold text-white">{r.corpsB}</span>
              {r.note ? ` — ${r.note}` : ''}
            </p>
          </div>
        ))}
      </div>
    )}
  </div>
);

const SeasonSummaryCards = ({ seasonSummary }) => {
  if (!seasonSummary) return null;
  const { classes = [], soundSport, showWinLeaders = [] } = seasonSummary;

  return (
    <div className="mt-8">
      {classes.map((block) => (
        <ClassStandings key={block.classKey} block={block} />
      ))}

      {/* Competitive show-win (first-place) leaders per class. */}
      {showWinLeaders.length > 0 && (
        <div className="mb-8">
          <h3 className="text-sm font-bold text-orange-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Award className="w-4 h-4" />
            Show Wins
          </h3>
          <div className="flex flex-wrap gap-2">
            {showWinLeaders.map((b, idx) => (
              <div key={idx} className="bg-[#111] border border-[#333] px-3 py-2">
                <span className="text-sm text-white">{b.corpsName}</span>
                <span className="text-xs text-gray-500 ml-2">{b.classLabel}</span>
                <span className="text-sm font-bold font-data text-orange-400 ml-2">
                  ×{b.showWins}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SoundSport — ratings only, never scores. */}
      {soundSport &&
        (soundSport.bestInShowLeaders?.length > 0 || soundSport.ratings?.length > 0) && (
          <div className="mb-8">
            <h3 className="text-sm font-bold text-purple-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Medal className="w-4 h-4" />
              SoundSport Spotlight
            </h3>

            {soundSport.ratings?.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {soundSport.ratings.map((r) => (
                  <span
                    key={r.rating}
                    className={`text-xs font-bold px-3 py-1.5 border rounded-sm ${
                      RATING_STYLES[r.rating] || 'text-gray-300 border-[#333] bg-[#111]'
                    }`}
                  >
                    {r.rating}: {r.count}
                  </span>
                ))}
              </div>
            )}

            {soundSport.bestInShowLeaders?.length > 0 && (
              <div className="space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  Best-in-Show Recognition
                </div>
                {soundSport.bestInShowLeaders.map((l, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between bg-[#111] border border-[#333] px-4 py-2.5"
                  >
                    <div>
                      <span className="text-sm text-white">{l.corpsName}</span>
                      {l.director && (
                        <span className="text-xs text-gray-500 ml-2">{l.director}</span>
                      )}
                    </div>
                    <span className="text-sm font-bold font-data text-purple-400">
                      ×{l.bestInShow}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
    </div>
  );
};

export default SeasonSummaryCards;
