// components/dashboard/DailyChallenge.js
// Daily challenge widget for user engagement

import React, { useState, useEffect } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useUserStore } from '../../store/userStore';
import Icon from '../ui/Icon';
import toast from 'react-hot-toast';

const DailyChallenge = () => {
  const { user, updateUserExperience } = useUserStore();
  const [challenge, setChallenge] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCompleting, setIsCompleting] = useState(false);

  useEffect(() => {
    fetchDailyChallenge();
  }, [user]);

  const fetchDailyChallenge = async () => {
    if (!user) return;

    try {
      const functions = getFunctions();
      const getDailyChallenge = httpsCallable(functions, 'getDailyChallenge');
      const result = await getDailyChallenge();
      setChallenge(result.data.challenge);
    } catch (error) {
      console.error('Error fetching daily challenge:', error);
      // Fallback to mock challenge
      setChallenge({
        id: 'login_streak',
        title: 'Daily Login Streak',
        description: 'Log in to the game daily',
        progress: 1,
        target: 1,
        reward: { experience: 10, points: 5 },
        difficulty: 'easy',
        completed: true
      });
    } finally {
      setIsLoading(false);
    }
  };

  const claimReward = async () => {
    if (!challenge?.completed || challenge.claimed) return;

    setIsCompleting(true);
    try {
      await updateUserExperience(challenge.reward.experience, 'Daily challenge completion');
      setChallenge(prev => ({ ...prev, claimed: true }));
      toast.success(`Challenge completed! +${challenge.reward.experience} XP`);
    } catch (error) {
      console.error('Error claiming reward:', error);
      toast.error('Failed to claim reward');
    } finally {
      setIsCompleting(false);
    }
  };

  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case 'easy': return 'bg-green-500/20 text-green-500';
      case 'medium': return 'bg-yellow-500/20 text-yellow-500';
      case 'hard': return 'bg-red-500/20 text-red-500';
      default: return 'bg-gray-500/20 text-gray-500';
    }
  };

  if (isLoading) {
    return (
      <div className="bg-surface dark:bg-surface-dark rounded-theme p-6 border border-accent dark:border-accent-dark shadow-theme">
        <div className="animate-pulse">
          <div className="h-4 bg-accent rounded w-3/4 mb-4"></div>
          <div className="h-3 bg-accent rounded w-1/2 mb-2"></div>
          <div className="h-2 bg-accent rounded w-full"></div>
        </div>
      </div>
    );
  }

  if (!challenge) {
    return (
      <div className="bg-surface dark:bg-surface-dark rounded-theme p-6 border border-accent dark:border-accent-dark shadow-theme">
        <div className="text-center text-text-secondary dark:text-text-secondary-dark">
          <Icon path="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No challenge available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface dark:bg-surface-dark rounded-theme p-6 border border-accent dark:border-accent-dark shadow-theme">
      <div className="flex items-center gap-2 mb-4">
        <Icon path="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" className="w-5 h-5 text-yellow-500" />
        <h3 className="text-lg font-bold text-text-primary dark:text-text-primary-dark">
          Daily Challenge
        </h3>
      </div>

      <div className="space-y-4">
        <div>
          <h4 className="font-semibold text-text-primary dark:text-text-primary-dark">
            {challenge.title}
          </h4>
          <p className="text-sm text-text-secondary dark:text-text-secondary-dark">
            {challenge.description}
          </p>
        </div>

        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-text-secondary dark:text-text-secondary-dark">Progress</span>
            <span className="text-text-primary dark:text-text-primary-dark">
              {challenge.progress}/{challenge.target}
            </span>
          </div>
          <div className="w-full bg-accent dark:bg-accent-dark rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all duration-300 ${
                challenge.completed ? 'bg-green-500' : 'bg-yellow-500'
              }`}
              style={{ width: `${Math.min(100, (challenge.progress / challenge.target) * 100)}%` }}
            ></div>
          </div>
        </div>

        <div className="flex justify-between items-center">
          <div className="text-sm">
            <span className="text-text-secondary dark:text-text-secondary-dark">Reward: </span>
            <span className="text-yellow-500 font-semibold">{challenge.reward.experience} XP</span>
          </div>
          <span className={`px-2 py-1 rounded text-xs font-semibold ${getDifficultyColor(challenge.difficulty)}`}>
            {challenge.difficulty}
          </span>
        </div>

        {challenge.completed && !challenge.claimed && (
          <button
            onClick={claimReward}
            disabled={isCompleting}
            className="w-full bg-green-500 text-white py-2 rounded-theme font-semibold hover:bg-green-600 transition-colors disabled:opacity-50"
          >
            {isCompleting ? 'Claiming...' : 'Claim Reward'}
          </button>
        )}

        {challenge.completed && challenge.claimed && (
          <div className="w-full bg-green-500/20 text-green-500 py-2 rounded-theme font-semibold text-center">
            Completed!
          </div>
        )}

        {!challenge.completed && (
          <div className="text-xs text-text-secondary dark:text-text-secondary-dark text-center">
            Complete this challenge to earn XP and unlock achievements
          </div>
        )}
      </div>
    </div>
  );
};

export default DailyChallenge;