// AchievementsTab - Achievements, trophies, and milestones (Stadium HUD)
import React from 'react';
import { m } from 'framer-motion';
import { Award, Trophy, Crown, Medal, Star, Target, CheckCircle } from 'lucide-react';
import { ConsoleEmptyState } from '../../ui/CommandConsole';

// =============================================================================
// MEMOIZED LIST ITEM COMPONENTS
// =============================================================================

const AchievementItem = React.memo(({ achievement, idx }) => (
  <m.div
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ delay: idx * 0.05 }}
    className="bg-black/30 border border-yellow-500/20 rounded-sm p-3 md:p-4 shadow-[0_0_15px_rgba(234,179,8,0.1)]"
  >
    <div className="flex items-start gap-2 md:gap-3">
      <Trophy className="w-4 h-4 md:w-5 md:h-5 text-yellow-400 flex-shrink-0 mt-0.5 drop-shadow-[0_0_6px_rgba(234,179,8,0.5)]" />
      <div>
        <p className="font-display font-semibold text-yellow-50 text-sm md:text-base">{achievement.name}</p>
        <p className="text-xs md:text-sm text-yellow-50/70 mt-1">{achievement.description}</p>
        {achievement.unlockedAt && (
          <p className="text-xs text-yellow-50/40 mt-2">
            {new Date(achievement.unlockedAt?.toDate?.() || achievement.unlockedAt).toLocaleDateString()}
          </p>
        )}
      </div>
    </div>
  </m.div>
));
AchievementItem.displayName = 'AchievementItem';

const MilestoneItem = React.memo(({ milestone, idx }) => {
  const Icon = milestone.icon;
  const isComplete = milestone.current >= milestone.requirement;
  const progress = Math.min((milestone.current / milestone.requirement) * 100, 100);

  return (
    <div
      className={`bg-black/30 border rounded-sm p-4 ${
        isComplete ? 'border-yellow-500/30 shadow-[0_0_15px_rgba(234,179,8,0.15)]' : 'border-white/5'
      }`}
    >
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-sm flex items-center justify-center flex-shrink-0 ${
          isComplete ? 'bg-yellow-500/20 text-yellow-400' : 'bg-black/40 text-yellow-50/60'
        }`}>
          {isComplete ? <CheckCircle className="w-6 h-6 drop-shadow-[0_0_6px_rgba(234,179,8,0.5)]" /> : <Icon className="w-6 h-6" />}
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <p className={`font-display font-semibold ${isComplete ? 'text-yellow-400' : 'text-yellow-50'}`}>
              {milestone.name}
            </p>
            <p className="text-sm text-yellow-50/70">
              {milestone.current} / {milestone.requirement}
            </p>
          </div>
          <p className="text-sm text-yellow-50/70 mb-2">{milestone.description}</p>
          <div className="w-full bg-black/50 rounded-sm h-2">
            <div
              className={`h-2 rounded-sm transition-all ${isComplete ? 'bg-gradient-to-r from-yellow-500 to-yellow-400 shadow-[0_0_8px_rgba(234,179,8,0.5)]' : 'bg-blue-500'}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
});
MilestoneItem.displayName = 'MilestoneItem';

const AchievementsTab = ({ profile, milestones }) => {
  return (
    <m.div
      key="achievements"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      {/* Earned Achievements */}
      <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-sm p-6">
        <h2 className="text-xl font-display font-bold text-yellow-50 mb-4 flex items-center gap-2">
          <Award className="w-6 h-6 text-yellow-400 drop-shadow-[0_0_6px_rgba(234,179,8,0.5)]" />
          Earned Achievements ({profile.achievements?.length || 0})
        </h2>
        {profile.achievements && profile.achievements.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {profile.achievements.map((achievement, idx) => (
              <AchievementItem key={achievement.id || idx} achievement={achievement} idx={idx} />
            ))}
          </div>
        ) : (
          <ConsoleEmptyState
            variant="shield"
            title="NO ACHIEVEMENTS UNLOCKED"
            subtitle="Mission objectives pending. Continue operations to unlock commendations."
          />
        )}
      </div>

      {/* Trophy Case */}
      {profile.trophies && (
        <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-sm p-6">
          <h2 className="text-xl font-display font-bold text-yellow-50 mb-4 flex items-center gap-2">
            <Crown className="w-6 h-6 text-yellow-400 drop-shadow-[0_0_6px_rgba(234,179,8,0.5)]" />
            Trophy Case
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-black/30 border border-yellow-500/20 rounded-sm p-4 text-center shadow-[0_0_20px_rgba(234,179,8,0.1)]">
              <Trophy className="w-10 h-10 text-yellow-400 mx-auto mb-2 drop-shadow-[0_0_10px_rgba(234,179,8,0.5)]" />
              <p className="text-2xl font-display font-bold text-yellow-400 drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]">{profile.trophies.championships?.length || 0}</p>
              <p className="text-yellow-50/60 text-sm font-display">Championships</p>
            </div>
            <div className="bg-black/30 border border-blue-500/20 rounded-sm p-4 text-center shadow-[0_0_20px_rgba(59,130,246,0.1)]">
              <Medal className="w-10 h-10 text-blue-400 mx-auto mb-2 drop-shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
              <p className="text-2xl font-display font-bold text-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]">{profile.trophies.regionals?.length || 0}</p>
              <p className="text-yellow-50/60 text-sm font-display">Regional Wins</p>
            </div>
            <div className="bg-black/30 border border-purple-500/20 rounded-sm p-4 text-center shadow-[0_0_20px_rgba(168,85,247,0.1)]">
              <Star className="w-10 h-10 text-purple-400 mx-auto mb-2 drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]" />
              <p className="text-2xl font-display font-bold text-purple-400 drop-shadow-[0_0_8px_rgba(168,85,247,0.5)]">{profile.trophies.finalistMedals?.length || 0}</p>
              <p className="text-yellow-50/60 text-sm font-display">Finalist Medals</p>
            </div>
          </div>
        </div>
      )}

      {/* All Milestones */}
      <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-sm p-6">
        <h2 className="text-xl font-display font-bold text-yellow-50 mb-4 flex items-center gap-2">
          <Target className="w-6 h-6 text-blue-400 drop-shadow-[0_0_6px_rgba(59,130,246,0.5)]" />
          All Milestones
        </h2>
        <div className="space-y-3">
          {milestones.map((milestone, idx) => (
            <MilestoneItem key={milestone.id || idx} milestone={milestone} idx={idx} />
          ))}
        </div>
      </div>
    </m.div>
  );
};

export default AchievementsTab;
