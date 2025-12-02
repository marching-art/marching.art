// AchievementModal - Display achievements and newly earned achievements
import React from 'react';
import { motion } from 'framer-motion';
import { Trophy, Star, Crown, Award, Medal, Flame, Sparkles, X } from 'lucide-react';
import Portal from '../Portal';

const ICON_MAP = {
  flame: Flame,
  trophy: Trophy,
  star: Star,
  crown: Crown,
  award: Award,
  medal: Medal
};

const RARITY_COLORS = {
  legendary: 'from-purple-500 to-pink-500',
  epic: 'from-purple-500 to-blue-500',
  rare: 'from-blue-500 to-cyan-500',
  common: 'from-gray-500 to-gray-600'
};

const RARITY_BORDERS = {
  legendary: 'border-purple-500/50',
  epic: 'border-purple-400/50',
  rare: 'border-blue-400/50',
  common: 'border-gray-500/50'
};

const RARITY_BADGES = {
  legendary: 'bg-purple-500/20 text-purple-400',
  epic: 'bg-purple-400/20 text-purple-300',
  rare: 'bg-blue-400/20 text-blue-300',
  common: 'bg-gray-500/20 text-gray-400'
};

const AchievementModal = ({ onClose, achievements, newAchievement }) => {
  // Sort achievements by date, newest first
  const sortedAchievements = [...achievements].sort((a, b) =>
    new Date(b.earnedAt) - new Date(a.earnedAt)
  );

  const getIcon = (iconName) => ICON_MAP[iconName] || Award;

  return (
    <Portal>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-charcoal-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: 'spring', duration: 0.5 }}
          className="glass-premium rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto custom-scrollbar"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-gold-500 to-yellow-500 p-3 rounded-xl">
                <Trophy className="w-6 h-6 text-charcoal-900" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gradient">Your Achievements</h2>
                <p className="text-sm text-cream-500/70">
                  {achievements.length} achievement{achievements.length !== 1 ? 's' : ''} unlocked
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="btn-ghost p-2 hover:bg-cream-500/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* New Achievement Highlight */}
          {newAchievement && (
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="mb-6 p-4 rounded-xl bg-gradient-to-br from-gold-500/20 to-yellow-500/20 border-2 border-gold-500/50"
            >
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-gold-500 animate-pulse" />
                <p className="text-xs font-semibold text-gold-500 uppercase tracking-wider">
                  Just Unlocked!
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className={`bg-gradient-to-br ${RARITY_COLORS[newAchievement.rarity]} p-3 rounded-lg`}>
                  {React.createElement(getIcon(newAchievement.icon), { className: 'w-6 h-6 text-white' })}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-cream-100">{newAchievement.title}</h3>
                  <p className="text-sm text-cream-500/80">{newAchievement.description}</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Achievement Grid */}
          {sortedAchievements.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sortedAchievements.map((achievement, idx) => {
                const IconComponent = getIcon(achievement.icon);
                return (
                  <motion.div
                    key={achievement.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className={`p-4 rounded-xl bg-charcoal-800/50 border ${RARITY_BORDERS[achievement.rarity]} hover:border-opacity-100 transition-all group`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`bg-gradient-to-br ${RARITY_COLORS[achievement.rarity]} p-2.5 rounded-lg group-hover:scale-110 transition-transform`}>
                        <IconComponent className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-cream-100 text-sm">{achievement.title}</h4>
                          <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${RARITY_BADGES[achievement.rarity]}`}>
                            {achievement.rarity}
                          </span>
                        </div>
                        <p className="text-xs text-cream-500/70 mb-2">{achievement.description}</p>
                        <p className="text-[10px] text-cream-500/50">
                          Earned {new Date(achievement.earnedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <Award className="w-16 h-16 text-cream-500/30 mx-auto mb-4" />
              <p className="text-cream-500/60">No achievements yet. Keep playing to unlock them!</p>
            </div>
          )}
        </motion.div>
      </motion.div>
    </Portal>
  );
};

export default AchievementModal;
