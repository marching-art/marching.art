// src/pages/Profile.jsx
import React from 'react';
import { motion } from 'framer-motion';
import { User, Trophy, Star, Award } from 'lucide-react';

const Profile = () => {
  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-4xl font-display font-bold text-gradient mb-4">Director Profile</h1>
        <p className="text-cream-300">Your achievements and statistics</p>
      </motion.div>

      <div className="card p-8">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 bg-gradient-cream rounded-full flex items-center justify-center">
            <User className="w-10 h-10 text-charcoal-900" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-cream-100">Director Name</h2>
            <p className="text-cream-500/60">Level 5 • 2,450 XP</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
