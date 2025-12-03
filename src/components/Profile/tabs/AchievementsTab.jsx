// AchievementsTab - Achievements, trophies, and milestones
import React from 'react';
import { motion } from 'framer-motion';
import { Award, Trophy, Crown, Medal, Star, Target, CheckCircle } from 'lucide-react';
import EmptyState from '../../EmptyState';

const AchievementsTab = ({ profile, milestones }) => {
  return (
    <motion.div
      key="achievements"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      {/* Earned Achievements */}
      <div className="glass rounded-2xl p-6">
        <h2 className="text-xl font-bold text-cream-100 mb-4 flex items-center gap-2">
          <Award className="w-6 h-6 text-gold-400" />
          Earned Achievements ({profile.achievements?.length || 0})
        </h2>
        {profile.achievements && profile.achievements.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {profile.achievements.map((achievement, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.05 }}
                className="bg-charcoal-800/50 border border-gold-500/30 rounded-lg p-3 md:p-4"
              >
                <div className="flex items-start gap-2 md:gap-3">
                  <Trophy className="w-4 h-4 md:w-5 md:h-5 text-gold-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-cream-100 text-sm md:text-base">{achievement.name}</p>
                    <p className="text-xs md:text-sm text-cream-400 mt-1">{achievement.description}</p>
                    {achievement.unlockedAt && (
                      <p className="text-xs text-cream-500 mt-2">
                        {new Date(achievement.unlockedAt?.toDate?.() || achievement.unlockedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="NO ACHIEVEMENTS"
            subtitle="Keep playing to unlock achievements..."
          />
        )}
      </div>

      {/* Trophy Case */}
      {profile.trophies && (
        <div className="glass rounded-2xl p-6">
          <h2 className="text-xl font-bold text-cream-100 mb-4 flex items-center gap-2">
            <Crown className="w-6 h-6 text-gold-400" />
            Trophy Case
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-charcoal-800/50 border border-gold-500/30 rounded-lg p-4 text-center">
              <Trophy className="w-10 h-10 text-gold-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-gold-400">{profile.trophies.championships?.length || 0}</p>
              <p className="text-cream-400 text-sm">Championships</p>
            </div>
            <div className="bg-charcoal-800/50 border border-blue-500/30 rounded-lg p-4 text-center">
              <Medal className="w-10 h-10 text-blue-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-blue-400">{profile.trophies.regionals?.length || 0}</p>
              <p className="text-cream-400 text-sm">Regional Wins</p>
            </div>
            <div className="bg-charcoal-800/50 border border-purple-500/30 rounded-lg p-4 text-center">
              <Star className="w-10 h-10 text-purple-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-purple-400">{profile.trophies.finalistMedals?.length || 0}</p>
              <p className="text-cream-400 text-sm">Finalist Medals</p>
            </div>
          </div>
        </div>
      )}

      {/* All Milestones */}
      <div className="glass rounded-2xl p-6">
        <h2 className="text-xl font-bold text-cream-100 mb-4 flex items-center gap-2">
          <Target className="w-6 h-6 text-blue-400" />
          All Milestones
        </h2>
        <div className="space-y-3">
          {milestones.map((milestone, idx) => {
            const Icon = milestone.icon;
            const isComplete = milestone.current >= milestone.requirement;
            const progress = Math.min((milestone.current / milestone.requirement) * 100, 100);

            return (
              <div
                key={idx}
                className={`bg-charcoal-800/50 border rounded-lg p-4 ${
                  isComplete ? 'border-gold-500/50' : 'border-charcoal-700'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    isComplete ? 'bg-gold-500/20 text-gold-400' : 'bg-charcoal-700 text-cream-400'
                  }`}>
                    {isComplete ? <CheckCircle className="w-6 h-6" /> : <Icon className="w-6 h-6" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <p className={`font-semibold ${isComplete ? 'text-gold-400' : 'text-cream-100'}`}>
                        {milestone.name}
                      </p>
                      <p className="text-sm text-cream-400">
                        {milestone.current} / {milestone.requirement}
                      </p>
                    </div>
                    <p className="text-sm text-cream-400 mb-2">{milestone.description}</p>
                    <div className="w-full bg-charcoal-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${isComplete ? 'bg-gold-500' : 'bg-blue-500'}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
};

export default AchievementsTab;
