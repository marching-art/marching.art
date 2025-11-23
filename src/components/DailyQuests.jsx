// src/components/DailyQuests.jsx
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target, Zap, Trophy, Star, Clock, Gift,
  CheckCircle, Circle, ChevronRight, X, Flame
} from 'lucide-react';
import { db } from '../firebase';
import { doc, onSnapshot, setDoc, updateDoc, getDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import Portal from './Portal';

// Quest definitions - different types of daily challenges
const QUEST_TEMPLATES = [
  {
    id: 'daily_rehearsal',
    name: 'Daily Rehearsal',
    description: 'Complete your daily rehearsal',
    icon: 'zap',
    xpReward: 50,
    coinReward: 100,
    type: 'rehearsal',
    requirement: 1
  },
  {
    id: 'check_scores',
    name: 'Score Scout',
    description: 'Check the latest scores',
    icon: 'trophy',
    xpReward: 25,
    coinReward: 50,
    type: 'scores',
    requirement: 1
  },
  {
    id: 'visit_leaderboard',
    name: 'Competitor Analysis',
    description: 'View the leaderboard',
    icon: 'target',
    xpReward: 25,
    coinReward: 50,
    type: 'leaderboard',
    requirement: 1
  },
  {
    id: 'staff_check',
    name: 'Staff Meeting',
    description: 'Visit the staff market',
    icon: 'star',
    xpReward: 25,
    coinReward: 50,
    type: 'staff',
    requirement: 1
  }
];

const getIcon = (iconName) => {
  switch (iconName) {
    case 'zap':
      return Zap;
    case 'trophy':
      return Trophy;
    case 'target':
      return Target;
    case 'star':
      return Star;
    default:
      return Target;
  }
};

const DailyQuests = ({ userId, onQuestComplete }) => {
  const [quests, setQuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [streak, setStreak] = useState(0);
  const [totalCompleted, setTotalCompleted] = useState(0);
  const generatingRef = useRef(false);

  useEffect(() => {
    if (!userId) return;

    generatingRef.current = false;
    const questsRef = doc(db, 'artifacts/marching-art/users', userId, 'dailyQuests/today');

    const unsubscribe = onSnapshot(questsRef, (docSnap) => {
      const today = new Date().toISOString().split('T')[0];

      if (docSnap.exists()) {
        const data = docSnap.data();

        // Check if quests are from today
        if (data.date === today) {
          setQuests(data.quests || []);
          setStreak(data.streak || 0);
          setTotalCompleted(data.quests?.filter(q => q.completed).length || 0);
          setLoading(false);
        } else if (!generatingRef.current) {
          // Generate new quests for today (only once)
          generatingRef.current = true;
          generateDailyQuests(userId, data.streak || 0);
        }
      } else if (!generatingRef.current) {
        // First time - generate quests (only once)
        generatingRef.current = true;
        generateDailyQuests(userId, 0);
      }
    });

    return () => unsubscribe();
  }, [userId]);

  const generateDailyQuests = async (uid, currentStreak) => {
    const today = new Date().toISOString().split('T')[0];

    // Select 3-4 random quests for today
    const shuffled = [...QUEST_TEMPLATES].sort(() => 0.5 - Math.random());
    const selectedQuests = shuffled.slice(0, 4).map(template => ({
      ...template,
      completed: false,
      progress: 0,
      claimedReward: false
    }));

    const questsRef = doc(db, 'artifacts/marching-art/users', uid, 'dailyQuests/today');

    await setDoc(questsRef, {
      date: today,
      quests: selectedQuests,
      streak: currentStreak,
      allCompleted: false
    });

    setQuests(selectedQuests);
    setStreak(currentStreak);
  };

  const completeQuest = async (questId) => {
    if (!userId) return;

    const questIndex = quests.findIndex(q => q.id === questId);
    if (questIndex === -1 || quests[questIndex].completed) return;

    const updatedQuests = [...quests];
    updatedQuests[questIndex] = {
      ...updatedQuests[questIndex],
      completed: true,
      progress: updatedQuests[questIndex].requirement
    };

    const questsRef = doc(db, 'artifacts/marching-art/users', userId, 'dailyQuests/today');
    const allComplete = updatedQuests.every(q => q.completed);

    await updateDoc(questsRef, {
      quests: updatedQuests,
      allCompleted: allComplete,
      streak: allComplete ? streak + 1 : streak
    });

    setQuests(updatedQuests);
    setTotalCompleted(updatedQuests.filter(q => q.completed).length);

    // Notify parent component
    if (onQuestComplete) {
      onQuestComplete(updatedQuests[questIndex]);
    }
  };

  const claimReward = async (questId) => {
    if (!userId) return;

    const quest = quests.find(q => q.id === questId);
    if (!quest || !quest.completed || quest.claimedReward) return;

    const updatedQuests = quests.map(q =>
      q.id === questId ? { ...q, claimedReward: true } : q
    );

    const questsRef = doc(db, 'artifacts/marching-art/users', userId, 'dailyQuests/today');
    await updateDoc(questsRef, { quests: updatedQuests });

    // Update user's XP and coins
    const profileRef = doc(db, 'artifacts/marching-art/users', userId, 'profile/data');
    const profileSnap = await getDoc(profileRef);

    if (profileSnap.exists()) {
      const profile = profileSnap.data();
      await updateDoc(profileRef, {
        xp: (profile.xp || 0) + quest.xpReward,
        corpsCoin: (profile.corpsCoin || 0) + quest.coinReward
      });
    }

    setQuests(updatedQuests);
    toast.success(`Claimed ${quest.xpReward} XP and ${quest.coinReward} CorpsCoin!`);
  };

  // Compact widget for dashboard
  const QuestWidget = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-hover cursor-pointer"
      onClick={() => setShowModal(true)}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-gold rounded-lg flex items-center justify-center">
            <Target className="w-4 h-4 text-charcoal-900" />
          </div>
          <div>
            <h3 className="font-semibold text-cream-100">Daily Quests</h3>
            <p className="text-xs text-cream-500/60">
              {totalCompleted}/{quests.length} completed
            </p>
          </div>
        </div>

        {streak > 0 && (
          <div className="flex items-center gap-1 px-2 py-1 bg-orange-500/20 rounded-full">
            <Flame className="w-3 h-3 text-orange-400" />
            <span className="text-xs font-semibold text-orange-400">{streak}</span>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 bg-charcoal-800 rounded-full overflow-hidden mb-3">
        <motion.div
          className="h-full bg-gradient-gold"
          initial={{ width: 0 }}
          animate={{ width: `${(totalCompleted / quests.length) * 100}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>

      {/* Quest previews */}
      <div className="space-y-2">
        {quests.slice(0, 2).map((quest) => {
          const Icon = getIcon(quest.icon);
          return (
            <div
              key={quest.id}
              className="flex items-center gap-2 text-sm"
            >
              {quest.completed ? (
                <CheckCircle className="w-4 h-4 text-green-400" />
              ) : (
                <Circle className="w-4 h-4 text-cream-500/40" />
              )}
              <span className={quest.completed ? 'text-cream-500/60 line-through' : 'text-cream-300'}>
                {quest.name}
              </span>
            </div>
          );
        })}
        {quests.length > 2 && (
          <p className="text-xs text-cream-500/40">
            +{quests.length - 2} more quests
          </p>
        )}
      </div>

      <div className="flex items-center justify-end mt-3 text-gold-500">
        <span className="text-xs font-medium">View All</span>
        <ChevronRight className="w-4 h-4" />
      </div>
    </motion.div>
  );

  // Full modal view
  const QuestModal = () => (
    <AnimatePresence>
      {showModal && (
        <Portal>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="glass-dark rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-gold rounded-lg flex items-center justify-center">
                    <Target className="w-5 h-5 text-charcoal-900" />
                  </div>
                  <div>
                    <h2 className="text-xl font-display font-bold text-gradient">
                      Daily Quests
                    </h2>
                    <div className="flex items-center gap-2">
                      <Clock className="w-3 h-3 text-cream-500/60" />
                      <span className="text-xs text-cream-500/60">Resets at midnight</span>
                    </div>
                  </div>
                </div>
                <button onClick={() => setShowModal(false)} className="btn-ghost p-2">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Streak display */}
              {streak > 0 && (
                <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3 mb-4">
                  <div className="flex items-center gap-2">
                    <Flame className="w-5 h-5 text-orange-400" />
                    <div>
                      <p className="font-semibold text-orange-400">{streak} Day Streak!</p>
                      <p className="text-xs text-orange-300/80">Keep completing all quests to maintain your streak</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Quest list */}
              <div className="space-y-3">
                {quests.map((quest) => {
                  const Icon = getIcon(quest.icon);
                  return (
                    <div
                      key={quest.id}
                      className={`p-4 rounded-lg border transition-all ${
                        quest.completed
                          ? 'bg-green-500/10 border-green-500/30'
                          : 'bg-charcoal-800/50 border-cream-500/20 hover:border-cream-500/40'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${
                          quest.completed ? 'bg-green-500/20' : 'bg-gold-500/20'
                        }`}>
                          <Icon className={`w-5 h-5 ${
                            quest.completed ? 'text-green-400' : 'text-gold-400'
                          }`} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h4 className="font-semibold text-cream-100">{quest.name}</h4>
                            {quest.completed && !quest.claimedReward && (
                              <button
                                onClick={() => claimReward(quest.id)}
                                className="flex items-center gap-1 px-2 py-1 bg-gold-500 hover:bg-gold-400 text-charcoal-900 rounded text-xs font-semibold transition-colors"
                              >
                                <Gift className="w-3 h-3" />
                                Claim
                              </button>
                            )}
                            {quest.claimedReward && (
                              <span className="text-xs text-green-400">Claimed</span>
                            )}
                          </div>
                          <p className="text-sm text-cream-500/60 mt-1">{quest.description}</p>
                          <div className="flex items-center gap-4 mt-2">
                            <div className="flex items-center gap-1 text-xs">
                              <Star className="w-3 h-3 text-gold-400" />
                              <span className="text-gold-400">{quest.xpReward} XP</span>
                            </div>
                            <div className="flex items-center gap-1 text-xs">
                              <span className="text-cream-400">{quest.coinReward} Coin</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bonus reward for completing all */}
              {totalCompleted === quests.length && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 p-4 bg-gradient-to-r from-gold-500/20 to-cream-500/20 border border-gold-500/30 rounded-lg text-center"
                >
                  <Trophy className="w-8 h-8 text-gold-400 mx-auto mb-2" />
                  <p className="font-semibold text-gold-400">All Quests Complete!</p>
                  <p className="text-xs text-cream-300 mt-1">Come back tomorrow for new challenges</p>
                </motion.div>
              )}
              </div>
            </motion.div>
          </motion.div>
        </Portal>
      )}
    </AnimatePresence>
  );

  if (loading) {
    return (
      <div className="card animate-pulse">
        <div className="h-4 bg-charcoal-800 rounded w-1/2 mb-4" />
        <div className="h-2 bg-charcoal-800 rounded w-full mb-3" />
        <div className="h-3 bg-charcoal-800 rounded w-3/4" />
      </div>
    );
  }

  return (
    <>
      <QuestWidget />
      <QuestModal />
    </>
  );
};

export default DailyQuests;
