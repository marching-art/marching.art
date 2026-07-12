// =============================================================================
// RECORDS - All-time Records Book
// =============================================================================
// Reads the public game-records/records doc maintained by the nightly scoring
// run and season archival (functions/src/helpers/gameRecords.js). The endgame
// scoreboard: best single-night marks and season totals, with holder names.

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Trophy, Music, Eye, Sparkles, Medal, Crown } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../api';
import { formatSeasonName } from '../utils/season';

const RECORD_CLASSES = [
  { key: 'worldClass', label: 'World Class' },
  { key: 'openClass', label: 'Open Class' },
  { key: 'aClass', label: 'A Class' },
  { key: 'podiumClass', label: 'Podium Class' },
];

const CATEGORIES = [
  {
    key: 'highestScore',
    label: 'Highest Single-Night Score',
    icon: Trophy,
    color: 'text-yellow-500',
  },
  { key: 'highestGE', label: 'Best General Effect', icon: Sparkles, color: 'text-purple-400' },
  { key: 'highestVisual', label: 'Best Visual', icon: Eye, color: 'text-cyan-400' },
  { key: 'highestMusic', label: 'Best Music', icon: Music, color: 'text-green-400' },
  { key: 'bestSeason', label: 'Best Season Total', icon: Crown, color: 'text-orange-400' },
];

const RecordRow = ({ category, record }) => {
  const Icon = category.icon;
  return (
    <div className="px-4 py-3 flex items-center gap-3">
      <Icon className={`w-4 h-4 flex-shrink-0 ${category.color}`} />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted">{category.label}</p>
        {record ? (
          <p className="text-sm text-white truncate">
            <span className="font-bold">{record.corpsName || 'Unknown Corps'}</span>
            {record.displayName && <span className="text-muted"> — {record.displayName}</span>}
          </p>
        ) : (
          <p className="text-sm text-muted">Unclaimed — make history</p>
        )}
        {record && (
          <p className="text-[10px] text-muted">
            {formatSeasonName(record.seasonName)}
            {record.day ? ` · Day ${record.day}` : ''}
          </p>
        )}
      </div>
      {record && (
        <span className="text-lg font-bold text-white font-data tabular-nums flex-shrink-0">
          {record.value.toFixed(3)}
        </span>
      )}
    </div>
  );
};

const Records = () => {
  const [records, setRecords] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDoc(doc(db, 'game-records', 'records'))
      .then((snapshot) => setRecords(snapshot.exists() ? snapshot.data() : null))
      .catch(() => setRecords(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    // GameShell's <main> is fixed with overflow-hidden, so each page must own
    // its scroll container. Without this wrapper the records list is clipped
    // and can't scroll (notably on mobile, where the list runs long).
    <div className="h-full overflow-y-auto scroll-momentum">
      <div className="max-w-4xl mx-auto px-4 py-6 pb-24 md:pb-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <BookOpen className="w-6 h-6 text-yellow-500" />
            <div>
              <h1 className="text-lg font-bold text-white uppercase tracking-wider">
                Records Book
              </h1>
              <p className="text-xs text-muted">
                All-time marks across every season. Records update after each night's scoring.
              </p>
            </div>
          </div>
          <Link
            to="/hall-of-champions"
            className="flex items-center gap-1 text-[10px] font-bold text-interactive hover:text-interactive-hover uppercase tracking-wider whitespace-nowrap"
          >
            <Medal className="w-3 h-3" />
            Hall of Champions →
          </Link>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-muted">Opening the record books...</div>
        ) : (
          <div className="space-y-6">
            {RECORD_CLASSES.map((cls) => {
              const classRecords = records?.classes?.[cls.key] || {};
              return (
                <div key={cls.key} className="bg-surface-card border border-line rounded-none">
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-line-muted">
                    <span className="w-1 h-3.5 bg-[#c9a227] flex-shrink-0" aria-hidden="true" />
                    <h2 className="text-[13px] font-bold uppercase tracking-wider text-white">
                      {cls.label}
                    </h2>
                  </div>
                  <div className="divide-y divide-[#242424]">
                    {CATEGORIES.map((category) => (
                      <RecordRow
                        key={category.key}
                        category={category}
                        record={classRecords[category.key] || null}
                      />
                    ))}
                  </div>
                </div>
              );
            })}

            <p className="text-[10px] text-muted text-center">
              SoundSport competes for medals, not records — its corps march for the love of it.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Records;
