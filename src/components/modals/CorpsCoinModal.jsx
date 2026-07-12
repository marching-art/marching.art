// =============================================================================
// CORPSCOIN WALLET MODAL - balance, transaction history, and earning guide
// =============================================================================
// Backed by the getCorpsCoinHistory / getEarningOpportunities callables
// (economy.js). History lives in the corpsCoinHistory subcollection written by
// every server-side coin transaction.

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Coins, TrendingUp, TrendingDown, X } from 'lucide-react';
import Portal from '../Portal';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { getCorpsCoinHistory, getEarningOpportunities } from '../../api/functions';

// Callable results serialize Firestore Timestamps to {_seconds,...}
const toDate = (ts) => {
  if (!ts) return null;
  if (typeof ts === 'string') return new Date(ts);
  if (typeof ts._seconds === 'number') return new Date(ts._seconds * 1000);
  if (typeof ts.seconds === 'number') return new Date(ts.seconds * 1000);
  return null;
};

const CLASS_REWARD_LABELS = {
  soundSport: 'SoundSport',
  aClass: 'A Class',
  openClass: 'Open Class',
  worldClass: 'World Class',
};

const CorpsCoinModal = ({ onClose }) => {
  useEscapeKey(onClose);

  const [tab, setTab] = useState('history');
  const [balance, setBalance] = useState(null);
  const [history, setHistory] = useState([]);
  const [earning, setEarning] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getCorpsCoinHistory({ limit: 30 }), getEarningOpportunities()])
      .then(([historyResult, earningResult]) => {
        if (cancelled) return;
        setBalance(historyResult.data.balance);
        setHistory(historyResult.data.history || []);
        setEarning(earningResult.data);
      })
      .catch(() => {
        // Balance still shows from the profile elsewhere; keep the modal usable
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title-corpscoin"
      >
        <div
          className="w-full max-w-lg max-h-[80dvh] bg-surface-card border border-line rounded-none flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-line bg-surface-raised flex-shrink-0">
            <div className="flex items-center gap-3">
              <Coins className="w-5 h-5 text-yellow-500" />
              <div>
                <h2
                  id="modal-title-corpscoin"
                  className="text-xs font-bold uppercase tracking-wider text-secondary"
                >
                  CorpsCoin Wallet
                </h2>
                {balance != null && (
                  <p className="text-sm font-bold text-yellow-500 font-data tabular-nums">
                    {balance.toLocaleString()} CC
                  </p>
                )}
              </div>
            </div>
            <button onClick={onClose} className="p-1 text-muted hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-line flex-shrink-0">
            {[
              { id: 'history', label: 'History' },
              { id: 'earn', label: 'How to Earn' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                  tab === t.id
                    ? 'text-white border-b-2 border-interactive bg-white/5'
                    : 'text-muted hover:text-secondary'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Body */}
          <div className="p-4 overflow-y-auto flex-1">
            {loading ? (
              <div className="py-8 text-center text-sm text-muted">Loading wallet...</div>
            ) : tab === 'history' ? (
              history.length > 0 ? (
                <div className="space-y-1">
                  {history.map((txn) => {
                    const date = toDate(txn.timestamp);
                    const positive = txn.amount >= 0;
                    return (
                      <div
                        key={txn.id}
                        className="flex items-center gap-3 p-2 bg-background border border-line-muted"
                      >
                        {positive ? (
                          <TrendingUp className="w-4 h-4 text-green-500 flex-shrink-0" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-red-400 flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-secondary truncate">{txn.description}</p>
                          {date && (
                            <p className="text-[10px] text-muted font-data">
                              {date.toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        <span
                          className={`text-xs font-bold font-data tabular-nums flex-shrink-0 ${positive ? 'text-green-500' : 'text-red-400'}`}
                        >
                          {positive ? '+' : ''}
                          {txn.amount.toLocaleString()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-10">
                  <Coins className="w-10 h-10 text-muted mx-auto mb-3" />
                  <p className="text-sm text-muted">No transactions yet.</p>
                  <p className="text-xs text-muted">
                    Register for shows and check the earning guide to get started.
                  </p>
                </div>
              )
            ) : (
              <div className="space-y-3">
                {earning?.opportunities &&
                  Object.entries(earning.opportunities).map(([key, opp]) => (
                    <div key={key} className="p-3 bg-background border border-line">
                      <p className="text-sm font-bold text-white">{opp.title}</p>
                      <p className="text-xs text-muted mb-1">{opp.description}</p>
                      {opp.reward != null && (
                        <p className="text-xs text-yellow-500 font-data">+{opp.reward} CC</p>
                      )}
                      {opp.rewards && (
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                          {Object.entries(opp.rewards)
                            // The backend table carries legacy aliases (open/world);
                            // show only the canonical class keys
                            .filter(([k]) => CLASS_REWARD_LABELS[k] || !isNaN(Number(k)))
                            .map(([k, v]) => (
                              <span key={k} className="text-xs text-yellow-500 font-data">
                                {CLASS_REWARD_LABELS[k] ||
                                  (k === '1'
                                    ? 'Champion'
                                    : k === '2'
                                      ? '2nd'
                                      : k === '3'
                                        ? '3rd'
                                        : k)}
                                : +{v}
                              </span>
                            ))}
                        </div>
                      )}
                    </div>
                  ))}
                {earning?.spending && (
                  <>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted pt-2">
                      Ways to Spend
                    </p>
                    {Object.entries(earning.spending).map(([key, opt]) => (
                      <div key={key} className="p-3 bg-background border border-line">
                        <p className="text-sm font-bold text-white">{opt.title}</p>
                        <p className="text-xs text-muted">{opt.description}</p>
                        {opt.costs && (
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                            {Object.entries(opt.costs)
                              .filter(([k]) => CLASS_REWARD_LABELS[k])
                              .map(([k, v]) => (
                                <span key={k} className="text-xs text-yellow-500 font-data">
                                  {CLASS_REWARD_LABELS[k]}: {v.toLocaleString()}
                                </span>
                              ))}
                          </div>
                        )}
                      </div>
                    ))}
                    <div className="p-3 bg-background border border-line">
                      <p className="text-sm font-bold text-white">Streak Freeze</p>
                      <p className="text-xs text-muted">
                        Protect your login streak for 24 hours — 300 CC from the streak panel.
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-line bg-surface-sunken flex items-center justify-between flex-shrink-0">
            <Link
              to="/shop"
              onClick={onClose}
              className="text-xs font-bold text-yellow-500 hover:text-yellow-400 uppercase tracking-wider"
            >
              Visit the Shop →
            </Link>
            <button
              onClick={onClose}
              className="h-9 px-4 bg-interactive text-white text-sm font-bold uppercase tracking-wider hover:bg-interactive-hover"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
};

export default CorpsCoinModal;
