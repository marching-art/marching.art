import React, { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebaseConfig';
import toast from 'react-hot-toast';
import { Sparkles, ArrowRight, ArrowLeft, Check } from 'lucide-react';

const NewUserSetup = ({ profile, onComplete }) => {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    alias: '',
    location: '',
    corpsName: '',
    corpsClass: 'SoundSport'
  });

  const totalSteps = 4;

  const handleNext = () => {
    if (step === 2 && !formData.alias.trim()) {
      toast.error('Please enter a director alias');
      return;
    }
    if (step === 3 && !formData.corpsName.trim()) {
      toast.error('Please enter a corps name');
      return;
    }
    setStep(step + 1);
  };

  const handleBack = () => {
    setStep(step - 1);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const completeSetup = httpsCallable(functions, 'completeUserSetup');
      const result = await completeSetup({
        alias: formData.alias.trim() || 'Director',
        location: formData.location.trim() || '',
        corpsName: formData.corpsName.trim(),
        corpsClass: formData.corpsClass
      });

      if (result.data.success) {
        toast.success('Welcome to marching.art!');
        onComplete();
      } else {
        toast.error(result.data.message || 'Setup failed');
      }
    } catch (error) {
      console.error('Setup error:', error);
      toast.error(error.message || 'Failed to complete setup');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Progress */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-text-primary dark:text-text-primary-dark">
            Step {step} of {totalSteps}
          </span>
          <span className="text-sm font-medium text-text-primary dark:text-text-primary-dark">
            {Math.round((step / totalSteps) * 100)}% Complete
          </span>
        </div>
        <div className="w-full bg-accent dark:bg-accent-dark rounded-full h-2">
          <div 
            className="bg-primary dark:bg-primary-dark h-2 rounded-full transition-all duration-300"
            style={{ width: `${(step / totalSteps) * 100}%` }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="bg-surface dark:bg-surface-dark rounded-theme p-6 sm:p-8 shadow-theme dark:shadow-theme-dark border-2 border-accent dark:border-accent-dark">
        {step === 1 && (
          <div className="text-center space-y-6">
            <Sparkles className="w-16 h-16 text-primary dark:text-primary-dark mx-auto" />
            <h2 className="text-3xl font-bold text-text-primary dark:text-text-primary-dark">
              Welcome to marching.art!
            </h2>
            <p className="text-lg text-text-secondary dark:text-text-secondary-dark">
              The ultimate fantasy drum corps game
            </p>

            <div className="bg-accent dark:bg-accent-dark p-6 rounded-theme text-left space-y-4">
              <h3 className="font-bold text-text-primary dark:text-text-primary-dark flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary dark:text-primary-dark" />
                What is marching.art?
              </h3>
              <p className="text-text-secondary dark:text-text-secondary-dark">
                marching.art is a competitive fantasy game where you build and manage your own drum corps. Select legendary DCI performances for each caption, compete in weekly shows, and climb the leaderboards!
              </p>
              <p className="text-text-secondary dark:text-text-secondary-dark">
                Create your unique corps identity, hire Hall of Fame staff, and compete against other directors from around the world. Every decision matters as you strive for the championship!
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary dark:text-primary-dark mb-2">Build Your Corps</div>
                <p className="text-sm text-text-secondary dark:text-text-secondary-dark">
                  Select DCI corps for each caption and create winning combinations
                </p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary dark:text-primary-dark mb-2">Compete & Score</div>
                <p className="text-sm text-text-secondary dark:text-text-secondary-dark">
                  Earn points based on real DCI performances throughout the season
                </p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary dark:text-primary-dark mb-2">Win Rewards</div>
                <p className="text-sm text-text-secondary dark:text-text-secondary-dark">
                  Climb leaderboards, unlock new classes, and earn CorpsCoin
                </p>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark mb-2">
                Create Your Director Profile
              </h2>
              <p className="text-text-secondary dark:text-text-secondary-dark">
                Tell us a bit about yourself
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-text-primary dark:text-text-primary-dark mb-2">
                Director Alias <span className="text-error">*</span>
              </label>
              <input
                type="text"
                value={formData.alias}
                onChange={(e) => setFormData({ ...formData, alias: e.target.value })}
                placeholder="e.g., Maestro, Captain, Director..."
                className="w-full px-4 py-3 bg-background dark:bg-background-dark border-2 border-accent dark:border-accent-dark rounded-theme focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary-dark text-text-primary dark:text-text-primary-dark"
                maxLength={20}
              />
              <p className="text-xs text-text-secondary dark:text-text-secondary-dark mt-1">
                This is how you'll be known in the game
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-text-primary dark:text-text-primary-dark mb-2">
                Location (Optional)
              </label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="City, State"
                className="w-full px-4 py-3 bg-background dark:bg-background-dark border-2 border-accent dark:border-accent-dark rounded-theme focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary-dark text-text-primary dark:text-text-primary-dark"
                maxLength={50}
              />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark mb-2">
                Create Your First Corps
              </h2>
              <p className="text-text-secondary dark:text-text-secondary-dark">
                Every director needs a corps to compete
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-text-primary dark:text-text-primary-dark mb-2">
                Corps Name <span className="text-error">*</span>
              </label>
              <input
                type="text"
                value={formData.corpsName}
                onChange={(e) => setFormData({ ...formData, corpsName: e.target.value })}
                placeholder="e.g., Thunder Regiment, Elite Vanguard..."
                className="w-full px-4 py-3 bg-background dark:bg-background-dark border-2 border-accent dark:border-accent-dark rounded-theme focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary-dark text-text-primary dark:text-text-primary-dark"
                maxLength={50}
              />
            </div>

            <div className="bg-primary/10 dark:bg-primary-dark/10 border border-primary dark:border-primary-dark rounded-theme p-4">
              <p className="text-sm text-text-primary dark:text-text-primary-dark">
                <strong>Note:</strong> You'll start in SoundSport class. Earn XP to unlock A Class (500 XP), Open Class (2,000 XP), and World Class (5,000 XP)!
              </p>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6 text-center">
            <Check className="w-16 h-16 text-green-500 mx-auto" />
            <h2 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
              Ready to Begin!
            </h2>
            <div className="space-y-3 text-left bg-accent dark:bg-accent-dark p-6 rounded-theme">
              <div className="flex items-start gap-3">
                <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-text-primary dark:text-text-primary-dark">Director: {formData.alias || 'Director'}</div>
                  {formData.location && (
                    <div className="text-sm text-text-secondary dark:text-text-secondary-dark">
                      Location: {formData.location}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-text-primary dark:text-text-primary-dark">Corps: {formData.corpsName}</div>
                  <div className="text-sm text-text-secondary dark:text-text-secondary-dark">
                    Class: SoundSport
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div className="font-semibold text-text-primary dark:text-text-primary-dark">
                  Starting Balance: 1,000 CorpsCoin
                </div>
              </div>
            </div>
            <p className="text-text-secondary dark:text-text-secondary-dark">
              You're all set! Click "Complete Setup" to start your journey.
            </p>
          </div>
        )}

        {/* Navigation */}
        <div className="flex gap-4 mt-8">
          {step > 1 && (
            <button
              onClick={handleBack}
              disabled={isSubmitting}
              className="px-6 py-3 bg-accent dark:bg-accent-dark text-text-primary dark:text-text-primary-dark border-2 border-text-secondary dark:border-text-secondary-dark rounded-theme font-semibold transition-all disabled:opacity-50 flex items-center gap-2 hover:opacity-90"
            >
              <ArrowLeft className="w-5 h-5" />
              Back
            </button>
          )}

          {step < totalSteps ? (
            <button
              onClick={handleNext}
              className="flex-1 px-6 py-3 bg-primary text-on-primary dark:bg-primary-dark dark:text-on-primary-dark rounded-theme font-bold text-lg transition-all flex items-center justify-center gap-2 hover:opacity-90 shadow-lg"
            >
              Next
              <ArrowRight className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1 px-6 py-3 bg-primary text-on-primary dark:bg-primary-dark dark:text-on-primary-dark rounded-theme font-bold text-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2 hover:opacity-90 shadow-lg"
            >
              {isSubmitting ? (
                <>
                  <img 
                    src="/favicon-32x32.png" 
                    alt="Loading" 
                    className="w-5 h-5 animate-spin"
                    style={{ animationDuration: '1s' }}
                  />
                  Setting up...
                </>
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  Complete Setup
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default NewUserSetup;