// src/pages/Onboarding.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  User, MapPin, Type, Sparkles, ArrowRight, Check
} from 'lucide-react';
import { useAuth } from '../App';
import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';

const Onboarding = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    displayName: '',
    location: '',
    bio: '',
    favoriteCorps: ''
  });
  const [loading, setLoading] = useState(false);

  const handleNext = () => {
    if (step === 1 && !formData.displayName.trim()) {
      toast.error('Please enter your director name');
      return;
    }
    setStep(step + 1);
  };

  const handleBack = () => {
    setStep(step - 1);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const profileRef = doc(db, `artifacts/marching-art/users/${user.uid}/profile/data`);

      const profileData = {
        uid: user.uid,
        email: user.email,
        displayName: formData.displayName.trim(),
        location: formData.location.trim() || 'Unknown',
        bio: formData.bio.trim() || '',
        favoriteCorps: formData.favoriteCorps.trim() || '',
        createdAt: new Date(),
        xp: 0,
        xpLevel: 1,
        corpsCoin: 0,
        unlockedClasses: ['soundSport'],
        staff: [],
        achievements: [],
        stats: {
          seasonsPlayed: 0,
          championships: 0,
          topTenFinishes: 0
        },
        corps: {},
        lastRehearsal: null
      };

      await setDoc(profileRef, profileData);

      toast.success('Welcome to marching.art! 🎺');
      navigate('/dashboard');
    } catch (error) {
      console.error('Error creating profile:', error);
      toast.error('Failed to create profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    {
      number: 1,
      title: 'What should we call you?',
      description: 'Choose your director name',
      icon: User
    },
    {
      number: 2,
      title: 'Tell us about yourself',
      description: 'Optional but helps personalize your experience',
      icon: Sparkles
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-main flex items-center justify-center p-4">
      {/* Background Effects */}
      <div className="absolute inset-0">
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-gold-500/10 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-1/3 left-1/4 w-96 h-96 bg-cream-500/10 rounded-full blur-3xl animate-float"
             style={{ animationDelay: '2s' }} />
      </div>

      <div className="w-full max-w-2xl relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="glass-dark rounded-2xl p-8">
            {/* Progress Bar */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                {steps.map((s, idx) => (
                  <React.Fragment key={s.number}>
                    <div className={`flex items-center gap-3 ${idx > 0 ? 'flex-1' : ''}`}>
                      {idx > 0 && (
                        <div className={`flex-1 h-1 mx-4 rounded-full ${
                          step > idx ? 'bg-gold-500' : 'bg-charcoal-700'
                        }`} />
                      )}
                      <div className={`flex items-center justify-center w-10 h-10 rounded-full transition-all ${
                        step === s.number
                          ? 'bg-gold-500 text-charcoal-900'
                          : step > s.number
                          ? 'bg-green-500 text-white'
                          : 'bg-charcoal-700 text-cream-400'
                      }`}>
                        {step > s.number ? (
                          <Check className="w-5 h-5" />
                        ) : (
                          <span className="font-bold">{s.number}</span>
                        )}
                      </div>
                    </div>
                  </React.Fragment>
                ))}
              </div>
              <p className="text-center text-cream-300">
                Step {step} of {steps.length}
              </p>
            </div>

            {/* Step Content */}
            <div className="min-h-[300px]">
              {/* Step 1: Director Name */}
              {step === 1 && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gold-500/20 rounded-2xl mb-4">
                      <User className="w-8 h-8 text-gold-400" />
                    </div>
                    <h2 className="text-2xl font-display font-bold text-cream-100 mb-2">
                      What should we call you?
                    </h2>
                    <p className="text-cream-400">
                      Choose your director name that others will see
                    </p>
                  </div>

                  <div>
                    <label className="label">Director Name *</label>
                    <input
                      type="text"
                      className="input text-lg"
                      placeholder="e.g., George Zingali"
                      value={formData.displayName}
                      onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                      maxLength={50}
                      autoFocus
                    />
                    <p className="text-xs text-cream-400 mt-1">
                      {formData.displayName.length}/50 characters
                    </p>
                  </div>

                  <div className="p-4 bg-gold-500/10 border border-gold-500/30 rounded-lg">
                    <p className="text-sm text-gold-300">
                      💡 <strong>Tip:</strong> Choose a name you'll be proud to display on leaderboards!
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Step 2: Additional Info */}
              {step === 2 && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gold-500/20 rounded-2xl mb-4">
                      <Sparkles className="w-8 h-8 text-gold-400" />
                    </div>
                    <h2 className="text-2xl font-display font-bold text-cream-100 mb-2">
                      Tell us about yourself
                    </h2>
                    <p className="text-cream-400">
                      This is optional, but helps personalize your experience
                    </p>
                  </div>

                  <div>
                    <label className="label">
                      <MapPin className="w-4 h-4 inline mr-1" />
                      Location
                    </label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g., Indianapolis, IN"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      maxLength={100}
                    />
                  </div>

                  <div>
                    <label className="label">
                      <Type className="w-4 h-4 inline mr-1" />
                      Favorite Corps
                    </label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g., Blue Devils, Santa Clara Vanguard"
                      value={formData.favoriteCorps}
                      onChange={(e) => setFormData({ ...formData, favoriteCorps: e.target.value })}
                      maxLength={100}
                    />
                  </div>

                  <div>
                    <label className="label">
                      About You
                    </label>
                    <textarea
                      className="textarea"
                      rows="4"
                      placeholder="Tell the community about yourself and your drum corps experience..."
                      value={formData.bio}
                      onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                      maxLength={500}
                    />
                    <p className="text-xs text-cream-400 mt-1">
                      {formData.bio.length}/500 characters
                    </p>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Navigation Buttons */}
            <div className="flex gap-4 mt-8">
              {step > 1 && (
                <button
                  onClick={handleBack}
                  className="flex-1 px-6 py-3 bg-charcoal-700 text-cream-100 rounded-lg hover:bg-charcoal-600 transition-colors font-semibold"
                >
                  Back
                </button>
              )}

              {step < steps.length ? (
                <button
                  onClick={handleNext}
                  disabled={step === 1 && !formData.displayName.trim()}
                  className="flex-1 px-6 py-3 bg-gold-500 text-charcoal-900 rounded-lg hover:bg-gold-400 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  Continue
                  <ArrowRight className="w-5 h-5" />
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex-1 px-6 py-3 bg-gold-500 text-charcoal-900 rounded-lg hover:bg-gold-400 transition-colors font-semibold flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-charcoal-900 border-t-transparent rounded-full animate-spin" />
                      Creating Profile...
                    </>
                  ) : (
                    <>
                      Complete Setup
                      <Check className="w-5 h-5" />
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Skip Link */}
            {step === 2 && (
              <button
                onClick={handleSubmit}
                className="w-full mt-4 text-cream-400 hover:text-cream-200 text-sm transition-colors"
                disabled={loading}
              >
                Skip for now
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Onboarding;
