// src/pages/Hub.jsx
import React from 'react';
import { motion } from 'framer-motion';
import { Users, Plus, Trophy, } from 'lucide-react';

const Hub = () => {
  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-4xl font-display font-bold text-gradient mb-4">League Hub</h1>
        <p className="text-cream-300">Connect, compete, and collaborate with other directors</p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
          <div className="card-hover text-center p-8">
            <Plus className="w-12 h-12 text-gold-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-cream-100 mb-2">Create League</h3>
            <p className="text-cream-500/60">Start your own private or public league</p>
            <button className="btn-primary mt-4">Create Now</button>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
          <div className="card-hover text-center p-8">
            <Users className="w-12 h-12 text-cream-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-cream-100 mb-2">Join League</h3>
            <p className="text-cream-500/60">Find and join existing leagues</p>
            <button className="btn-outline mt-4">Browse Leagues</button>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
          <div className="card-hover text-center p-8">
            <Trophy className="w-12 h-12 text-gold-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-cream-100 mb-2">My Leagues</h3>
            <p className="text-cream-500/60">Manage your active leagues</p>
            <button className="btn-ghost mt-4">View All</button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Hub;
