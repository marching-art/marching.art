// src/pages/Onboarding.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, MapPin, Flag, ArrowRight, Check,
  Trophy, Target, Users, Wrench, Star, Zap,
  Calendar, Music, TrendingUp
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
    if (step === 2 && !formData.displayName.trim()) {
      toast.error('Please enter your director name');
      return;
    }
    if (step === 3 && !formData.corpsName.trim()) {
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
        corpsCoin: 100, // Starting bonus!
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
            createdAt: new Date(),
            execution: {
              readiness: 0.75,
              morale: 0.85,
              equipment: {
                instruments: 0.90,
                uniforms: 0.90,
                props: 0.85
              }
            }
          }
        },
        engagement: {
          loginStreak: 1,
          lastLogin: new Date().toISOString(),
          totalLogins: 1,
          recentActivity: [{
            type: 'welcome',
            message: 'Welcome to marching.art!',
            timestamp: new Date().toISOString(),
            icon: 'star'
          }]
        },
        dailyOps: {},
        lastRehearsal: null
      };

      await setDoc(profileRef, profileData);

      toast.success('Welcome to marching.art! Here\'s 100 CorpsCoin to get started!');
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
      title: 'Welcome',
      icon: Star
    },
    {
      number: 2,
      title: 'Your Name',
      icon: User
    },
    {
      number: 3,
      title: 'Create Corps',
      icon: Flag
    },
    {
      number: 4,
      title: 'Location',
      icon: MapPin
    }
  ];

  // Game features for the welcome step
  const gameFeatures = [
    {
      icon: Target,
      title: 'Daily Operations',
      description: 'Run rehearsals, manage staff, and maintain equipment every day'
    },
    {
      icon: Users,
      title: 'Build Your Staff',
      description: 'Hire legendary instructors to improve your corps performance'
    },
    {
      icon: Trophy,
      title: 'Compete & Win',
      description: 'Watch your corps perform and climb the leaderboards'
    },
    {
      icon: TrendingUp,
      title: 'Level Up',
      description: 'Earn XP and CorpsCoin to unlock new competition classes'
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
            <div className="min-h-[320px]">
              {/* Step 1: Welcome & Game Overview */}
              {step === 1 && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="text-center mb-6">
                    <div className="inline-flex items-center justify-center w-14 h-14 bg-gold-500/20 rounded-xl mb-4">
                      <Star className="w-7 h-7 text-gold-400" />
                    </div>
                    <h2 className="text-2xl font-display font-bold text-cream-100 mb-2">
                      Welcome to marching.art!
                    </h2>
                    <p className="text-cream-400 text-sm">
                      The fantasy sports game for marching arts enthusiasts
                    </p>
                  </div>

                  <div className="space-y-3">
                    {gameFeatures.map((feature, idx) => {
                      const Icon = feature.icon;
                      return (
                        <div
                          key={idx}
                          className="flex items-start gap-3 p-3 rounded-lg bg-charcoal-800/50"
                        >
                          <div className="p-2 rounded-lg bg-gold-500/20 flex-shrink-0">
                            <Icon className="w-4 h-4 text-gold-400" />
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold text-cream-100">{feature.title}</h4>
                            <p className="text-xs text-cream-500/70">{feature.description}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-green-400" />
                      <p className="text-sm text-green-300">
                        Complete setup to receive <span className="font-bold">100 CorpsCoin</span> bonus!
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Step 2: Director Name */}
              {step === 2 && (
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
                      What's your name, Director?
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

              {/* Step 3: Create Corps */}
              {step === 3 && (
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

                  <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <div className="flex items-center gap-2">
                      <Music className="w-4 h-4 text-blue-400" />
                      <p className="text-xs text-blue-300">
                        You'll start in <span className="font-bold">SoundSport</span> class. Earn CorpsCoin to unlock higher classes!
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Step 4: Location */}
              {step === 4 && (
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
                    <h4 className="font-semibold text-gold-300 mb-2">You're all set!</h4>
                    <p className="text-sm text-gold-300/80">
                      Here's what you can do in your first session:
                    </p>
                    <ul className="mt-2 space-y-1 text-sm text-cream-400">
                      <li className="flex items-center gap-2">
                        <Check className="w-3 h-3 text-green-400" />
                        Claim your daily login bonus
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-3 h-3 text-green-400" />
                        Run your first rehearsal
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-3 h-3 text-green-400" />
                        Check out the staff marketplace
                      </li>
                    </ul>
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
                  disabled={(step === 2 && !formData.displayName.trim()) || (step === 3 && !formData.corpsName.trim())}
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
                      Start Playing
                      <Check className="w-5 h-5" />
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Skip Link */}
            {step === 4 && (
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
