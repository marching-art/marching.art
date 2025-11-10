// src/pages/Schedule.jsx
import React from 'react';
import { motion } from 'framer-motion';
import { Calendar, MapPin, Clock, ChevronRight } from 'lucide-react';

export default function Schedule() {
  const weeks = [
    { week: 1, dates: 'June 15-21', shows: 12 },
    { week: 2, dates: 'June 22-28', shows: 18 },
    { week: 3, dates: 'June 29-July 5', shows: 24 },
  ];

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-4xl font-display font-bold text-gradient mb-4">Season Schedule</h1>
        <p className="text-cream-300">Upcoming shows and competition dates</p>
      </motion.div>

      <div className="space-y-4">
        {weeks.map((week, index) => (
          <motion.div
            key={week.week}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="card hover:shadow-glow transition-all"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-cream-100">Week {week.week}</h3>
                <p className="text-cream-500/60">{week.dates}</p>
                <p className="text-sm text-gold-500 mt-1">{week.shows} shows scheduled</p>
              </div>
              <ChevronRight className="w-5 h-5 text-cream-500/40" />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// src/pages/Scores.jsx
export function Scores() {
  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-4xl font-display font-bold text-gradient mb-4">Live Scores</h1>
        <p className="text-cream-300">Real-time competition results and recaps</p>
      </motion.div>

      <div className="card p-8 text-center">
        <Clock className="w-16 h-16 text-cream-500/40 mx-auto mb-4" />
        <p className="text-xl text-cream-300">No live shows today</p>
        <p className="text-cream-500/60 mt-2">Check back during competition times</p>
      </div>
    </div>
  );
}

// src/pages/Profile.jsx
export function Profile() {
  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-4xl font-display font-bold text-gradient mb-4">Director Profile</h1>
        <p className="text-cream-300">Your achievements and statistics</p>
      </motion.div>

      <div className="card p-8">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 bg-gradient-cream rounded-full" />
          <div>
            <h2 className="text-2xl font-semibold text-cream-100">Director Name</h2>
            <p className="text-cream-500/60">Level 5 • 2,450 XP</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// src/pages/Settings.jsx
export function Settings() {
  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-4xl font-display font-bold text-gradient mb-4">Settings</h1>
        <p className="text-cream-300">Manage your account and preferences</p>
      </motion.div>

      <div className="card p-6">
        <h3 className="text-lg font-semibold text-cream-100 mb-4">Account Settings</h3>
        <div className="space-y-4">
          <div>
            <label className="label">Email Notifications</label>
            <input type="checkbox" className="checkbox" defaultChecked />
          </div>
        </div>
      </div>
    </div>
  );
}

// src/pages/HowToPlay.jsx
export function HowToPlay() {
  return (
    <div className="min-h-screen bg-gradient-main py-12">
      <div className="container-responsive">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-4xl font-display font-bold text-gradient mb-8">How to Play</h1>
          
          <div className="card p-8 space-y-6">
            <div>
              <h2 className="text-2xl font-semibold text-cream-100 mb-3">Getting Started</h2>
              <p className="text-cream-300">Welcome to marching.art, the ultimate fantasy drum corps game!</p>
            </div>

            <div>
              <h3 className="text-xl font-semibold text-cream-100 mb-2">1. Create Your Corps</h3>
              <p className="text-cream-300">Register your fantasy drum corps with a unique name and location.</p>
            </div>

            <div>
              <h3 className="text-xl font-semibold text-cream-100 mb-2">2. Select Captions</h3>
              <p className="text-cream-300">Choose 8 captions from 25 available historical corps performances.</p>
            </div>

            <div>
              <h3 className="text-xl font-semibold text-cream-100 mb-2">3. Compete & Win</h3>
              <p className="text-cream-300">Track your scores and compete for championships!</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// src/pages/HallOfChampions.jsx
export function HallOfChampions() {
  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="text-center">
          <h1 className="text-5xl font-display font-bold text-gradient mb-4">Hall of Champions</h1>
          <p className="text-xl text-cream-300">Celebrating excellence in fantasy drum corps</p>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[2024, 2023, 2022].map((year, index) => (
          <motion.div
            key={year}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.1 }}
            className="card-premium text-center p-6"
          >
            <div className="w-16 h-16 bg-gradient-gold rounded-full mx-auto mb-4 flex items-center justify-center">
              <span className="text-2xl font-bold text-charcoal-900">{year}</span>
            </div>
            <h3 className="text-xl font-semibold text-cream-100">Champion Corps</h3>
            <p className="text-cream-500/60 mt-2">Score: 98.75</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}