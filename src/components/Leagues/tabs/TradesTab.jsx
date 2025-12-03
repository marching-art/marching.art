// TradesTab - Staff trading functionality within a league
import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeftRight, Plus } from 'lucide-react';
import EmptyState from '../../EmptyState';

const TradesTab = ({ league, trades, userProfile }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="card p-6"
    >
      <h2 className="text-xl md:text-2xl font-bold text-cream-100 mb-4 md:mb-6 flex items-center gap-2">
        <ArrowLeftRight className="w-5 h-5 md:w-6 md:h-6 text-blue-500" />
        Staff Trades
      </h2>

      {!league.settings?.enableStaffTrading ? (
        <EmptyState
          title="TRADING DISABLED"
          subtitle="Staff trading is disabled in this league..."
        />
      ) : (
        <div className="space-y-4">
          <button className="btn-primary">
            <Plus className="w-5 h-5 mr-2" />
            Propose Trade
          </button>

          {trades.length === 0 ? (
            <EmptyState
              title="NO TRADES"
              subtitle="No trades have been proposed yet..."
            />
          ) : (
            <div className="space-y-3">
              {trades.map(trade => (
                <div key={trade.id} className="p-4 bg-charcoal-900/50 rounded-lg border border-cream-500/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-cream-300">
                        <span className="font-semibold">Director {trade.fromUserId.slice(0, 6)}</span>
                        {' → '}
                        <span className="font-semibold">Director {trade.toUserId.slice(0, 6)}</span>
                      </p>
                      <p className="text-xs text-cream-500/60 mt-1">
                        {new Date(trade.createdAt?.toDate()).toLocaleDateString()}
                      </p>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      trade.status === 'pending'
                        ? 'bg-yellow-500/20 text-yellow-400'
                        : trade.status === 'accepted'
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {trade.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};

export default TradesTab;
