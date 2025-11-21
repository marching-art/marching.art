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
        <div className="container-responsive py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center">
                <img src="/logo192.png" alt="marching.art logo" className="w-full h-full object-cover" />
              </div>
              <h1 className="text-2xl font-display font-bold text-gradient">
                marching.art
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <Link to="/login" className="btn-ghost">
                Sign In
              </Link>
              <Link to="/register" className="btn-primary">
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Spacer for fixed nav */}
      <div className="h-20" />

      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 lg:py-32">
        {/* Background Effects */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-10 w-72 h-72 bg-gold-500/20 rounded-full blur-3xl animate-float" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-cream-500/20 rounded-full blur-3xl animate-float"
               style={{ animationDelay: '2s' }} />
        </div>

        <div className="container-responsive relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              {/* Main Headline */}
              <h1 className="text-5xl md:text-7xl font-display font-bold mb-6">
                <span className="text-gradient">Fantasy</span>
                <br />
                <span className="text-cream-100">Drum Corps</span>
              </h1>

              {/* Subheadline */}
              <p className="text-xl md:text-2xl text-cream-300 mb-12 leading-relaxed">
                Build your dream corps. Compete with directors worldwide.
              </p>

              {/* CTA Button */}
              <Link to="/register" className="btn-primary text-lg px-8 py-4 inline-flex items-center">
                Start Playing Free
                <ArrowRight className="w-5 h-5 ml-2" />
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 relative">
        <div className="container-responsive">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="card-hover group text-center"
                >
                  <div className={`${feature.color} mb-4 flex justify-center`}>
                    <Icon className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-semibold text-cream-100 mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-cream-500/80 text-sm">
                    {feature.description}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-cream-500/10">
        <div className="container-responsive">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center">
                <img src="/logo192.png" alt="marching.art logo" className="w-full h-full object-cover" />
              </div>
              <span className="font-display font-bold text-cream-100">
                marching.art
              </span>
            </div>
            <p className="text-cream-500/60 text-sm text-center">
              © 2025 marching.art
            </p>
            <div className="flex gap-6">
              <a href="/privacy" className="text-cream-500/60 hover:text-gold-500 text-sm transition-colors">
                Privacy
              </a>
              <a href="/terms" className="text-cream-500/60 hover:text-gold-500 text-sm transition-colors">
                Terms
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
