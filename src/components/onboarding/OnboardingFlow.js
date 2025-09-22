import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUserStore } from '../../store/userStore';
import { doc, updateDoc } from 'firebase/firestore';
import { db, dataNamespace } from '../../firebase';
import Icon from '../ui/Icon';
import toast from 'react-hot-toast';

const OnboardingFlow = ({ onComplete, onSkip }) => {
  const { user, loggedInProfile, updateProfile } = useUserStore();
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    username: '',
    displayName: '',
    favoriteCorps: '',
    experience: '',
    goals: [],
    notifications: true
  });
  const [isLoading, setIsLoading] = useState(false);

  const steps = [
    {
      id: 'welcome',
      title: 'Welcome to marching.art! 🎺',
      subtitle: 'The ultimate fantasy drum corps experience',
      component: WelcomeStep
    },
    {
      id: 'profile',
      title: 'Create Your Director Profile',
      subtitle: 'Let everyone know who you are',
      component: ProfileStep
    },
    {
      id: 'preferences',
      title: 'Customize Your Experience',
      subtitle: 'Tell us about your drum corps preferences',
      component: PreferencesStep
    },
    {
      id: 'goals',
      title: 'Set Your Goals',
      subtitle: 'What do you want to achieve this season?',
      component: GoalsStep
    },
    {
      id: 'complete',
      title: 'You\'re All Set! 🏆',
      subtitle: 'Ready to build your championship corps?',
      component: CompleteStep
    }
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    onSkip();
  };

  const handleComplete = async () => {
    setIsLoading(true);
    try {
      // Update profile with onboarding data
      await updateProfile({
        ...formData,
        hasCompletedOnboarding: true,
        onboardingCompletedAt: new Date(),
        level: 1,
        experience: 100, // Starting experience
        totalPoints: 0
      });

      // Grant welcome achievement
      const achievementRef = doc(db, `user-achievements/${user.uid}/achievements/welcome_aboard`);
      await setDoc(achievementRef, {
        unlockedAt: new Date(),
        seen: false
      });

      toast.success('🎉 Welcome to marching.art! You earned your first achievement!');
      onComplete();
    } catch (error) {
      console.error('Error completing onboarding:', error);
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const updateFormData = (updates) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const currentStepData = steps[currentStep];
  const StepComponent = currentStepData.component;

  return (
    <div className="fixed inset-0 bg-background dark:bg-background-dark z-50 overflow-y-auto">
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-2xl w-full">
          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex justify-between mb-2">
              <span className="text-sm text-text-secondary dark:text-text-secondary-dark">
                Step {currentStep + 1} of {steps.length}
              </span>
              <span className="text-sm text-text-secondary dark:text-text-secondary-dark">
                {Math.round(((currentStep + 1) / steps.length) * 100)}%
              </span>
            </div>
            <div className="w-full bg-accent dark:bg-accent-dark rounded-full h-2">
              <motion.div
                className="bg-primary h-2 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>

          {/* Step Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="bg-surface dark:bg-surface-dark rounded-theme p-8 shadow-xl border border-accent dark:border-accent-dark"
            >
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark mb-2">
                  {currentStepData.title}
                </h2>
                <p className="text-text-secondary dark:text-text-secondary-dark">
                  {currentStepData.subtitle}
                </p>
              </div>

              <StepComponent
                formData={formData}
                updateFormData={updateFormData}
                onNext={handleNext}
                onBack={handleBack}
                onSkip={handleSkip}
                onComplete={handleComplete}
                isLoading={isLoading}
                isFirstStep={currentStep === 0}
                isLastStep={currentStep === steps.length - 1}
              />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

// Welcome Step Component
const WelcomeStep = ({ onNext, onSkip, isLoading }) => (
  <div className="text-center space-y-6">
    <div className="text-6xl mb-4">🎺</div>
    <div className="space-y-4">
      <p className="text-lg text-text-secondary dark:text-text-secondary-dark">
        Build your dream drum corps from legendary performers across DCI history!
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
        <div className="p-4 bg-primary/10 rounded-theme">
          <div className="text-2xl mb-2">🏆</div>
          <div className="font-semibold text-text-primary dark:text-text-primary-dark">Compete</div>
          <div className="text-text-secondary dark:text-text-secondary-dark">Join leagues and climb leaderboards</div>
        </div>
        <div className="p-4 bg-primary/10 rounded-theme">
          <div className="text-2xl mb-2">📊</div>
          <div className="font-semibold text-text-primary dark:text-text-primary-dark">Strategy</div>
          <div className="text-text-secondary dark:text-text-secondary-dark">Draft smart, trade wisely</div>
        </div>
        <div className="p-4 bg-primary/10 rounded-theme">
          <div className="text-2xl mb-2">🎯</div>
          <div className="font-semibold text-text-primary dark:text-text-primary-dark">Achieve</div>
          <div className="text-text-secondary dark:text-text-secondary-dark">Unlock achievements and rewards</div>
        </div>
      </div>
    </div>
    <div className="flex justify-between pt-6">
      <button onClick={onSkip} className="text-text-secondary dark:text-text-secondary-dark hover:text-primary">
        Skip setup
      </button>
      <button
        onClick={onNext}
        disabled={isLoading}
        className="bg-primary text-on-primary px-6 py-2 rounded-theme font-semibold hover:bg-primary/90 transition-colors"
      >
        Let's Get Started
      </button>
    </div>
  </div>
);

// Profile Step Component
const ProfileStep = ({ formData, updateFormData, onNext, onBack, isLoading }) => {
  const [usernameAvailable, setUsernameAvailable] = useState(null);
  const [checkingUsername, setCheckingUsername] = useState(false);

  const checkUsernameAvailability = async (username) => {
    if (username.length < 3) return;
    
    setCheckingUsername(true);
    try {
      const usernameRef = doc(db, `usernames/${username.toLowerCase()}`);
      const usernameSnap = await getDoc(usernameRef);
      setUsernameAvailable(!usernameSnap.exists());
    } catch (error) {
      console.error('Error checking username:', error);
    } finally {
      setCheckingUsername(false);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (formData.username) {
        checkUsernameAvailability(formData.username);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [formData.username]);

  const canProceed = formData.username.length >= 3 && formData.displayName.length >= 2 && usernameAvailable;

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
            Username *
          </label>
          <div className="relative">
            <input
              type="text"
              value={formData.username}
              onChange={(e) => updateFormData({ username: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') })}
              placeholder="Your unique username"
              className="w-full p-3 border border-accent dark:border-accent-dark rounded-theme bg-background dark:bg-background-dark text-text-primary dark:text-text-primary-dark focus:ring-2 focus:ring-primary focus:border-primary"
              maxLength={20}
            />
            {checkingUsername && (
              <div className="absolute right-3 top-3">
                <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full"></div>
              </div>
            )}
          </div>
          {formData.username.length >= 3 && !checkingUsername && (
            <p className={`text-sm mt-1 ${usernameAvailable ? 'text-green-500' : 'text-red-500'}`}>
              {usernameAvailable ? '✓ Username available' : '✗ Username taken'}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
            Display Name *
          </label>
          <input
            type="text"
            value={formData.displayName}
            onChange={(e) => updateFormData({ displayName: e.target.value })}
            placeholder="How you want to be known"
            className="w-full p-3 border border-accent dark:border-accent-dark rounded-theme bg-background dark:bg-background-dark text-text-primary dark:text-text-primary-dark focus:ring-2 focus:ring-primary focus:border-primary"
            maxLength={30}
          />
        </div>
      </div>

      <div className="flex justify-between pt-6">
        <button onClick={onBack} className="text-text-secondary dark:text-text-secondary-dark hover:text-primary">
          Back
        </button>
        <button
          onClick={onNext}
          disabled={!canProceed || isLoading}
          className="bg-primary text-on-primary px-6 py-2 rounded-theme font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue
        </button>
      </div>
    </div>
  );
};

// Preferences Step Component
const PreferencesStep = ({ formData, updateFormData, onNext, onBack, isLoading }) => {
  const experienceLevels = [
    { value: 'newbie', label: 'New to Fantasy Sports', description: 'Just getting started' },
    { value: 'casual', label: 'Casual Player', description: 'Play for fun occasionally' },
    { value: 'serious', label: 'Serious Competitor', description: 'Love the strategy and competition' },
    { value: 'expert', label: 'Fantasy Expert', description: 'Play multiple fantasy sports' }
  ];

  const corps = [
    'Blue Devils', 'Santa Clara Vanguard', 'Carolina Crown', 'Bluecoats',
    'The Cavaliers', 'Boston Crusaders', 'Phantom Regiment', 'Blue Knights',
    'Madison Scouts', 'Blue Stars', 'Crossmen', 'The Academy'
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-3">
            Your Fantasy Experience
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {experienceLevels.map((level) => (
              <button
                key={level.value}
                onClick={() => updateFormData({ experience: level.value })}
                className={`p-4 rounded-theme border-2 text-left transition-all ${
                  formData.experience === level.value
                    ? 'border-primary bg-primary/10'
                    : 'border-accent dark:border-accent-dark bg-background dark:bg-background-dark'
                }`}
              >
                <div className="font-semibold text-text-primary dark:text-text-primary-dark">
                  {level.label}
                </div>
                <div className="text-sm text-text-secondary dark:text-text-secondary-dark">
                  {level.description}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-3">
            Favorite Drum Corps (Optional)
          </label>
          <select
            value={formData.favoriteCorps}
            onChange={(e) => updateFormData({ favoriteCorps: e.target.value })}
            className="w-full p-3 border border-accent dark:border-accent-dark rounded-theme bg-background dark:bg-background-dark text-text-primary dark:text-text-primary-dark focus:ring-2 focus:ring-primary focus:border-primary"
          >
            <option value="">Select a corps (optional)</option>
            {corps.map((corps) => (
              <option key={corps} value={corps}>{corps}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={formData.notifications}
              onChange={(e) => updateFormData({ notifications: e.target.checked })}
              className="form-checkbox h-5 w-5 text-primary rounded focus:ring-primary"
            />
            <span className="text-text-primary dark:text-text-primary-dark">
              Send me notifications about scores and league updates
            </span>
          </label>
        </div>
      </div>

      <div className="flex justify-between pt-6">
        <button onClick={onBack} className="text-text-secondary dark:text-text-secondary-dark hover:text-primary">
          Back
        </button>
        <button
          onClick={onNext}
          disabled={!formData.experience || isLoading}
          className="bg-primary text-on-primary px-6 py-2 rounded-theme font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue
        </button>
      </div>
    </div>
  );
};

// Goals Step Component
const GoalsStep = ({ formData, updateFormData, onNext, onBack, isLoading }) => {
  const availableGoals = [
    { id: 'championship', label: 'Win a League Championship', icon: '🏆' },
    { id: 'top10', label: 'Finish in Top 10', icon: '⭐' },
    { id: 'perfect_lineup', label: 'Build the Perfect Lineup', icon: '🎯' },
    { id: 'social', label: 'Make Friends in the Community', icon: '👥' },
    { id: 'learn', label: 'Learn More About Drum Corps', icon: '📚' },
    { id: 'fun', label: 'Just Have Fun!', icon: '🎉' }
  ];

  const toggleGoal = (goalId) => {
    const currentGoals = formData.goals || [];
    const newGoals = currentGoals.includes(goalId)
      ? currentGoals.filter(g => g !== goalId)
      : [...currentGoals, goalId];
    updateFormData({ goals: newGoals });
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-text-secondary dark:text-text-secondary-dark mb-4">
          Select what you want to achieve this season (choose any that apply):
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {availableGoals.map((goal) => (
            <button
              key={goal.id}
              onClick={() => toggleGoal(goal.id)}
              className={`p-4 rounded-theme border-2 text-left transition-all ${
                formData.goals?.includes(goal.id)
                  ? 'border-primary bg-primary/10'
                  : 'border-accent dark:border-accent-dark bg-background dark:bg-background-dark'
              }`}
            >
              <div className="flex items-center space-x-3">
                <span className="text-2xl">{goal.icon}</span>
                <span className="font-medium text-text-primary dark:text-text-primary-dark">
                  {goal.label}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-between pt-6">
        <button onClick={onBack} className="text-text-secondary dark:text-text-secondary-dark hover:text-primary">
          Back
        </button>
        <button
          onClick={onNext}
          disabled={isLoading}
          className="bg-primary text-on-primary px-6 py-2 rounded-theme font-semibold hover:bg-primary/90 transition-colors"
        >
          Almost Done!
        </button>
      </div>
    </div>
  );
};

// Complete Step Component
const CompleteStep = ({ onComplete, onBack, isLoading }) => (
  <div className="text-center space-y-6">
    <div className="text-6xl mb-4">🏆</div>
    <div className="space-y-4">
      <p className="text-lg text-text-secondary dark:text-text-secondary-dark">
        Congratulations! Your director profile is ready.
      </p>
      <div className="bg-primary/10 p-6 rounded-theme">
        <h3 className="font-bold text-text-primary dark:text-text-primary-dark mb-2">
          🎉 Welcome Bonus Unlocked!
        </h3>
        <p className="text-text-secondary dark:text-text-secondary-dark">
          You've earned 100 experience points and your first achievement: "Welcome Aboard"
        </p>
      </div>
      <p className="text-sm text-text-secondary dark:text-text-secondary-dark">
        Next, you'll create your first fantasy corps and start competing!
      </p>
    </div>
    <div className="flex justify-between pt-6">
      <button onClick={onBack} className="text-text-secondary dark:text-text-secondary-dark hover:text-primary">
        Back
      </button>
      <button
        onClick={onComplete}
        disabled={isLoading}
        className="bg-primary text-on-primary px-8 py-3 rounded-theme font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        {isLoading ? (
          <div className="flex items-center space-x-2">
            <div className="animate-spin h-4 w-4 border-2 border-on-primary border-t-transparent rounded-full"></div>
            <span>Setting up...</span>
          </div>
        ) : (
          'Start Building My Corps!'
        )}
      </button>
    </div>
  </div>
);

export default OnboardingFlow;