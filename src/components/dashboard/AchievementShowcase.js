// components/dashboard/AchievementShowcase.js
// Achievement showcase widget for displaying recent and featured achievements

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUserStore } from '../../store/userStore';
import Icon from '../ui/Icon';

// Achievement definitions with metadata
const ACHIEVEMENT_DEFINITIONS = {
  welcome_aboard: {
    id: 'welcome_aboard',
    title: 'Welcome Aboard!',
    description: 'Completed your first onboarding',
    icon: 'M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z',
    rarity: 'common',
    color: 'text-green-500',
    bgColor: 'bg-green-500/20',
    borderColor: 'border-green-500'
  },
  first_corps: {
    id: 'first_corps',
    title: 'Corps Commander',
    description: 'Created your first fantasy corps',
    icon: 'M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z',
    rarity: 'common',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/20',
    borderColor: 'border-blue-500'
  },
  first_staff_lineup: {
    id: 'first_staff_lineup',
    title: 'Staff Director',
    description: 'Hired your first Hall of Fame staff',
    icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 715.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 919.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0z',
    rarity: 'uncommon',
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/20',
    borderColor: 'border-purple-500'
  },
  rookie_director: {
    id: 'rookie_director',
    title: 'Rookie Director',
    description: 'Reached Level 5',
    icon: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z',
    rarity: 'uncommon',
    color: 'text-green-500',
    bgColor: 'bg-green-500/20',
    borderColor: 'border-green-500'
  },
  seasoned_director: {
    id: 'seasoned_director',
    title: 'Seasoned Director',
    description: 'Reached Level 10',
    icon: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z',
    rarity: 'rare',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/20',
    borderColor: 'border-blue-500'
  },
  veteran_director: {
    id: 'veteran_director',
    title: 'Veteran Director',
    description: 'Reached Level 25',
    icon: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z',
    rarity: 'epic',
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/20',
    borderColor: 'border-purple-500'
  },
  legendary_director: {
    id: 'legendary_director',
    title: 'Legendary Director',
    description: 'Reached Level 50',
    icon: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z',
    rarity: 'legendary',
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/20',
    borderColor: 'border-yellow-500'
  },
  trader: {
    id: 'trader',
    title: 'Trade Master',
    description: 'Completed your first trade',
    icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4',
    rarity: 'uncommon',
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/20',
    borderColor: 'border-orange-500'
  },
  social_butterfly: {
    id: 'social_butterfly',
    title: 'Social Butterfly',
    description: 'Joined your first league',
    icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 715.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 919.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0z',
    rarity: 'common',
    color: 'text-pink-500',
    bgColor: 'bg-pink-500/20',
    borderColor: 'border-pink-500'
  },
  week_warrior: {
    id: 'week_warrior',
    title: 'Week Warrior',
    description: 'Maintained a 7-day login streak',
    icon: 'M13 10V3L4 14h7v7l9-11h-7z',
    rarity: 'uncommon',
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/20',
    borderColor: 'border-yellow-500'
  },
  month_master: {
    id: 'month_master',
    title: 'Month Master',
    description: 'Maintained a 30-day login streak',
    icon: 'M13 10V3L4 14h7v7l9-11h-7z',
    rarity: 'rare',
    color: 'text-red-500',
    bgColor: 'bg-red-500/20',
    borderColor: 'border-red-500'
  },
  perfect_lineup: {
    id: 'perfect_lineup',
    title: 'Perfect Lineup',
    description: 'Created a complete staff lineup',
    icon: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z',
    rarity: 'rare',
    color: 'text-green-500',
    bgColor: 'bg-green-500/20',
    borderColor: 'border-green-500'
  }
};

const AchievementShowcase = ({ achievements = [] }) => {
  const { loggedInProfile } = useUserStore();
  const [selectedAchievement, setSelectedAchievement] = useState(null);
  const [showAll, setShowAll] = useState(false);

  // Enhance achievements with definitions
  const enhancedAchievements = useMemo(() => {
    return achievements.map(achievement => ({
      ...achievement,
      ...ACHIEVEMENT_DEFINITIONS[achievement.id],
      isNew: achievement.unlockedAt && 
        new Date() - new Date(achievement.unlockedAt) < 24 * 60 * 60 * 1000 // 24 hours
    })).sort((a, b) => new Date(b.unlockedAt) - new Date(a.unlockedAt));
  }, [achievements]);

  // Get featured achievements (recent + high rarity)
  const featuredAchievements = useMemo(() => {
    return enhancedAchievements.filter(achievement => 
      achievement.isNew || ['rare', 'epic', 'legendary'].includes(achievement.rarity)
    ).slice(0, 3);
  }, [enhancedAchievements]);

  const displayedAchievements = showAll ? enhancedAchievements : featuredAchievements;

  const getRarityLabel = (rarity) => {
    switch (rarity) {
      case 'common': return 'Common';
      case 'uncommon': return 'Uncommon';
      case 'rare': return 'Rare';
      case 'epic': return 'Epic';
      case 'legendary': return 'Legendary';
      default: return 'Unknown';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    });
  };

  if (enhancedAchievements.length === 0) {
    return (
      <div className="bg-surface dark:bg-surface-dark rounded-theme p-6 border border-accent dark:border-accent-dark shadow-theme">
        <h3 className="text-lg font-bold text-text-primary dark:text-text-primary-dark mb-4">
          Achievements
        </h3>
        <div className="text-center py-6 text-text-secondary dark:text-text-secondary-dark">
          <Icon path="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" 
                className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="font-medium">No achievements yet</p>
          <p className="text-sm">Start playing to unlock your first achievement!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface dark:bg-surface-dark rounded-theme p-6 border border-accent dark:border-accent-dark shadow-theme">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-text-primary dark:text-text-primary-dark">
          Achievements
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-text-secondary dark:text-text-secondary-dark">
            {enhancedAchievements.length} unlocked
          </span>
          {enhancedAchievements.length > 3 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="text-primary dark:text-primary-dark hover:text-primary/80 transition-colors text-sm font-medium"
            >
              {showAll ? 'Show Less' : 'View All'}
            </button>
          )}
        </div>
      </div>

      {/* Achievement Grid */}
      <div className="grid grid-cols-1 gap-3">
        <AnimatePresence>
          {displayedAchievements.map((achievement) => (
            <motion.div
              key={achievement.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              onClick={() => setSelectedAchievement(achievement)}
              className={`relative p-4 rounded-theme border cursor-pointer transition-all hover:shadow-md ${
                achievement.bgColor
              } ${achievement.borderColor}`}
            >
              {/* New Achievement Badge */}
              {achievement.isNew && (
                <div className="absolute -top-2 -right-2">
                  <span className="bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full animate-pulse">
                    NEW
                  </span>
                </div>
              )}

              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-full ${achievement.bgColor}`}>
                  <Icon path={achievement.icon} className={`w-6 h-6 ${achievement.color}`} />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-text-primary dark:text-text-primary-dark truncate">
                      {achievement.title}
                    </h4>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      achievement.rarity === 'legendary' ? 'bg-yellow-500/20 text-yellow-600' :
                      achievement.rarity === 'epic' ? 'bg-purple-500/20 text-purple-600' :
                      achievement.rarity === 'rare' ? 'bg-blue-500/20 text-blue-600' :
                      achievement.rarity === 'uncommon' ? 'bg-green-500/20 text-green-600' :
                      'bg-gray-500/20 text-gray-600'
                    }`}>
                      {getRarityLabel(achievement.rarity)}
                    </span>
                  </div>
                  <p className="text-sm text-text-secondary dark:text-text-secondary-dark">
                    {achievement.description}
                  </p>
                  <p className="text-xs text-text-secondary dark:text-text-secondary-dark mt-1">
                    Unlocked {formatDate(achievement.unlockedAt)}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Progress Summary */}
      {enhancedAchievements.length > 0 && (
        <div className="mt-4 pt-4 border-t border-accent dark:border-accent-dark">
          <div className="flex justify-between items-center text-sm">
            <span className="text-text-secondary dark:text-text-secondary-dark">
              Achievement Progress
            </span>
            <span className="font-medium text-text-primary dark:text-text-primary-dark">
              {enhancedAchievements.length} / {Object.keys(ACHIEVEMENT_DEFINITIONS).length}
            </span>
          </div>
          <div className="w-full bg-accent dark:bg-accent-dark rounded-full h-2 mt-2">
            <div 
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ 
                width: `${(enhancedAchievements.length / Object.keys(ACHIEVEMENT_DEFINITIONS).length) * 100}%` 
              }}
            ></div>
          </div>
        </div>
      )}

      {/* Achievement Detail Modal */}
      <AnimatePresence>
        {selectedAchievement && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedAchievement(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-surface dark:bg-surface-dark rounded-theme p-6 max-w-md w-full border border-accent dark:border-accent-dark shadow-xl"
            >
              <div className="text-center">
                <div className={`w-20 h-20 mx-auto mb-4 rounded-full ${selectedAchievement.bgColor} flex items-center justify-center`}>
                  <Icon path={selectedAchievement.icon} className={`w-10 h-10 ${selectedAchievement.color}`} />
                </div>
                
                <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-2">
                  {selectedAchievement.title}
                </h3>
                
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium mb-3 ${
                  selectedAchievement.rarity === 'legendary' ? 'bg-yellow-500/20 text-yellow-600' :
                  selectedAchievement.rarity === 'epic' ? 'bg-purple-500/20 text-purple-600' :
                  selectedAchievement.rarity === 'rare' ? 'bg-blue-500/20 text-blue-600' :
                  selectedAchievement.rarity === 'uncommon' ? 'bg-green-500/20 text-green-600' :
                  'bg-gray-500/20 text-gray-600'
                }`}>
                  {getRarityLabel(selectedAchievement.rarity)} Achievement
                </span>
                
                <p className="text-text-secondary dark:text-text-secondary-dark mb-4">
                  {selectedAchievement.description}
                </p>
                
                <div className="text-sm text-text-secondary dark:text-text-secondary-dark">
                  <p>Unlocked on {formatDate(selectedAchievement.unlockedAt)}</p>
                  {selectedAchievement.metadata && Object.keys(selectedAchievement.metadata).length > 0 && (
                    <div className="mt-2 p-2 bg-background dark:bg-background-dark rounded text-left">
                      {Object.entries(selectedAchievement.metadata).map(([key, value]) => (
                        <div key={key} className="flex justify-between">
                          <span className="capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
                          <span className="font-medium">{value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                <button
                  onClick={() => setSelectedAchievement(null)}
                  className="mt-4 bg-primary text-on-primary px-6 py-2 rounded-theme font-semibold hover:bg-primary/90 transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AchievementShowcase;