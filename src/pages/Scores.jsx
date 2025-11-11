// src/pages/Scores.jsx
import React from 'react';
import { motion } from 'framer-motion';
import { Clock } from 'lucide-react';

const Scores = () => {
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
};

export default Scores;
