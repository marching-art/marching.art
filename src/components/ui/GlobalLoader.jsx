import React from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import Card from './Card';

const GlobalLoader = () => (
  <div className="flex items-center justify-center h-screen bg-background">
    <div className="flex flex-col items-center space-y-4">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ ease: "linear", duration: 1, repeat: Infinity }}
      >
        <Loader2 className="w-12 h-12 text-primary" />
      </motion.div>
      <p className="text-text-secondary">Loading Director Profile...</p>
    </div>
  </div>
);

export default GlobalLoader;