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
  Flag
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
      const updateCorpsInfo = httpsCallable(functions, 'users-updateCorpsInfo');
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
    <div className="max-w-4xl mx-auto">
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-text-primary-dark">
            Step {step} of {totalSteps}
          </span>
          <span className="text-sm text-text-secondary-dark">
            {Math.round((step / totalSteps) * 100)}% Complete
          </span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div
            className="bg-primary h-2 rounded-full transition-all duration-300"
            style={{ width: `${(step / totalSteps) * 100}%` }}
          />
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-surface-dark rounded-theme p-8 shadow-theme-dark">
        {/* Step 1: Welcome */}
        {step === 1 && (
          <div className="text-center space-y-6">
            <div className="w-20 h-20 mx-auto bg-primary rounded-full flex items-center justify-center">
              <Trophy className="w-10 h-10 text-on-primary" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-text-primary-dark mb-2">
                Welcome to marching.art!
              </h2>
              <p className="text-lg text-text-secondary-dark">
                The ultimate fantasy drum corps game
              </p>
            </div>
            <div className="bg-blue-900 bg-opacity-30 border border-blue-400 rounded-theme p-6 text-left">
              <h3 className="text-xl font-bold text-text-primary-dark mb-4">
                What is marching.art?
              </h3>
              <div className="space-y-3 text-text-secondary-dark">
                <p>
                  marching.art is a competitive fantasy game where you build and manage your own drum corps. 
                  Select legendary DCI performances for each caption, compete in weekly shows, and climb the leaderboards!
                </p>
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <div className="bg-background-dark rounded p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Users className="w-4 h-4 text-primary-dark" />
                      <span className="font-semibold text-text-primary-dark">Build Your Corps</span>
                    </div>
                    <p className="text-sm">Select from 25 legendary DCI performances</p>
                  </div>
                  <div className="bg-background-dark rounded p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="w-4 h-4 text-primary-dark" />
                      <span className="font-semibold text-text-primary-dark">Weekly Shows</span>
                    </div>
                    <p className="text-sm">Compete up to 4 times per week</p>
                  </div>
                  <div className="bg-background-dark rounded p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Award className="w-4 h-4 text-primary-dark" />
                      <span className="font-semibold text-text-primary-dark">Hire Staff</span>
                    </div>
                    <p className="text-sm">Legendary Hall of Fame instructors</p>
                  </div>
                  <div className="bg-background-dark rounded p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp className="w-4 h-4 text-primary-dark" />
                      <span className="font-semibold text-text-primary-dark">Climb Ranks</span>
                    </div>
                    <p className="text-sm">Unlock higher class divisions</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: How It Works */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-3xl font-bold text-text-primary-dark mb-2">
                How to Play
              </h2>
              <p className="text-text-secondary-dark">
                Here's everything you need to know to get started
              </p>
            </div>

            <div className="space-y-4">
              {/* Caption Selection */}
              <div className="bg-background-dark rounded-theme p-6 border border-accent-dark">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-2xl font-bold text-on-primary">1</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-text-primary-dark mb-2">
                      Select Your Captions
                    </h3>
                    <p className="text-text-secondary-dark mb-3">
                      Choose 8 legendary DCI performances for each caption: General Effect (2), Visual (3), and Music (3).
                    </p>
                    <div className="bg-surface-dark rounded p-3 text-sm">
                      <div className="font-semibold text-text-primary-dark mb-1">Point Limits:</div>
                      <div className="grid grid-cols-2 gap-2 text-text-secondary-dark">
                        <div>• SoundSport: 90 points</div>
                        <div>• A Class: 60 points</div>
                        <div>• Open Class: 120 points</div>
                        <div>• World Class: 150 points</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Competition */}
              <div className="bg-background-dark rounded-theme p-6 border border-accent-dark">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-2xl font-bold text-on-primary">2</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-text-primary-dark mb-2">
                      Register for Shows
                    </h3>
                    <p className="text-text-secondary-dark mb-3">
                      Register for up to 4 competitions per week. Scores are calculated nightly based on historical DCI data.
                    </p>
                    <div className="flex items-center gap-2 text-sm text-text-secondary-dark">
                      <Trophy className="w-4 h-4 text-yellow-400" />
                      <span>Earn CorpsCoin and XP with every performance!</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Progression */}
              <div className="bg-background-dark rounded-theme p-6 border border-accent-dark">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-2xl font-bold text-on-primary">3</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-text-primary-dark mb-2">
                      Progress Through Classes
                    </h3>
                    <p className="text-text-secondary-dark mb-3">
                      Start in SoundSport, then unlock A Class (500 XP), Open Class (2,000 XP), and World Class (5,000 XP).
                    </p>
                    <div className="bg-surface-dark rounded p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Zap className="w-4 h-4 text-yellow-400" />
                        <span className="font-semibold text-text-primary-dark text-sm">
                          You start with 1,000 CorpsCoin!
                        </span>
                      </div>
                      <p className="text-xs text-text-secondary-dark">
                        Use CorpsCoin to hire Hall of Fame staff members and boost your scores
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Create Your Corps */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <div className="w-20 h-20 mx-auto bg-primary rounded-full flex items-center justify-center mb-4">
                <Flag className="w-10 h-10 text-on-primary" />
              </div>
              <h2 className="text-3xl font-bold text-text-primary-dark mb-2">
                Create Your SoundSport Corps
              </h2>
              <p className="text-text-secondary-dark">
                Let's set up your first corps. You can customize everything later!
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-primary-dark mb-2">
                  Corps Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={corpsName}
                  onChange={(e) => setCorpsName(e.target.value)}
                  placeholder="e.g., Thunder Regiment, Blue Stars, Phantom Knights"
                  className="w-full p-3 bg-background-dark border border-accent-dark rounded-theme focus:outline-none focus:ring-2 focus:ring-primary-dark text-text-primary-dark"
                  maxLength="50"
                  disabled={isSaving}
                />
                <div className="flex justify-between items-center mt-1">
                  <p className="text-xs text-text-secondary-dark">
                    Choose a unique and memorable name for your corps
                  </p>
                  <p className="text-xs text-text-secondary-dark">
                    {corpsName.length}/50
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary-dark mb-2">
                  Your Title/Alias <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={alias}
                  onChange={(e) => setAlias(e.target.value)}
                  placeholder="e.g., Director, Conductor, Captain, Maestro"
                  className="w-full p-3 bg-background-dark border border-accent-dark rounded-theme focus:outline-none focus:ring-2 focus:ring-primary-dark text-text-primary-dark"
                  maxLength="20"
                  disabled={isSaving}
                />
                <div className="flex justify-between items-center mt-1">
                  <p className="text-xs text-text-secondary-dark">
                    How should we address you?
                  </p>
                  <p className="text-xs text-text-secondary-dark">
                    {alias.length}/20
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary-dark mb-2">
                  Location <span className="text-text-secondary-dark text-xs">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g., Indianapolis, IN or California"
                  className="w-full p-3 bg-background-dark border border-accent-dark rounded-theme focus:outline-none focus:ring-2 focus:ring-primary-dark text-text-primary-dark"
                  maxLength="50"
                  disabled={isSaving}
                />
                <p className="text-xs text-text-secondary-dark mt-1">
                  Where is your corps based?
                </p>
              </div>
            </div>

            <div className="bg-blue-900 bg-opacity-20 border border-blue-400 rounded-theme p-4">
              <div className="flex items-start gap-3">
                <Star className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-text-primary-dark">
                  <p className="font-semibold mb-1">Starting as SoundSport</p>
                  <p className="text-text-secondary-dark">
                    You'll begin in the SoundSport division with a 90-point caption budget. 
                    Compete, earn XP, and unlock higher divisions as you progress!
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Ready to Go */}
        {step === 4 && (
          <div className="text-center space-y-6">
            <div className="w-20 h-20 mx-auto bg-green-600 rounded-full flex items-center justify-center">
              <Check className="w-10 h-10 text-white" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-text-primary-dark mb-2">
                You're All Set!
              </h2>
              <p className="text-lg text-text-secondary-dark">
                Ready to start your drum corps journey
              </p>
            </div>

            <div className="bg-background-dark rounded-theme p-6 text-left space-y-4">
              <h3 className="text-xl font-bold text-text-primary-dark mb-4">
                Your Corps Summary
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-accent-dark">
                  <span className="text-text-secondary-dark">Corps Name:</span>
                  <span className="font-bold text-text-primary-dark">{corpsName}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-accent-dark">
                  <span className="text-text-secondary-dark">Your Title:</span>
                  <span className="font-bold text-text-primary-dark">{alias}</span>
                </div>
                {location && (
                  <div className="flex justify-between items-center py-2 border-b border-accent-dark">
                    <span className="text-text-secondary-dark">Location:</span>
                    <span className="font-bold text-text-primary-dark">{location}</span>
                  </div>
                )}
                <div className="flex justify-between items-center py-2 border-b border-accent-dark">
                  <span className="text-text-secondary-dark">Division:</span>
                  <span className="font-bold text-primary-dark">SoundSport</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-text-secondary-dark">Starting CorpsCoin:</span>
                  <span className="font-bold text-yellow-400">1,000</span>
                </div>
              </div>
            </div>

            <div className="bg-green-900 bg-opacity-20 border border-green-400 rounded-theme p-6">
              <h3 className="text-lg font-bold text-text-primary-dark mb-3">
                Next Steps:
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <div className="bg-background-dark rounded p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Target className="w-4 h-4 text-primary-dark" />
                    <span className="font-semibold text-text-primary-dark">1. Select Captions</span>
                  </div>
                  <p className="text-text-secondary-dark">Choose your 8 DCI performances</p>
                </div>
                <div className="bg-background-dark rounded p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="w-4 h-4 text-primary-dark" />
                    <span className="font-semibold text-text-primary-dark">2. Register for Shows</span>
                  </div>
                  <p className="text-text-secondary-dark">Pick your competitions</p>
                </div>
                <div className="bg-background-dark rounded p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Trophy className="w-4 h-4 text-primary-dark" />
                    <span className="font-semibold text-text-primary-dark">3. Compete & Win</span>
                  </div>
                  <p className="text-text-secondary-dark">Earn XP and climb ranks</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-accent-dark">
          <button
            onClick={prevStep}
            disabled={step === 1 || isSaving}
            className={`flex items-center gap-2 px-6 py-2 rounded-theme font-medium transition-colors ${
              step === 1 || isSaving
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-surface-dark text-text-primary-dark hover:bg-accent-dark border border-accent-dark'
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>

          {step < totalSteps ? (
            <button
              onClick={nextStep}
              disabled={!canProceed() || isSaving}
              className={`flex items-center gap-2 px-6 py-2 rounded-theme font-medium transition-colors ${
                !canProceed() || isSaving
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-primary text-on-primary hover:bg-primary-dark'
              }`}
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!canProceed() || isSaving}
              className={`flex items-center gap-2 px-8 py-3 rounded-theme font-bold text-lg transition-colors ${
                !canProceed() || isSaving
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
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
      </div>

      {/* Step Indicators */}
      <div className="flex justify-center gap-2 mt-6">
        {[1, 2, 3, 4].map(stepNum => (
          <div
            key={stepNum}
            className={`w-3 h-3 rounded-full transition-all ${
              stepNum === step
                ? 'bg-primary w-8'
                : stepNum < step
                ? 'bg-green-500'
                : 'bg-gray-600'
            }`}
          />
        ))}
      </div>
    </div>
  );
};

export default NewUserSetup;