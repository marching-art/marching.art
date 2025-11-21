// src/pages/Onboarding.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  User, MapPin, Flag, ArrowRight, Check
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
    corpsName: '',
    showConcept: ''
  });
  const [loading, setLoading] = useState(false);

  const handleNext = () => {
    if (step === 1 && !formData.displayName.trim()) {
      toast.error('Please enter your director name');
      return;
    }
    if (step === 2 && !formData.corpsName.trim()) {
      toast.error('Please enter a name for your corps');
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
        bio: '',
        favoriteCorps: '',
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
        corps: {
          soundSport: {
            name: formData.corpsName.trim(),
            showConcept: formData.showConcept.trim() || 'Untitled Show',
            class: 'soundSport',
            createdAt: new Date()
          }
        },
        lastRehearsal: null
      };

      await setDoc(profileRef, profileData);

      toast.success('Welcome to marching.art!');
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
      title: 'Your Name',
      icon: User
    },
    {
      number: 2,
      title: 'Create Corps',
      icon: Flag
    },
    {
      number: 3,
      title: 'Location',
      icon: MapPin
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

      <div className="w-full max-w-lg relative z-10">
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
                    <div className={`flex items-center gap-2 ${idx > 0 ? 'flex-1' : ''}`}>
                      {idx > 0 && (
                        <div className={`flex-1 h-1 mx-2 rounded-full ${
                          step > idx ? 'bg-gold-500' : 'bg-charcoal-700'
                        }`} />
                      )}
                      <div className={`flex items-center justify-center w-8 h-8 rounded-full transition-all ${
                        step === s.number
                          ? 'bg-gold-500 text-charcoal-900'
                          : step > s.number
                          ? 'bg-green-500 text-white'
                          : 'bg-charcoal-700 text-cream-400'
                      }`}>
                        {step > s.number ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <span className="text-sm font-bold">{s.number}</span>
                        )}
                      </div>
                    </div>
                  </React.Fragment>
                ))}
              </div>
              <p className="text-center text-cream-300 text-sm">
                Step {step} of {steps.length}
              </p>
            </div>

            {/* Step Content */}
            <div className="min-h-[280px]">
              {/* Step 1: Director Name */}
              {step === 1 && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="text-center mb-6">
                    <div className="inline-flex items-center justify-center w-14 h-14 bg-gold-500/20 rounded-xl mb-4">
                      <User className="w-7 h-7 text-gold-400" />
                    </div>
                    <h2 className="text-2xl font-display font-bold text-cream-100 mb-2">
                      What's your name?
                    </h2>
                    <p className="text-cream-400 text-sm">
                      This is how other directors will see you
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
                  </div>
                </motion.div>
              )}

              {/* Step 2: Create Corps */}
              {step === 2 && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="text-center mb-6">
                    <div className="inline-flex items-center justify-center w-14 h-14 bg-gold-500/20 rounded-xl mb-4">
                      <Flag className="w-7 h-7 text-gold-400" />
                    </div>
                    <h2 className="text-2xl font-display font-bold text-cream-100 mb-2">
                      Create Your Corps
                    </h2>
                    <p className="text-cream-400 text-sm">
                      Name your first fantasy drum corps
                    </p>
                  </div>

                  <div>
                    <label className="label">Corps Name *</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g., The Cavaliers"
                      value={formData.corpsName}
                      onChange={(e) => setFormData({ ...formData, corpsName: e.target.value })}
                      maxLength={50}
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="label">Show Concept (optional)</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g., Dreams of Tomorrow"
                      value={formData.showConcept}
                      onChange={(e) => setFormData({ ...formData, showConcept: e.target.value })}
                      maxLength={100}
                    />
                    <p className="text-xs text-cream-400 mt-1">
                      Give your show a theme or title
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Step 3: Location */}
              {step === 3 && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="text-center mb-6">
                    <div className="inline-flex items-center justify-center w-14 h-14 bg-gold-500/20 rounded-xl mb-4">
                      <MapPin className="w-7 h-7 text-gold-400" />
                    </div>
                    <h2 className="text-2xl font-display font-bold text-cream-100 mb-2">
                      Where are you from?
                    </h2>
                    <p className="text-cream-400 text-sm">
                      Optional - helps find local leagues
                    </p>
                  </div>

                  <div>
                    <label className="label">Location</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g., Indianapolis, IN"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      maxLength={100}
                      autoFocus
                    />
                  </div>

                  <div className="p-4 bg-gold-500/10 border border-gold-500/30 rounded-lg">
                    <p className="text-sm text-gold-300">
                      You're all set! Click "Complete Setup" to start playing.
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
                  disabled={(step === 1 && !formData.displayName.trim()) || (step === 2 && !formData.corpsName.trim())}
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
                      Creating...
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
            {step === 3 && (
              <button
                onClick={handleSubmit}
                className="w-full mt-4 text-cream-400 hover:text-cream-200 text-sm transition-colors"
                disabled={loading}
              >
                Skip location
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Onboarding;
