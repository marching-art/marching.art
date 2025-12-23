// LeagueCard - Display card for a league in the browse/list view
import React from 'react';
import { motion } from 'framer-motion';
import { Users, Trophy, Lock, Crown, Check, ChevronRight } from 'lucide-react';

const LeagueCard = React.memo(({ league, isMember, onJoin, onClick, userProfile }) => {
  const memberCount = league.members?.length || 0;
  const maxMembers = league.maxMembers || 20;
  const isCommissioner = league.creatorId === userProfile?.uid;

  return (
    <motion.div
      whileHover={{ scale: isMember ? 1.01 : 1.0 }}
      className={`bg-white dark:bg-charcoal-900/50 border border-cream-300 dark:border-cream-500/20 shadow-sm hover:shadow-md transition-all rounded-xl p-6 ${isMember ? 'cursor-pointer hover:border-amber-400 dark:hover:border-gold-500' : ''}`}
      onClick={isMember ? onClick : undefined}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-xl font-bold text-charcoal-900 dark:text-cream-100">{league.name}</h3>
            {!league.isPublic && (
              <Lock className="w-4 h-4 text-slate-400 dark:text-cream-500/60" />
            )}
            {isCommissioner && (
              <Crown className="w-4 h-4 text-amber-600 dark:text-gold-500" />
            )}
          </div>
          <p className="text-sm text-slate-500 dark:text-cream-500/60 line-clamp-2">
            {league.description || 'No description provided'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="p-3 bg-cream-50 dark:bg-charcoal-900/50 rounded-lg border border-cream-200 dark:border-cream-500/10">
          <p className="text-xs text-slate-500 dark:text-cream-500/60 mb-1">Members</p>
          <div className="flex items-center gap-1">
            <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-bold text-slate-900 dark:text-cream-100">
              {memberCount}/{maxMembers}
            </span>
          </div>
        </div>
        <div className="p-3 bg-cream-50 dark:bg-charcoal-900/50 rounded-lg border border-cream-200 dark:border-cream-500/10">
          <p className="text-xs text-slate-500 dark:text-cream-500/60 mb-1">Prize Pool</p>
          <div className="flex items-center gap-1">
            <Trophy className="w-4 h-4 text-amber-600 dark:text-gold-500" />
            <span className="text-sm font-bold text-slate-900 dark:text-cream-100">
              {league.settings?.prizePool || 1000}
            </span>
          </div>
        </div>
      </div>

      {isMember ? (
        <div className="flex items-center justify-between p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
          <div className="flex items-center gap-2">
            <Check className="w-5 h-5 text-green-500" />
            <span className="text-sm font-semibold text-green-400">Member</span>
          </div>
          <ChevronRight className="w-5 h-5 text-green-400" />
        </div>
      ) : (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onJoin?.();
          }}
          disabled={memberCount >= maxMembers}
          className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {memberCount >= maxMembers ? 'League Full' : 'Join League'}
        </button>
      )}
    </motion.div>
  );
});

LeagueCard.displayName = 'LeagueCard';

export default LeagueCard;
