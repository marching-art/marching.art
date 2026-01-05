// src/pages/NotFound.jsx
// Enhanced 404 Page with tactical/diegetic styling
import React, { startTransition } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, ArrowLeft, Search, AlertTriangle } from 'lucide-react';
import { useShouldReduceMotion } from '../hooks/useReducedMotion';

const NotFound = () => {
  const navigate = useNavigate();
  const shouldReduceMotion = useShouldReduceMotion();

  return (
    <div className="min-h-screen bg-charcoal-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0">
        {/* Grid Pattern */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(234, 179, 8, 0.5) 1px, transparent 1px),
              linear-gradient(90deg, rgba(234, 179, 8, 0.5) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px',
          }}
        />
        {/* Radial Gradient */}
        <div className="absolute inset-0 bg-gradient-radial from-transparent via-transparent to-charcoal-950" />
      </div>

      {/* Giant Watermark */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden">
        <span
          className="font-display font-black text-cream/[0.02] uppercase leading-none whitespace-nowrap"
          style={{ fontSize: 'clamp(8rem, 30vw, 20rem)' }}
        >
          404
        </span>
      </div>

      {/* Scanning Line - skip on mobile */}
      {!shouldReduceMotion && (
        <motion.div
          className="absolute inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-red-500/40 to-transparent pointer-events-none"
          initial={{ top: '10%' }}
          animate={{ top: ['10%', '90%', '10%'] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
        />
      )}

      {/* Corner Decorations */}
      <div className="absolute top-8 left-8 w-16 h-16 border-l-2 border-t-2 border-red-500/30" />
      <div className="absolute top-8 right-8 w-16 h-16 border-r-2 border-t-2 border-red-500/30" />
      <div className="absolute bottom-8 left-8 w-16 h-16 border-l-2 border-b-2 border-red-500/30" />
      <div className="absolute bottom-8 right-8 w-16 h-16 border-r-2 border-b-2 border-red-500/30" />

      {/* Main Content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 text-center max-w-lg mx-auto"
      >
        {/* Status Badge */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-full mb-6"
        >
          <AlertTriangle className="w-4 h-4 text-red-400" />
          <span className="text-xs font-mono text-red-400 uppercase tracking-widest">System Error</span>
        </motion.div>

        {/* 404 Number */}
        <motion.h1
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 100 }}
          className="text-8xl sm:text-9xl font-display font-black text-transparent bg-clip-text bg-gradient-to-b from-cream via-cream/80 to-cream/20 mb-4"
        >
          404
        </motion.h1>

        {/* Error Title */}
        <motion.h2
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-xl sm:text-2xl font-display font-bold text-cream mb-2 uppercase tracking-wide"
        >
          Route Not Found
        </motion.h2>

        {/* Description */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-cream/60 mb-8 font-mono text-sm"
        >
          The requested page doesn't exist or has been moved.
          <br className="hidden sm:block" />
          Let's get you back on track.
        </motion.p>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="flex flex-col sm:flex-row gap-3 justify-center"
        >
          <button
            onClick={() => startTransition(() => navigate(-1))}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-charcoal-800 border border-cream/20 rounded-lg text-cream font-display font-semibold hover:bg-charcoal-700 hover:border-cream/30 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gold-500 text-charcoal-900 rounded-lg font-display font-bold uppercase hover:bg-gold-400 transition-colors shadow-[0_0_15px_rgba(234,179,8,0.2)]"
          >
            <Home className="w-4 h-4" />
            Return Home
          </Link>
        </motion.div>

        {/* Quick Links */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-10 pt-6 border-t border-cream/10"
        >
          <p className="text-xs text-cream/40 mb-3 font-mono uppercase tracking-wider">Quick Links</p>
          <div className="flex flex-wrap gap-2 justify-center">
            <Link
              to="/dashboard"
              className="px-3 py-1.5 text-xs text-cream/60 hover:text-cream bg-charcoal-900 hover:bg-charcoal-800 rounded border border-cream/10 hover:border-cream/20 transition-all"
            >
              Dashboard
            </Link>
            <Link
              to="/schedule"
              className="px-3 py-1.5 text-xs text-cream/60 hover:text-cream bg-charcoal-900 hover:bg-charcoal-800 rounded border border-cream/10 hover:border-cream/20 transition-all"
            >
              Schedule
            </Link>
            <Link
              to="/scores"
              className="px-3 py-1.5 text-xs text-cream/60 hover:text-cream bg-charcoal-900 hover:bg-charcoal-800 rounded border border-cream/10 hover:border-cream/20 transition-all"
            >
              Scores
            </Link>
            <Link
              to="/leagues"
              className="px-3 py-1.5 text-xs text-cream/60 hover:text-cream bg-charcoal-900 hover:bg-charcoal-800 rounded border border-cream/10 hover:border-cream/20 transition-all"
            >
              Leagues
            </Link>
          </div>
        </motion.div>

        {/* Technical Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="mt-8 flex items-center justify-center gap-4 text-[9px] font-mono text-cream/20 uppercase tracking-widest"
        >
          <span>Error: ENOENT</span>
          <span className="text-red-500/40">|</span>
          <span>Route: {window.location.pathname}</span>
          <span className="text-red-500/40">|</span>
          <span>Status: 404</span>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default NotFound;
