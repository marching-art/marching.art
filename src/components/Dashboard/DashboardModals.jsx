// src/components/Dashboard/DashboardModals.jsx
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Lock, Sparkles, X, Trash2, Archive, Check,
  Trophy, Star, Crown, Award, Medal, Flame
} from 'lucide-react';
import Portal from '../Portal';

// Class Unlock Congratulations Modal Component
export const ClassUnlockCongratsModal = ({ unlockedClass, onSetup, onDecline, xpLevel }) => {
  const getClassInfo = (classId) => {
    const classInfo = {
      aClass: {
        name: 'A Class',
        description: 'Intermediate level corps with higher point limits and more competitive shows',
        icon: '🎺',
        color: 'from-blue-500 to-blue-600',
        requiredLevel: 3
      },
      open: {
        name: 'Open Class',
        description: 'Advanced level corps with expanded opportunities and prestigious competitions',
        icon: '🎖️',
        color: 'from-purple-500 to-purple-600',
        requiredLevel: 5
      },
      world: {
        name: 'World Class',
        description: 'Elite level corps competing at the highest tier of drum corps activity',
        icon: '👑',
        color: 'from-gold-500 to-gold-600',
        requiredLevel: 10
      }
    };
    return classInfo[classId] || classInfo.aClass;
  };

  const classInfo = getClassInfo(unlockedClass);

  return (
    <Portal>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0, y: 50 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0, y: 50 }}
          transition={{ type: 'spring', duration: 0.5 }}
          className="w-full max-w-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="glass-premium rounded-2xl p-8 border-2 border-gold-500/30 relative overflow-hidden">
            {/* Animated background gradient */}
            <div className={`absolute inset-0 bg-gradient-to-br ${classInfo.color} opacity-10 animate-pulse`} />

          <div className="relative z-10">
            {/* Celebration icon */}
            <div className="text-center mb-6">
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                className="text-7xl mb-4"
              >
                {classInfo.icon}
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <h2 className="text-4xl font-display font-bold text-gradient mb-2">
                  Congratulations!
                </h2>
                <p className="text-xl text-cream-100 font-semibold">
                  You've reached Level {xpLevel}!
                </p>
              </motion.div>
            </div>

            {/* Class unlock info */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="glass-dark rounded-xl p-6 mb-6"
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${classInfo.color} flex items-center justify-center`}>
                    <Lock className="w-6 h-6 text-white" />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-display font-bold text-cream-100 mb-2">
                    {classInfo.name} Unlocked!
                  </h3>
                  <p className="text-cream-300 text-sm leading-relaxed">
                    {classInfo.description}
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Call to action */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="space-y-3"
            >
              <p className="text-center text-cream-300 mb-4">
                Would you like to register a corps for {classInfo.name} now?
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={onDecline}
                  className="btn-ghost flex-1"
                >
                  Maybe Later
                </button>
                <button
                  onClick={onSetup}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-5 h-5" />
                  Register Corps
                </button>
              </div>
            </motion.div>
          </div>
        </div>
        </motion.div>
      </motion.div>
    </Portal>
  );
};

// Corps Registration Modal Component
export const CorpsRegistrationModal = ({ onClose, onSubmit, unlockedClasses, defaultClass }) => {
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    showConcept: '',
    class: defaultClass || 'soundSport'
  });

  // Classes in hierarchy order: World → Open → A → SoundSport
  const classes = [
    {
      id: 'world',
      name: 'World Class',
      description: 'Elite - Requires Level 10',
      unlocked: unlockedClasses.includes('world'),
      color: 'bg-gold-500'
    },
    {
      id: 'open',
      name: 'Open Class',
      description: 'Advanced - Requires Level 5',
      unlocked: unlockedClasses.includes('open'),
      color: 'bg-purple-500'
    },
    {
      id: 'aClass',
      name: 'A Class',
      description: 'Intermediate - Requires Level 3',
      unlocked: unlockedClasses.includes('aClass'),
      color: 'bg-blue-500'
    },
    {
      id: 'soundSport',
      name: 'SoundSport',
      description: 'Entry level - Perfect for beginners',
      unlocked: true,
      color: 'bg-green-500'
    }
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Portal>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="w-full max-w-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="glass-dark rounded-2xl p-8">
            <h2 className="text-3xl font-display font-bold text-gradient mb-6">
              Register Your Corps
            </h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Corps Name */}
            <div>
              <label className="label">Corps Name</label>
              <input
                type="text"
                className="input"
                placeholder="Enter your corps name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                maxLength={50}
              />
            </div>

            {/* Location */}
            <div>
              <label className="label">Home Location</label>
              <input
                type="text"
                className="input"
                placeholder="City, State"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                required
                maxLength={50}
              />
            </div>

            {/* Show Concept */}
            <div>
              <label className="label">Show Concept</label>
              <textarea
                className="textarea h-24"
                placeholder="Describe your show concept for this season..."
                value={formData.showConcept}
                onChange={(e) => setFormData({ ...formData, showConcept: e.target.value })}
                required
                maxLength={500}
              />
              <p className="text-xs text-cream-500/40 mt-1">
                {formData.showConcept.length}/500 characters
              </p>
            </div>

            {/* Class Selection */}
            <div>
              <label className="label">Competition Class</label>
              <div className="grid grid-cols-2 gap-3">
                {classes.map((cls) => (
                  <button
                    key={cls.id}
                    type="button"
                    className={`
                      relative p-4 rounded-lg border-2 transition-all duration-300
                      ${formData.class === cls.id
                        ? 'border-gold-500 bg-gold-500/10'
                        : 'border-cream-500/20 hover:border-cream-500/40'
                      }
                      ${!cls.unlocked ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                    onClick={() => cls.unlocked && setFormData({ ...formData, class: cls.id })}
                    disabled={!cls.unlocked}
                  >
                    {!cls.unlocked && (
                      <div className="absolute top-2 right-2">
                        <Lock className="w-4 h-4 text-cream-500/40" />
                      </div>
                    )}
                    {cls.unlocked && formData.class === cls.id && (
                      <div className="absolute top-2 right-2">
                        <Check className="w-4 h-4 text-gold-500" />
                      </div>
                    )}
                    <div className={`w-2 h-2 ${cls.color} rounded-full mb-2`} />
                    <p className="font-semibold text-cream-100">{cls.name}</p>
                    <p className="text-xs text-cream-500/60 mt-1">{cls.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="btn-ghost flex-1"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary flex-1"
              >
                Register Corps
              </button>
            </div>
          </form>
          </div>
        </motion.div>
      </motion.div>
    </Portal>
  );
};

// Edit Corps Modal Component
export const EditCorpsModal = ({ onClose, onSubmit, currentData }) => {
  const [formData, setFormData] = useState({
    name: currentData.name || '',
    location: currentData.location || '',
    showConcept: currentData.showConcept || ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Portal>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="w-full max-w-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="glass-dark rounded-2xl p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-3xl font-display font-bold text-gradient">
                Edit Corps Details
              </h2>
            <button onClick={onClose} className="btn-ghost p-2">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Corps Name */}
            <div>
              <label className="label">Corps Name</label>
              <input
                type="text"
                className="input"
                placeholder="Enter your corps name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                maxLength={50}
              />
            </div>

            {/* Location */}
            <div>
              <label className="label">Home Location</label>
              <input
                type="text"
                className="input"
                placeholder="City, State"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                required
                maxLength={50}
              />
            </div>

            {/* Show Concept */}
            <div>
              <label className="label">Show Concept</label>
              <textarea
                className="textarea h-24"
                placeholder="Describe your show concept for this season..."
                value={formData.showConcept}
                onChange={(e) => setFormData({ ...formData, showConcept: e.target.value })}
                required
                maxLength={500}
              />
              <p className="text-xs text-cream-500/40 mt-1">
                {formData.showConcept.length}/500 characters
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="btn-ghost flex-1"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary flex-1"
              >
                Save Changes
              </button>
            </div>
          </form>
          </div>
        </motion.div>
      </motion.div>
    </Portal>
  );
};

// Helper function for class names
const getCorpsClassName = (classId) => {
  const classNames = {
    soundSport: 'SoundSport',
    aClass: 'A Class',
    open: 'Open Class',
    world: 'World Class'
  };
  return classNames[classId] || classId;
};

// Delete Confirmation Modal Component
export const DeleteConfirmModal = ({ onClose, onConfirm, corpsName, corpsClass }) => {
  return (
    <Portal>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="glass-dark rounded-2xl p-8 border-2 border-red-500/30">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-2xl font-display font-bold text-cream-100 mb-2">
              Delete Corps?
            </h2>
            <p className="text-cream-300">
              This action cannot be undone
            </p>
          </div>

          <div className="glass-premium rounded-xl p-4 mb-6">
            <p className="text-sm text-cream-500/60 mb-1">You are about to delete:</p>
            <p className="text-lg font-semibold text-cream-100">{corpsName}</p>
            <p className="text-sm text-cream-500/60 mt-1">{getCorpsClassName(corpsClass)}</p>
          </div>

          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
            <p className="text-sm text-red-300">
              All data for this corps will be permanently deleted, including:
            </p>
            <ul className="text-sm text-red-300/80 mt-2 space-y-1 ml-4">
              <li>• Caption lineup</li>
              <li>• Show selections</li>
              <li>• Equipment and staff</li>
              <li>• Performance history</li>
            </ul>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={onClose}
              className="btn-outline flex-1"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold transition-colors"
            >
              Delete Corps
            </button>
          </div>
        </div>
        </motion.div>
      </motion.div>
    </Portal>
  );
};

// Retire Confirmation Modal Component
export const RetireConfirmModal = ({ onClose, onConfirm, corpsName, corpsClass, retiring }) => {
  return (
    <Portal>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="glass-dark rounded-2xl p-8 border-2 border-orange-500/30">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Archive className="w-8 h-8 text-orange-500" />
            </div>
            <h2 className="text-2xl font-display font-bold text-cream-100 mb-2">
              Retire Corps?
            </h2>
            <p className="text-cream-300">
              Honor the legacy of your corps
            </p>
          </div>

          <div className="glass-premium rounded-xl p-4 mb-6">
            <p className="text-sm text-cream-500/60 mb-1">You are about to retire:</p>
            <p className="text-lg font-semibold text-cream-100">{corpsName}</p>
            <p className="text-sm text-cream-500/60 mt-1">{getCorpsClassName(corpsClass)}</p>
          </div>

          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-300">
              Your corps will be moved to the Retired Corps Gallery:
            </p>
            <ul className="text-sm text-blue-300/80 mt-2 space-y-1 ml-4">
              <li>• All season history preserved</li>
              <li>• Lifetime stats maintained</li>
              <li>• Can be brought out of retirement anytime</li>
              <li>• Current season data will be reset</li>
            </ul>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={onClose}
              disabled={retiring}
              className="btn-outline flex-1 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={retiring}
              className="flex-1 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {retiring ? (
                <>
                  <Archive className="w-4 h-4 animate-pulse" />
                  Retiring...
                </>
              ) : (
                'Retire Corps'
              )}
            </button>
          </div>
        </div>
        </motion.div>
      </motion.div>
    </Portal>
  );
};

// Move Corps Modal Component
export const MoveCorpsModal = ({ onClose, onMove, currentClass, corpsName, unlockedClasses, existingCorps }) => {
  const [selectedClass, setSelectedClass] = useState('');

  const getClassColor = (classId) => {
    const colors = {
      soundSport: 'from-green-500 to-green-600',
      aClass: 'from-blue-500 to-blue-600',
      open: 'from-purple-500 to-purple-600',
      world: 'from-gold-500 to-gold-600'
    };
    return colors[classId] || 'from-cream-500 to-cream-600';
  };

  const availableClasses = [
    { id: 'soundSport', name: 'SoundSport', level: 'Entry' },
    { id: 'aClass', name: 'A Class', level: 'Intermediate' },
    { id: 'open', name: 'Open Class', level: 'Advanced' },
    { id: 'world', name: 'World Class', level: 'Elite' }
  ].filter(cls =>
    cls.id !== currentClass && // Not current class
    unlockedClasses.includes(cls.id) && // User has unlocked it
    !existingCorps[cls.id] // No corps already in that class
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    if (selectedClass) {
      onMove(selectedClass);
    }
  };

  return (
    <Portal>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="w-full max-w-md"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="glass-dark rounded-2xl p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-display font-bold text-gradient">
                Move Corps
              </h2>
            <button onClick={onClose} className="btn-ghost p-2">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="glass-premium rounded-xl p-4 mb-6">
            <p className="text-sm text-cream-500/60 mb-1">Moving:</p>
            <p className="text-lg font-semibold text-cream-100">{corpsName}</p>
            <p className="text-sm text-cream-500/60 mt-1">
              From: <span className="text-cream-300">{getCorpsClassName(currentClass)}</span>
            </p>
          </div>

          {availableClasses.length === 0 ? (
            <div className="text-center py-8">
              <Lock className="w-12 h-12 text-cream-500/40 mx-auto mb-3" />
              <p className="text-cream-500/60 mb-2">No classes available</p>
              <p className="text-sm text-cream-500/40">
                Either you haven't unlocked other classes, or you already have a corps in each available class.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Select Target Class</label>
                <div className="space-y-2">
                  {availableClasses.map((cls) => (
                    <button
                      key={cls.id}
                      type="button"
                      onClick={() => setSelectedClass(cls.id)}
                      className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                        selectedClass === cls.id
                          ? 'border-gold-500 bg-gold-500/10'
                          : 'border-cream-500/20 hover:border-cream-500/40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-cream-100">{cls.name}</p>
                          <p className="text-sm text-cream-500/60">{cls.level}</p>
                        </div>
                        {selectedClass === cls.id && (
                          <Check className="w-5 h-5 text-gold-500" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <p className="text-sm text-blue-300">
                  <strong>Note:</strong> Moving your corps will preserve all data including lineup, shows, equipment, and staff.
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-ghost flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedClass}
                  className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Move Corps
                </button>
              </div>
            </form>
          )}
          </div>
        </motion.div>
      </motion.div>
    </Portal>
  );
};

// Achievement Modal Component
export const AchievementModal = ({ onClose, achievements, newAchievement }) => {
  const getRarityColor = (rarity) => {
    switch (rarity) {
      case 'legendary':
        return 'from-purple-500 to-pink-500';
      case 'epic':
        return 'from-purple-500 to-blue-500';
      case 'rare':
        return 'from-blue-500 to-cyan-500';
      default:
        return 'from-gray-500 to-gray-600';
    }
  };

  const getRarityBorder = (rarity) => {
    switch (rarity) {
      case 'legendary':
        return 'border-purple-500/50';
      case 'epic':
        return 'border-purple-400/50';
      case 'rare':
        return 'border-blue-400/50';
      default:
        return 'border-gray-500/50';
    }
  };

  const getIcon = (iconName) => {
    switch (iconName) {
      case 'flame':
        return Flame;
      case 'trophy':
        return Trophy;
      case 'star':
        return Star;
      case 'crown':
        return Crown;
      case 'award':
        return Award;
      case 'medal':
        return Medal;
      default:
        return Award;
    }
  };

  // Sort achievements by date, newest first
  const sortedAchievements = [...achievements].sort((a, b) =>
    new Date(b.earnedAt) - new Date(a.earnedAt)
  );

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
              <div className={`bg-gradient-to-br ${getRarityColor(newAchievement.rarity)} p-3 rounded-lg`}>
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
                  className={`p-4 rounded-xl bg-charcoal-800/50 border ${getRarityBorder(achievement.rarity)} hover:border-opacity-100 transition-all group`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`bg-gradient-to-br ${getRarityColor(achievement.rarity)} p-2.5 rounded-lg group-hover:scale-110 transition-transform`}>
                      <IconComponent className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-cream-100 text-sm">{achievement.title}</h4>
                        <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          achievement.rarity === 'legendary' ? 'bg-purple-500/20 text-purple-400' :
                          achievement.rarity === 'epic' ? 'bg-purple-400/20 text-purple-300' :
                          achievement.rarity === 'rare' ? 'bg-blue-400/20 text-blue-300' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
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
