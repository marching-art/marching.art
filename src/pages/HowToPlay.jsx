// src/pages/HowToPlay.jsx
import React from 'react';
import { motion } from 'framer-motion';

const HowToPlay = () => {
  return (
    <div className="min-h-screen bg-gradient-main py-12">
      <div className="container-responsive">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-4xl font-display font-bold text-gradient mb-8">How to Play</h1>
          
          <div className="card p-8 space-y-6">
            <div>
              <h2 className="text-2xl font-semibold text-cream-100 mb-3">Getting Started</h2>
              <p className="text-cream-300">Welcome to marching.art!</p>
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
};

export default HowToPlay;
