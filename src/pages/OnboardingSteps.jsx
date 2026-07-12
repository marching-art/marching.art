// Onboarding step-1/step-2 panels and the completion celebration modal.
// Extracted verbatim from Onboarding.jsx; all state stays in the parent and
// is passed down as props. The step components are rendered as direct
// children of the parent's <AnimatePresence mode="wait">, so each takes a
// stable key there; their root m.div carries the enter/exit animations.

import React from 'react';
import { m, AnimatePresence } from 'framer-motion';
import {
  User,
  Flag,
  Star,
  Zap,
  ChevronRight,
  Sparkles,
  PartyPopper,
  AtSign,
  Loader2,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { GAME_FEATURES } from './onboardingConstants';

// Step 1: Welcome + Director Name + Username
export const StepWelcome = ({ formData, setFormData, usernameStatus, onUsernameChange }) => (
  <m.div
    initial={{ opacity: 0, x: 20 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: -20 }}
    className="space-y-5"
  >
    <div className="text-center mb-4">
      <div className="inline-flex items-center justify-center w-16 h-16 bg-interactive/20 rounded-none mb-4">
        <Star className="w-8 h-8 text-interactive" />
      </div>
      <h2 className="text-2xl font-bold text-white mb-2">Welcome to marching.art!</h2>
      <p className="text-muted text-sm">Fantasy drum corps gaming</p>
    </div>

    <div className="space-y-2">
      {GAME_FEATURES.map((feature, idx) => {
        const Icon = feature.icon;
        return (
          <div key={idx} className="flex items-start gap-3 p-3 rounded-none bg-charcoal-800/50">
            <div className="p-2 rounded-none bg-interactive/20 flex-shrink-0">
              <Icon className="w-4 h-4 text-interactive" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">{feature.title}</h4>
              <p className="text-xs text-muted">{feature.description}</p>
            </div>
          </div>
        );
      })}
    </div>

    <div className="pt-2 space-y-4">
      <div>
        <label className="flex items-center gap-2 text-xs font-bold text-muted uppercase tracking-wider mb-1.5">
          <User className="w-4 h-4 text-interactive" />
          What's your name, Director?
        </label>
        <input
          type="text"
          className="w-full h-12 px-4 bg-background border border-line rounded-none text-base text-white placeholder-muted focus:outline-none focus:border-interactive"
          name="name"
          autoComplete="name"
          placeholder="e.g., George Zingali"
          value={formData.displayName}
          onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
          maxLength={50}
          autoFocus
        />
      </div>

      <div>
        <label className="flex items-center gap-2 text-xs font-bold text-muted uppercase tracking-wider mb-1.5">
          <AtSign className="w-4 h-4 text-interactive" />
          Choose a username
        </label>
        <div className="relative">
          <input
            type="text"
            className={`w-full h-12 px-4 bg-background border border-line rounded-none text-base text-white placeholder-muted focus:outline-none focus:border-interactive pr-10 ${
              usernameStatus.valid === true
                ? 'border-green-500/50 focus:border-green-500'
                : usernameStatus.valid === false
                  ? 'border-red-500/50 focus:border-red-500'
                  : ''
            }`}
            name="username"
            autoComplete="username"
            placeholder="e.g., drumcorps_fan"
            value={formData.username}
            onChange={onUsernameChange}
            maxLength={15}
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {usernameStatus.checking && <Loader2 className="w-5 h-5 text-muted animate-spin" />}
            {!usernameStatus.checking && usernameStatus.valid === true && (
              <CheckCircle2 className="w-5 h-5 text-green-400" />
            )}
            {!usernameStatus.checking && usernameStatus.valid === false && (
              <XCircle className="w-5 h-5 text-red-400" />
            )}
          </div>
        </div>
        {usernameStatus.message && (
          <p
            className={`text-xs mt-1 ${
              usernameStatus.valid === true
                ? 'text-green-400'
                : usernameStatus.valid === false
                  ? 'text-red-400'
                  : 'text-muted'
            }`}
          >
            {usernameStatus.message}
          </p>
        )}
        <p className="text-xs text-muted mt-1">
          3-15 characters, letters, numbers, and underscores only
        </p>
      </div>
    </div>

    <div className="p-3 rounded-none bg-green-500/10 border border-green-500/20">
      <div className="flex items-center gap-2">
        <Zap className="w-4 h-4 text-green-400" />
        <p className="text-sm text-green-300">
          You'll get <span className="font-bold">100 CorpsCoin</span> to start!
        </p>
      </div>
    </div>
  </m.div>
);

// Step 2: Create Corps
export const StepCorps = ({ formData, setFormData }) => (
  <m.div
    initial={{ opacity: 0, x: 20 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: -20 }}
    className="space-y-6"
  >
    <div className="text-center mb-6">
      <div className="inline-flex items-center justify-center w-16 h-16 bg-interactive/20 rounded-none mb-4">
        <Flag className="w-8 h-8 text-interactive" />
      </div>
      <h2 className="text-2xl font-bold text-white mb-2">Create Your Corps</h2>
      <p className="text-muted text-sm">Name your first fantasy drum corps</p>
    </div>

    <div>
      <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-1.5">
        Corps Name *
      </label>
      <input
        type="text"
        className="w-full h-12 px-4 bg-background border border-line rounded-none text-base text-white placeholder-muted focus:outline-none focus:border-interactive"
        name="corpsName"
        autoComplete="off"
        placeholder="e.g., The Cavaliers"
        value={formData.corpsName}
        onChange={(e) => setFormData({ ...formData, corpsName: e.target.value })}
        maxLength={50}
        autoFocus
      />
    </div>

    <div className="p-4 rounded-none bg-green-500/10 border border-green-500/20">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-none bg-green-500/20">
          <Sparkles className="w-5 h-5 text-green-400" />
        </div>
        <div>
          <h4 className="font-semibold text-green-300">Starting in SoundSport</h4>
          <p className="text-xs text-green-400/80">
            Earn CorpsCoin to unlock higher competition classes!
          </p>
        </div>
      </div>
    </div>

    <div className="p-4 bg-charcoal-800/50 rounded-none">
      <h4 className="font-semibold text-secondary mb-2">Next: Build Your Lineup</h4>
      <p className="text-xs text-muted">
        You'll pick historical corps performances to compete in 8 scoring captions. Think of it like
        a fantasy football draft!
      </p>
    </div>
  </m.div>
);

// Celebration modal shown after the profile is created, before navigating away
export const CelebrationModal = ({ show, displayName, corpsName, onComplete, onJoinLeague }) => (
  <AnimatePresence>
    {show && (
      <m.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
        onClick={onComplete}
      >
        <m.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.5, opacity: 0 }}
          className="text-center p-8"
          onClick={(e) => e.stopPropagation()}
        >
          <m.div
            animate={{
              scale: [1, 1.2, 1],
              rotate: [0, 10, -10, 0],
            }}
            transition={{ duration: 0.5, repeat: 2 }}
            className="inline-block mb-6"
          >
            <PartyPopper className="w-24 h-24 text-interactive" />
          </m.div>

          <m.h2
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-4xl font-black text-interactive mb-3"
          >
            YOU'RE ALL SET!
          </m.h2>

          <m.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-secondary text-lg mb-2"
          >
            Welcome, {displayName}!
          </m.p>

          <m.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="text-muted mb-8"
          >
            {corpsName} is ready to compete
          </m.p>

          <m.button
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.9 }}
            onClick={onComplete}
            className="px-8 py-4 bg-interactive text-white rounded-none font-bold uppercase tracking-wide hover:bg-interactive-hover transition-colors flex items-center gap-2 mx-auto"
          >
            Go to Dashboard
            <ChevronRight className="w-5 h-5" />
          </m.button>

          {/* Rookie league offer — directors in leagues retain far better */}
          {onJoinLeague && (
            <m.button
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 1.1 }}
              onClick={onJoinLeague}
              className="mt-3 px-6 py-2.5 border border-interactive/50 text-interactive rounded-none font-bold text-sm uppercase tracking-wide hover:bg-interactive/10 transition-colors mx-auto block"
            >
              Join the Rookie Circuit — compete head-to-head weekly
            </m.button>
          )}

          {/* Confetti particles */}
          {[...Array(20)].map((_, i) => (
            <m.div
              key={i}
              className="absolute w-3 h-3 rounded-full"
              style={{
                background: ['#FACC15', '#22C55E', '#3B82F6', '#A855F7', '#EF4444'][i % 5],
                left: `${Math.random() * 100}%`,
                top: '-20px',
              }}
              initial={{ y: -20, opacity: 1, rotate: 0 }}
              animate={{
                y: typeof window !== 'undefined' ? window.innerHeight + 100 : 800,
                opacity: 0,
                rotate: Math.random() * 720 - 360,
                x: (Math.random() - 0.5) * 200,
              }}
              transition={{
                duration: 2 + Math.random() * 2,
                delay: Math.random() * 0.5,
                ease: 'easeOut',
              }}
            />
          ))}
        </m.div>
      </m.div>
    )}
  </AnimatePresence>
);
