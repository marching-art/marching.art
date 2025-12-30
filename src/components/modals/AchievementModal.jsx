// =============================================================================
// ACHIEVEMENT MODAL - ESPN DATA STYLE
// =============================================================================

import React from 'react';
import { Trophy, Star, Crown, Award, Medal, Flame, X } from 'lucide-react';
import Portal from '../Portal';
import { useEscapeKey } from '../../hooks/useEscapeKey';

const ICON_MAP = {
  flame: Flame,
  trophy: Trophy,
  star: Star,
  crown: Crown,
  award: Award,
  medal: Medal,
};

const RARITY_STYLES = {
  legendary: { bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-400', badge: 'bg-purple-500/20 text-purple-400' },
  epic: { bg: 'bg-purple-400/10', border: 'border-purple-400/30', text: 'text-purple-300', badge: 'bg-purple-400/20 text-purple-300' },
  rare: { bg: 'bg-[#0057B8]/10', border: 'border-[#0057B8]/30', text: 'text-[#0057B8]', badge: 'bg-[#0057B8]/20 text-[#0057B8]' },
  common: { bg: 'bg-gray-500/10', border: 'border-gray-500/30', text: 'text-gray-400', badge: 'bg-gray-500/20 text-gray-400' },
};

const AchievementModal = ({ onClose, achievements, newAchievement }) => {
  // Close on Escape key
  useEscapeKey(onClose);

  const sortedAchievements = [...achievements].sort((a, b) =>
    new Date(b.earnedAt) - new Date(a.earnedAt)
  );

  const getIcon = (iconName) => ICON_MAP[iconName] || Award;

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title-achievement"
      >
        <div
          className="w-full max-w-2xl max-h-[80vh] bg-[#1a1a1a] border border-[#333] rounded-sm shadow-2xl flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#333] bg-[#222] flex-shrink-0">
            <div className="flex items-center gap-3">
              <Trophy className="w-5 h-5 text-yellow-500" />
              <div>
                <h2 id="modal-title-achievement" className="text-xs font-bold uppercase tracking-wider text-gray-300">Your Achievements</h2>
                <p className="text-[10px] text-gray-500">
                  {achievements.length} achievement{achievements.length !== 1 ? 's' : ''} unlocked
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-1 text-gray-500 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-4 overflow-y-auto flex-1">
            {/* New Achievement Highlight */}
            {newAchievement && (
              <div className="mb-4 p-4 bg-yellow-500/10 border border-yellow-500/30">
                <div className="flex items-center gap-2 mb-2">
                  <Star className="w-4 h-4 text-yellow-500" />
                  <p className="text-[10px] font-bold text-yellow-500 uppercase tracking-wider">
                    Just Unlocked!
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 flex items-center justify-center ${RARITY_STYLES[newAchievement.rarity]?.bg || 'bg-gray-500/10'} border ${RARITY_STYLES[newAchievement.rarity]?.border || 'border-gray-500/30'}`}>
                    {React.createElement(getIcon(newAchievement.icon), { className: `w-5 h-5 ${RARITY_STYLES[newAchievement.rarity]?.text || 'text-gray-400'}` })}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">{newAchievement.title}</h3>
                    <p className="text-xs text-gray-400">{newAchievement.description}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Achievement Grid */}
            {sortedAchievements.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {sortedAchievements.map((achievement) => {
                  const IconComponent = getIcon(achievement.icon);
                  const styles = RARITY_STYLES[achievement.rarity] || RARITY_STYLES.common;
                  return (
                    <div
                      key={achievement.id}
                      className={`p-3 bg-[#0a0a0a] border ${styles.border} hover:bg-white/5 transition-colors`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 flex items-center justify-center ${styles.bg} border ${styles.border} flex-shrink-0`}>
                          <IconComponent className={`w-4 h-4 ${styles.text}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-bold text-white text-sm truncate">{achievement.title}</h4>
                            <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 ${styles.badge}`}>
                              {achievement.rarity}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mb-1">{achievement.description}</p>
                          <p className="text-[10px] text-gray-600 font-data">
                            {new Date(achievement.earnedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <Award className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-sm text-gray-500">No achievements yet.</p>
                <p className="text-xs text-gray-600">Keep playing to unlock them!</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-[#333] bg-[#222] flex justify-end flex-shrink-0">
            <button
              onClick={onClose}
              className="h-9 px-4 bg-[#0057B8] text-white text-sm font-bold uppercase tracking-wider hover:bg-[#0066d6]"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
};

export default AchievementModal;
