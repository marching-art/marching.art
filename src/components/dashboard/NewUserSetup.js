import React, { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebaseConfig';
import toast from 'react-hot-toast';
import { 
  Trophy, 
  Users, 
  Award, 
  Calendar, 
  TrendingUp, 
  Zap,
  ChevronRight,
  ChevronLeft,
  Check,
  Star,
  Target,
  Flag,
  Music,
  Palette as PaletteIcon,
  Crown,
  Sparkles
} from 'lucide-react';

const NewUserSetup = ({ profile, onComplete }) => {
  const [step, setStep] = useState(1);
  const [corpsName, setCorpsName] = useState('');
  const [alias, setAlias] = useState('');
  const [location, setLocation] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const totalSteps = 4;

  const nextStep = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    }
  };

  const prevStep = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleSubmit = async () => {
    if (!corpsName || !alias) {
      toast.error("Please fill out all required fields.");
      return;
    }
    
    if (corpsName.length > 50) {
      toast.error("Corps name must be 50 characters or less.");
      return;
    }
    
    if (alias.length > 20) {
      toast.error("Alias must be 20 characters or less.");
      return;
    }
    
    setIsSaving(true);
    
    try {
      // FIXED: Changed from 'users-updateCorpsInfo' to 'updateCorpsInfo'
      const updateCorpsInfo = httpsCallable(functions, 'updateCorpsInfo');
      const result = await updateCorpsInfo({ 
        corpsName: corpsName.trim(), 
        alias: alias.trim(),
        location: location.trim() || null
      });
      
      if (result.data.success) {
        toast.success("Welcome to marching.art! 🎺");
        onComplete();
      } else {
        toast.error(result.data.message || "Failed to create corps");
      }
    } catch (error) {
      console.error('Function call error:', error);
      
      if (error.code === 'functions/unauthenticated') {
        toast.error("Please log in to continue.");
      } else if (error.code === 'functions/invalid-argument') {
        toast.error(error.message || "Invalid input provided.");
      } else if (error.code === 'functions/not-found') {
        toast.error("User profile not found. Please try logging out and back in.");
      } else {
        toast.error("Failed to save corps info. Please try again.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const canProceed = () => {
    if (step === 1) return true;
    if (step === 2) return true;
    if (step === 3) return corpsName.trim().length > 0 && alias.trim().length > 0;
    if (step === 4) return true;
    return false;
  };

  return (
    <div className="max-w-5xl mx-auto">
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-text-primary dark:text-text-primary-dark">
            Step {step} of {totalSteps}
          </span>
          <span className="text-sm text-text-secondary dark:text-text-secondary-dark">
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

      {/* Step Content */}
      <div className="bg-surface dark:bg-surface-dark rounded-theme p-8 shadow-theme dark:shadow-theme-dark min-h-[500px]">
        {/* Step 1: Welcome */}
        {step === 1 && (
          <div className="text-center space-y-6">
            <div className="w-24 h-24 mx-auto bg-primary dark:bg-primary-dark rounded-full flex items-center justify-center shadow-lg">
              <Trophy className="w-12 h-12 text-white" />
            </div>
            <div>
              <h2 className="text-4xl font-bold text-text-primary dark:text-text-primary-dark mb-3">
                Welcome to marching.art!
              </h2>
              <p className="text-xl text-text-secondary dark:text-text-secondary-dark">
                The ultimate fantasy drum corps game
              </p>
            </div>

            <div className="max-w-2xl mx-auto">
              <div className="bg-accent dark:bg-accent-dark bg-opacity-30 border border-secondary dark:border-secondary-dark rounded-theme p-6 text-left">
                <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-4 flex items-center gap-2">
                  <Sparkles className="w-6 h-6 text-primary dark:text-primary-dark" />
                  What is marching.art?
                </h3>
                <div className="space-y-3 text-text-secondary dark:text-text-secondary-dark">
                  <p>
                    marching.art is a competitive fantasy game where you build and manage your own drum corps. 
                    Select legendary DCI performances for each caption, compete in weekly shows, and climb the leaderboards!
                  </p>
                  <p>
                    Create your unique corps identity, hire Hall of Fame staff, and compete against other directors 
                    from around the world. Every decision matters as you strive for the championship!
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto mt-8">
              <div className="bg-background dark:bg-background-dark p-6 rounded-theme text-center">
                <Users className="w-10 h-10 mx-auto text-primary dark:text-primary-dark mb-3" />
                <h4 className="font-bold text-text-primary dark:text-text-primary-dark mb-2">Build Your Corps</h4>
                <p className="text-sm text-text-secondary dark:text-text-secondary-dark">
                  Select DCI corps for each caption and create winning combinations
                </p>
              </div>

              <div className="bg-background dark:bg-background-dark p-6 rounded-theme text-center">
                <TrendingUp className="w-10 h-10 mx-auto text-primary dark:text-primary-dark mb-3" />
                <h4 className="font-bold text-text-primary dark:text-text-primary-dark mb-2">Compete & Score</h4>
                <p className="text-sm text-text-secondary dark:text-text-secondary-dark">
                  Earn points based on real DCI performances throughout the season
                </p>
              </div>

              <div className="bg-background dark:bg-background-dark p-6 rounded-theme text-center">
                <Award className="w-10 h-10 mx-auto text-primary dark:text-primary-dark mb-3" />
                <h4 className="font-bold text-text-primary dark:text-text-primary-dark mb-2">Win Rewards</h4>
                <p className="text-sm text-text-secondary dark:text-text-secondary-dark">
                  Climb leaderboards, unlock new classes, and earn CorpsCoin
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: How It Works */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <Target className="w-20 h-20 mx-auto text-primary dark:text-primary-dark mb-4" />
              <h2 className="text-3xl font-bold text-text-primary dark:text-text-primary-dark mb-2">
                How It Works
              </h2>
              <p className="text-lg text-text-secondary dark:text-text-secondary-dark">
                Understanding the game mechanics
              </p>
            </div>

            <div className="space-y-4 max-w-3xl mx-auto">
              <div className="bg-background dark:bg-background-dark p-6 rounded-theme">
                <div className="flex items-start gap-4">
                  <div className="bg-primary dark:bg-primary-dark rounded-full p-3 flex-shrink-0">
                    <Music className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-text-primary dark:text-text-primary-dark mb-2">
                      Caption Selection
                    </h3>
                    <p className="text-text-secondary dark:text-text-secondary-dark">
                      Choose real DCI corps for 8 captions: <strong>GE1, GE2, Visual Proficiency, Visual Analysis, 
                      Color Guard, Brass, Music Analysis, and Percussion</strong>. Each corps has a point value 
                      that reflects their strength.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-background dark:bg-background-dark p-6 rounded-theme">
                <div className="flex items-start gap-4">
                  <div className="bg-secondary dark:bg-secondary-dark rounded-full p-3 flex-shrink-0">
                    <Target className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-text-primary dark:text-text-primary-dark mb-2">
                      Point Limits & Strategy
                    </h3>
                    <p className="text-text-secondary dark:text-text-secondary-dark">
                      Each class has a maximum point allocation. <strong>SoundSport: 90 points, A Class: 60 points, 
                      Open Class: 120 points, World Class: 150 points</strong>. Build your lineup strategically - 
                      do you go top-heavy or balanced?
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-background dark:bg-background-dark p-6 rounded-theme">
                <div className="flex items-start gap-4">
                  <div className="bg-primary dark:bg-primary-dark rounded-full p-3 flex-shrink-0">
                    <Trophy className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-text-primary dark:text-text-primary-dark mb-2">
                      Live Scoring System
                    </h3>
                    <p className="text-text-secondary dark:text-text-secondary-dark">
                      As real DCI corps compete throughout the season, your fantasy corps earns points based on 
                      their actual performances. <strong>GE = 40 points max, Visual Total = 30 points, Music Total = 30 points</strong>, 
                      just like real DCI scoring.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-background dark:bg-background-dark p-6 rounded-theme">
                <div className="flex items-start gap-4">
                  <div className="bg-secondary dark:bg-secondary-dark rounded-full p-3 flex-shrink-0">
                    <Zap className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-text-primary dark:text-text-primary-dark mb-2">
                      Caption Changes
                    </h3>
                    <p className="text-text-secondary dark:text-text-secondary-dark">
                      <strong>Unlimited changes until 5 weeks remaining</strong>, then 3 changes per week until 
                      1 week out. Final week: 2 changes between quarters/semis and 2 between semis/finals. 
                      Choose wisely!
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-background dark:bg-background-dark p-6 rounded-theme">
                <div className="flex items-start gap-4">
                  <div className="bg-primary dark:bg-primary-dark rounded-full p-3 flex-shrink-0">
                    <Crown className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-text-primary dark:text-text-primary-dark mb-2">
                      Compete & Advance
                    </h3>
                    <p className="text-text-secondary dark:text-text-secondary-dark">
                      Climb the leaderboards, earn XP to unlock higher classes, collect CorpsCoin to hire legendary 
                      staff, and compete for the championship. No two corps can have the same lineup!
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Create Your Corps */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <Flag className="w-20 h-20 mx-auto text-primary dark:text-primary-dark mb-4" />
              <h2 className="text-3xl font-bold text-text-primary dark:text-text-primary-dark mb-2">
                Create Your Corps
              </h2>
              <p className="text-lg text-text-secondary dark:text-text-secondary-dark">
                Choose a unique identity for your fantasy drum corps
              </p>
            </div>

            <div className="max-w-2xl mx-auto">
              <div className="bg-accent dark:bg-accent-dark bg-opacity-30 border border-secondary dark:border-secondary-dark rounded-theme p-6 text-left">
                <p className="text-sm text-text-primary dark:text-text-primary-dark">
                  <strong>💡 Tip:</strong> Choose a memorable name that represents your vision. 
                  You can customize everything later!
                </p>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                    Corps Name <span className="text-error">*</span>
                  </label>
                  <input
                    type="text"
                    value={corpsName}
                    onChange={(e) => setCorpsName(e.target.value)}
                    placeholder="e.g., Thunder Regiment, Blue Stars Elite, Phantom Knights"
                    className="w-full p-4 bg-background dark:bg-background-dark border border-accent dark:border-accent-dark rounded-theme focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary-dark text-text-primary dark:text-text-primary-dark text-lg"
                    maxLength="50"
                    disabled={isSaving}
                  />
                  <div className="flex justify-between items-center mt-2">
                    <p className="text-xs text-text-secondary dark:text-text-secondary-dark">
                      Choose a unique and memorable name for your corps
                    </p>
                    <p className="text-xs text-text-secondary dark:text-text-secondary-dark font-mono">
                      {corpsName.length}/50
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                    Your Title/Alias <span className="text-error">*</span>
                  </label>
                  <input
                    type="text"
                    value={alias}
                    onChange={(e) => setAlias(e.target.value)}
                    placeholder="e.g., Director, Conductor, Captain, Maestro"
                    className="w-full p-4 bg-background dark:bg-background-dark border border-accent dark:border-accent-dark rounded-theme focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary-dark text-text-primary dark:text-text-primary-dark text-lg"
                    maxLength="20"
                    disabled={isSaving}
                  />
                  <div className="flex justify-between items-center mt-2">
                    <p className="text-xs text-text-secondary dark:text-text-secondary-dark">
                      How should we address you?
                    </p>
                    <p className="text-xs text-text-secondary dark:text-text-secondary-dark font-mono">
                      {alias.length}/20
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                    Location <span className="text-text-secondary dark:text-text-secondary-dark text-xs">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g., California, USA"
                    className="w-full p-4 bg-background dark:bg-background-dark border border-accent dark:border-accent-dark rounded-theme focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary-dark text-text-primary dark:text-text-primary-dark text-lg"
                    maxLength="50"
                    disabled={isSaving}
                  />
                  <p className="text-xs text-text-secondary dark:text-text-secondary-dark mt-2">
                    Share where your corps calls home
                  </p>
                </div>
              </div>

              <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-background dark:bg-background-dark p-4 rounded-theme text-center">
                  <Star className="w-8 h-8 mx-auto text-primary dark:text-primary-dark mb-2" />
                  <p className="text-sm font-semibold text-text-primary dark:text-text-primary-dark mb-1">
                    Starting Class
                  </p>
                  <p className="text-xs text-text-secondary dark:text-text-secondary-dark">
                    SoundSport (90 points)
                  </p>
                </div>

                <div className="bg-background dark:bg-background-dark p-4 rounded-theme text-center">
                  <Trophy className="w-8 h-8 mx-auto text-secondary dark:text-secondary-dark mb-2" />
                  <p className="text-sm font-semibold text-text-primary dark:text-text-primary-dark mb-1">
                    Starting Balance
                  </p>
                  <p className="text-xs text-text-secondary dark:text-text-secondary-dark">
                    1,000 CorpsCoin
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Ready to Go */}
        {step === 4 && (
          <div className="text-center space-y-6">
            <div className="w-24 h-24 mx-auto bg-green-600 rounded-full flex items-center justify-center shadow-lg">
              <Check className="w-12 h-12 text-white" />
            </div>
            <div>
              <h2 className="text-4xl font-bold text-text-primary dark:text-text-primary-dark mb-3">
                You're All Set!
              </h2>
              <p className="text-xl text-text-secondary dark:text-text-secondary-dark">
                Ready to start your drum corps journey
              </p>
            </div>

            <div className="max-w-2xl mx-auto">
              <div className="bg-background dark:bg-background-dark rounded-theme p-6 text-left space-y-4">
                <h3 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark mb-4 text-center">
                  Your Corps Summary
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-3 border-b border-accent dark:border-accent-dark">
                    <span className="text-text-secondary dark:text-text-secondary-dark font-medium">Corps Name:</span>
                    <span className="font-bold text-text-primary dark:text-text-primary-dark text-lg">{corpsName}</span>
                  </div>
                  <div className="flex justify-between items-center py-3 border-b border-accent dark:border-accent-dark">
                    <span className="text-text-secondary dark:text-text-secondary-dark font-medium">Your Title:</span>
                    <span className="font-bold text-text-primary dark:text-text-primary-dark text-lg">{alias}</span>
                  </div>
                  {location && (
                    <div className="flex justify-between items-center py-3 border-b border-accent dark:border-accent-dark">
                      <span className="text-text-secondary dark:text-text-secondary-dark font-medium">Location:</span>
                      <span className="font-bold text-text-primary dark:text-text-primary-dark text-lg">{location}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center py-3 border-b border-accent dark:border-accent-dark">
                    <span className="text-text-secondary dark:text-text-secondary-dark font-medium">Division:</span>
                    <span className="font-bold text-primary dark:text-primary-dark text-lg">SoundSport</span>
                  </div>
                  <div className="flex justify-between items-center py-3">
                    <span className="text-text-secondary dark:text-text-secondary-dark font-medium">Starting CorpsCoin:</span>
                    <span className="font-bold text-secondary dark:text-secondary-dark text-lg">1,000</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="max-w-3xl mx-auto">
              <div className="bg-green-900 bg-opacity-20 border border-green-400 rounded-theme p-6">
                <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-4 flex items-center justify-center gap-2">
                  <Sparkles className="w-6 h-6 text-green-400" />
                  Next Steps
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="bg-background dark:bg-background-dark rounded-theme p-4 text-center">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <Target className="w-5 h-5 text-primary dark:text-primary-dark" />
                      <span className="font-semibold text-text-primary dark:text-text-primary-dark">1. Build Lineup</span>
                    </div>
                    <p className="text-xs text-text-secondary dark:text-text-secondary-dark">
                      Select your 8 caption corps
                    </p>
                  </div>

                  <div className="bg-background dark:bg-background-dark rounded-theme p-4 text-center">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <Calendar className="w-5 h-5 text-primary dark:text-primary-dark" />
                      <span className="font-semibold text-text-primary dark:text-text-primary-dark">2. Register</span>
                    </div>
                    <p className="text-xs text-text-secondary dark:text-text-secondary-dark">
                      Sign up for competitions
                    </p>
                  </div>

                  <div className="bg-background dark:bg-background-dark rounded-theme p-4 text-center">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <Trophy className="w-5 h-5 text-primary dark:text-primary-dark" />
                      <span className="font-semibold text-text-primary dark:text-text-primary-dark">3. Compete</span>
                    </div>
                    <p className="text-xs text-text-secondary dark:text-text-secondary-dark">
                      Earn points and climb ranks
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-between mt-6 relative z-10">
        <button
          onClick={prevStep}
          disabled={step === 1 || isSaving}
          className={`flex items-center gap-2 px-6 py-3 rounded-theme font-semibold transition-colors relative ${
            step === 1 || isSaving
              ? 'bg-gray-600 text-gray-400 cursor-not-allowed opacity-50'
              : 'bg-secondary text-on-secondary dark:bg-secondary-dark hover:bg-opacity-90'
          }`}
        >
          <ChevronLeft className="w-5 h-5" />
          Back
        </button>

        {step < totalSteps ? (
          <button
            onClick={nextStep}
            disabled={!canProceed() || isSaving}
            className={`flex items-center gap-2 px-6 py-3 rounded-theme font-semibold transition-colors relative ${
              !canProceed() || isSaving
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed opacity-50'
                : 'bg-primary text-white dark:bg-primary-dark hover:bg-opacity-90'
            }`}
          >
            Next
            <ChevronRight className="w-5 h-5" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={isSaving || !corpsName || !alias}
            className={`flex items-center gap-2 px-8 py-3 rounded-theme font-bold transition-colors relative ${
              isSaving || !corpsName || !alias
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed opacity-50'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {isSaving ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Creating...
              </>
            ) : (
              <>
                <Check className="w-5 h-5" />
                Create My Corps
              </>
            )}
          </button>
        )}
      </div>

      {/* Step Indicators */}
      <div className="flex justify-center gap-2 mt-6">
        {[1, 2, 3, 4].map(stepNum => (
          <div
            key={stepNum}
            className={`h-2 rounded-full transition-all ${
              stepNum === step
                ? 'bg-primary dark:bg-primary-dark w-8'
                : stepNum < step
                ? 'bg-green-500 w-2'
                : 'bg-accent dark:bg-accent-dark w-2'
            }`}
          />
        ))}
      </div>
    </div>
  );
};

export default NewUserSetup;