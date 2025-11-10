// src/pages/HallOfChampions.jsx
import React from 'react';
import { motion } from 'framer-motion';
import { Trophy, Crown, Medal, Award } from 'lucide-react';

const HallOfChampions = () => {
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
};

export default HallOfChampions;
