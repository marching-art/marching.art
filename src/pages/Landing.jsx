// src/pages/Landing.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Trophy, Users, Star, ArrowRight
} from 'lucide-react';

const Landing = () => {
  const features = [
    {
      icon: Trophy,
      title: 'Compete & Win',
      description: 'Build your fantasy drum corps and compete with real DCI scores',
      color: 'text-gold-500'
    },
    {
      icon: Users,
      title: 'Join Leagues',
      description: 'Create or join leagues with friends for bragging rights',
      color: 'text-cream-400'
    },
    {
      icon: Star,
      title: 'Level Up',
      description: 'Earn XP and unlock new corps classes as you progress',
      color: 'text-gold-400'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-main">
      {/* Navigation Bar */}
      <nav className="fixed top-0 left-0 right-0 bg-charcoal-950/80 backdrop-blur-lg border-b border-cream-500/10 z-40">
        <div className="container-responsive py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg overflow-hidden flex items-center justify-center">
                <img src="/logo192.png" alt="marching.art logo" className="w-full h-full object-cover" />
              </div>
              <h1 className="text-lg sm:text-2xl font-display font-bold text-gradient">
                marching.art
              </h1>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <Link to="/login" className="btn-ghost text-sm sm:text-base px-2 sm:px-4">
                Sign In
              </Link>
              <Link to="/register" className="btn-primary text-sm sm:text-base px-3 sm:px-4">
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Spacer for fixed nav */}
      <div className="h-16 sm:h-20" />

      {/* Hero Section */}
      <section className="relative overflow-hidden py-12 sm:py-20 lg:py-32">
        {/* Background Effects */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-10 w-48 sm:w-72 h-48 sm:h-72 bg-gold-500/20 rounded-full blur-3xl animate-float" />
          <div className="absolute bottom-20 right-10 w-64 sm:w-96 h-64 sm:h-96 bg-cream-500/20 rounded-full blur-3xl animate-float"
               style={{ animationDelay: '2s' }} />
        </div>

        <div className="container-responsive relative z-10 px-4">
          <div className="max-w-3xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              {/* Main Headline */}
              <h1 className="text-4xl sm:text-5xl md:text-7xl font-display font-bold mb-4 sm:mb-6">
                <span className="text-gradient">Fantasy</span>
                <br />
                <span className="text-cream-100">Drum Corps</span>
              </h1>

              {/* Subheadline */}
              <p className="text-lg sm:text-xl md:text-2xl text-cream-300 mb-8 sm:mb-12 leading-relaxed px-4 sm:px-0">
                Build your dream corps. Compete with directors worldwide.
              </p>

              {/* CTA Button */}
              <Link to="/register" className="btn-primary text-base sm:text-lg px-6 sm:px-8 py-3 sm:py-4 inline-flex items-center">
                Start Playing Free
                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-2" />
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-12 sm:py-16 relative">
        <div className="container-responsive px-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 max-w-4xl mx-auto">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="card-hover group text-center p-4 sm:p-6"
                >
                  <div className={`${feature.color} mb-3 sm:mb-4 flex justify-center`}>
                    <Icon className="w-6 h-6 sm:w-8 sm:h-8" />
                  </div>
                  <h3 className="text-base sm:text-lg font-semibold text-cream-100 mb-1 sm:mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-cream-500/80 text-xs sm:text-sm">
                    {feature.description}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-6 sm:py-8 border-t border-cream-500/10">
        <div className="container-responsive px-4">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg overflow-hidden flex items-center justify-center">
                <img src="/logo192.png" alt="marching.art logo" className="w-full h-full object-cover" />
              </div>
              <span className="font-display font-bold text-cream-100 text-sm sm:text-base">
                marching.art
              </span>
            </div>
            <p className="text-cream-500/60 text-xs sm:text-sm text-center">
              © 2025 marching.art
            </p>
            <div className="flex gap-4 sm:gap-6">
              <Link to="/privacy" className="text-cream-500/60 hover:text-gold-500 text-xs sm:text-sm transition-colors">
                Privacy
              </Link>
              <Link to="/terms" className="text-cream-500/60 hover:text-gold-500 text-xs sm:text-sm transition-colors">
                Terms
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
