// @ts-nocheck -- grandfathered before checkJs; remove when this file is typed or cleaned up
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
import { Heading } from '../components/ui';
import { formatSeasonName } from '../utils/season';

// Records are grouped by game. The three fantasy classes are one game and rank
// against a drafted-lineup scoring model; Podium is a separate director
// simulation scored against the historical DCI envelope. Presenting them as one
// flat stack invited comparing a Podium mark to a World Class mark — different
// games, never cross-ranked — so each game gets its own labelled group.
const RECORD_GROUPS = [
  {
    id: 'fantasy',
    label: 'Fantasy',
    note: null,
    classes: [
      { key: 'worldClass', label: 'World Class' },
      { key: 'openClass', label: 'Open Class' },
      { key: 'aClass', label: 'A Class' },
    ],
  },
  {
    id: 'podium',
    label: 'Podium',
    note: 'A separate game — every point earned by running a corps, scored against real DCI history and ranked on its own.',
    classes: [{ key: 'podiumClass', label: 'Podium Class' }],
  },
];

const CATEGORIES = [
  {
    key: 'highestScore',
    label: 'Highest Single-Night Score',
    icon: Trophy,
    color: 'text-secondary',
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
            <BookOpen className="w-6 h-6 text-secondary" />
            <div>
              <Heading level="section" as="h1">
                Records Book
              </Heading>
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
          <div className="space-y-8">
            {RECORD_GROUPS.map((group) => {
              const isPodium = group.id === 'podium';
              return (
                <div key={group.id} className="space-y-3">
                  {/* Game header — names which game these records belong to, so a
                      Podium mark is never mistaken for a fantasy-comparable one. */}
                  <div>
                    <div className="flex items-center gap-2">
                      {isPodium && (
                        <Medal className="w-4 h-4 text-brand flex-shrink-0" aria-hidden="true" />
                      )}
                      <h2
                        className={`text-xs font-bold uppercase tracking-wider ${
                          isPodium ? 'text-brand' : 'text-muted'
                        }`}
                      >
                        {group.label}
                      </h2>
                    </div>
                    {group.note && (
                      <p className="text-[10px] text-muted mt-1 leading-snug">{group.note}</p>
                    )}
                  </div>

                  {group.classes.map((cls) => {
                    const classRecords = records?.classes?.[cls.key] || {};
                    return (
                      <div key={cls.key} className="bg-surface-card border border-line rounded-none">
                        <div className="flex items-center gap-2 px-4 py-3 border-b border-line-muted">
                          <span
                            className={`w-1 h-3.5 flex-shrink-0 ${isPodium ? 'bg-brand' : 'bg-interactive'}`}
                            aria-hidden="true"
                          />
                          <h3 className="text-[13px] font-bold uppercase tracking-wider text-white">
                            {cls.label}
                          </h3>
                        </div>
                        <div className="divide-y divide-line">
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
