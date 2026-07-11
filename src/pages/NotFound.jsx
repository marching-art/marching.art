// src/pages/NotFound.jsx
// 404 page styled to match the ESPN-style professional dark design system:
// charcoal surfaces, ESPN-blue primary actions, no gradients / glow / shadow.
import React, { startTransition } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { m } from 'framer-motion';
import { Home, ArrowLeft, AlertTriangle } from 'lucide-react';
import { useShouldReduceMotion } from '../hooks/useReducedMotion';
import { useSEO } from '../hooks/useSEO';

const NotFound = () => {
  useSEO({ title: 'Page Not Found | marching.art', noindex: true });
  const navigate = useNavigate();
  const shouldReduceMotion = useShouldReduceMotion();

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255, 255, 255, 0.5) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.5) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />

      {/* Giant watermark */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden">
        <span
          className="font-black text-white/[0.03] uppercase leading-none whitespace-nowrap"
          style={{ fontSize: 'clamp(8rem, 30vw, 20rem)' }}
        >
          404
        </span>
      </div>

      {/* Scanning line - skip when reduced motion is requested */}
      {!shouldReduceMotion && (
        <m.div
          className="absolute inset-x-0 h-px bg-[#0057B8]/40 pointer-events-none"
          initial={{ top: '10%' }}
          animate={{ top: ['10%', '90%', '10%'] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
        />
      )}

      {/* Corner decorations */}
      <div className="absolute top-8 left-8 w-16 h-16 border-l-2 border-t-2 border-white/10" />
      <div className="absolute top-8 right-8 w-16 h-16 border-r-2 border-t-2 border-white/10" />
      <div className="absolute bottom-8 left-8 w-16 h-16 border-l-2 border-b-2 border-white/10" />
      <div className="absolute bottom-8 right-8 w-16 h-16 border-r-2 border-b-2 border-white/10" />

      {/* Main content */}
      <m.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 text-center max-w-lg mx-auto"
      >
        {/* Status badge */}
        <m.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-none mb-6"
        >
          <AlertTriangle className="w-4 h-4 text-red-400" />
          <span className="text-xs font-mono text-red-400 uppercase tracking-widest">
            System Error
          </span>
        </m.div>

        {/* 404 number */}
        <m.h1
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 100 }}
          className="text-8xl sm:text-9xl font-black text-white mb-4"
        >
          404
        </m.h1>

        {/* Error title */}
        <m.h2
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-xl sm:text-2xl font-bold text-white mb-2 uppercase tracking-wide"
        >
          Route Not Found
        </m.h2>

        {/* Description */}
        <m.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-gray-400 mb-8 font-mono text-sm"
        >
          The requested page doesn't exist or has been moved.
          <br className="hidden sm:block" />
          Let's get you back on track.
        </m.p>

        {/* Action buttons */}
        <m.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="flex flex-col sm:flex-row gap-3 justify-center"
        >
          <button
            onClick={() => startTransition(() => navigate(-1))}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-transparent border border-white/20 rounded-none text-white font-semibold hover:bg-white/5 hover:border-white/40 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#0057B8] border border-[#0057B8] text-white rounded-none font-semibold uppercase hover:bg-[#0057B8]/90 transition-colors"
          >
            <Home className="w-4 h-4" />
            Return Home
          </Link>
        </m.div>

        {/* Quick links */}
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-10 pt-6 border-t border-[#333]"
        >
          <p className="text-xs text-gray-500 mb-3 font-mono uppercase tracking-wider">
            Quick Links
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            <Link
              to="/dashboard"
              className="px-3 py-1.5 text-xs text-gray-400 hover:text-white bg-[#1a1a1a] hover:bg-[#222] rounded-none border border-[#333] hover:border-[#555] transition-colors"
            >
              Dashboard
            </Link>
            <Link
              to="/schedule"
              className="px-3 py-1.5 text-xs text-gray-400 hover:text-white bg-[#1a1a1a] hover:bg-[#222] rounded-none border border-[#333] hover:border-[#555] transition-colors"
            >
              Schedule
            </Link>
            <Link
              to="/scores"
              className="px-3 py-1.5 text-xs text-gray-400 hover:text-white bg-[#1a1a1a] hover:bg-[#222] rounded-none border border-[#333] hover:border-[#555] transition-colors"
            >
              Scores
            </Link>
            <Link
              to="/leagues"
              className="px-3 py-1.5 text-xs text-gray-400 hover:text-white bg-[#1a1a1a] hover:bg-[#222] rounded-none border border-[#333] hover:border-[#555] transition-colors"
            >
              Leagues
            </Link>
          </div>
        </m.div>

        {/* Technical footer */}
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="mt-8 flex items-center justify-center gap-4 text-[9px] font-mono text-gray-600 uppercase tracking-widest"
        >
          <span>Error: ENOENT</span>
          <span className="text-gray-700">|</span>
          <span>Route: {window.location.pathname}</span>
          <span className="text-gray-700">|</span>
          <span>Status: 404</span>
        </m.div>
      </m.div>
    </div>
  );
};

export default NotFound;
