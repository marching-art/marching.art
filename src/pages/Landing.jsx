// src/pages/Landing.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Music, Trophy, Users, Star, ArrowRight, Zap, 
  Target, TrendingUp, Award, Shield, Sparkles,
  ChevronRight, PlayCircle
} from 'lucide-react';

const Landing = () => {
  const features = [
    {
      icon: Trophy,
      title: 'Compete & Win',
      description: 'Build your fantasy drum corps and compete in live seasons with real DCI scores',
      color: 'text-gold-500'
    },
    {
      icon: Users,
      title: 'Join Leagues',
      description: 'Create or join leagues with friends and compete for ultimate bragging rights',
      color: 'text-cream-400'
    },
    {
      icon: Star,
      title: 'Level Up',
      description: 'Earn XP, unlock new classes, and progress from SoundSport to World Class',
      color: 'text-gold-400'
    },
    {
      icon: Zap,
      title: 'Real-Time Scoring',
      description: 'Track your corps performance with live updates during the DCI season',
      color: 'text-yellow-400'
    },
    {
      icon: Target,
      title: 'Strategic Gameplay',
      description: 'Select the perfect caption lineup from 25 historical corps performances',
      color: 'text-cream-300'
    },
    {
      icon: Award,
      title: 'Hall of Champions',
      description: 'Cement your legacy and join the elite directors in our Hall of Fame',
      color: 'text-gold-300'
    }
  ];

  const stats = [
    { value: '10,000+', label: 'Active Directors' },
    { value: '500+', label: 'Active Leagues' },
    { value: '25', label: 'Historical Corps' },
    { value: '10', label: 'Week Seasons' }
  ];

  return (
    <div className="min-h-screen bg-gradient-main">
      {/* Navigation Bar */}
      <nav className="fixed top-0 left-0 right-0 bg-charcoal-950/80 backdrop-blur-lg border-b border-cream-500/10 z-40">
        <div className="container-responsive py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-gold rounded-lg flex items-center justify-center">
                <Music className="w-6 h-6 text-charcoal-900" />
              </div>
              <h1 className="text-2xl font-display font-bold text-gradient">
                marching.art
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <Link to="/how-to-play" className="nav-link hidden md:inline-block">
                How to Play
              </Link>
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
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-gold-500/20 border border-gold-500/30 rounded-full mb-8">
                <Sparkles className="w-4 h-4 text-gold-500" />
                <span className="text-sm font-semibold text-gold-300">
                  2025 Live Season Now Active
                </span>
              </div>

              {/* Main Headline */}
              <h1 className="text-5xl md:text-7xl font-display font-bold mb-6">
                <span className="text-gradient">The Ultimate</span>
                <br />
                <span className="text-cream-100">Fantasy Drum Corps Game</span>
              </h1>

              {/* Subheadline */}
              <p className="text-xl md:text-2xl text-cream-300 mb-12 leading-relaxed">
                Build your dream corps. Select legendary captions. 
                <br className="hidden md:block" />
                Compete with directors worldwide.
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link to="/register" className="btn-primary text-lg px-8 py-4">
                  Start Playing Free
                  <ArrowRight className="w-5 h-5 ml-2 inline" />
                </Link>
                <button className="btn-outline text-lg px-8 py-4">
                  <PlayCircle className="w-5 h-5 mr-2 inline" />
                  Watch Demo
                </button>
              </div>
            </motion.div>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-20"
            >
              {stats.map((stat, index) => (
                <div key={index} className="text-center">
                  <p className="text-3xl md:text-4xl font-bold text-gradient">
                    {stat.value}
                  </p>
                  <p className="text-sm text-cream-500/60 mt-1">
                    {stat.label}
                  </p>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 relative">
        <div className="container-responsive">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-display font-bold text-cream-100 mb-4">
              Everything You Need to 
              <span className="text-gradient"> Dominate</span>
            </h2>
            <p className="text-xl text-cream-300">
              Professional tools and features for the serious fantasy corps director
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="card-hover group"
                >
                  <div className={`${feature.color} mb-4 group-hover:scale-110 transition-transform`}>
                    <Icon className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-semibold text-cream-100 mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-cream-500/80">
                    {feature.description}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-gradient-to-b from-transparent to-charcoal-950/50">
        <div className="container-responsive">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-display font-bold text-cream-100 mb-4">
              How It Works
            </h2>
            <p className="text-xl text-cream-300">
              Get started in three simple steps
            </p>
          </motion.div>

          <div className="max-w-4xl mx-auto">
            {[
              {
                step: '01',
                title: 'Create Your Corps',
                description: 'Register your fantasy drum corps with a unique name, location, and show concept'
              },
              {
                step: '02',
                title: 'Select Your Captions',
                description: 'Choose 8 captions from 25 available historical corps performances'
              },
              {
                step: '03',
                title: 'Compete & Win',
                description: 'Track your scores in real-time and compete for championships'
              }
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: index % 2 === 0 ? -50 : 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.2 }}
                className="flex items-center gap-6 mb-12"
              >
                <div className="flex-shrink-0 w-20 h-20 bg-gradient-gold rounded-2xl flex items-center justify-center">
                  <span className="text-2xl font-bold text-charcoal-900">
                    {item.step}
                  </span>
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-semibold text-cream-100 mb-2">
                    {item.title}
                  </h3>
                  <p className="text-cream-300">
                    {item.description}
                  </p>
                </div>
                {index < 2 && (
                  <ChevronRight className="w-6 h-6 text-cream-500/40 hidden lg:block" />
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container-responsive">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative overflow-hidden rounded-3xl"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-gold-500/20 to-cream-500/20" />
            <div className="relative glass p-12 md:p-20 text-center">
              <h2 className="text-4xl md:text-5xl font-display font-bold text-cream-100 mb-6">
                Ready to Lead Your Corps to 
                <span className="text-gradient"> Victory?</span>
              </h2>
              <p className="text-xl text-cream-300 mb-8 max-w-2xl mx-auto">
                Join thousands of directors competing in the most immersive 
                fantasy drum corps experience ever created
              </p>
              <Link to="/register" className="btn-primary text-lg px-10 py-4">
                Create Your Corps Now
                <ArrowRight className="w-5 h-5 ml-2 inline" />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-cream-500/10">
        <div className="container-responsive">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-gold rounded-lg flex items-center justify-center">
                <Music className="w-5 h-5 text-charcoal-900" />
              </div>
              <span className="font-display font-bold text-cream-100">
                marching.art
              </span>
            </div>
            <p className="text-cream-500/60 text-sm text-center">
              © 2025 marching.art - The Ultimate Fantasy Drum Corps Game
            </p>
            <div className="flex gap-6">
              <a href="/privacy" className="text-cream-500/60 hover:text-gold-500 text-sm transition-colors">
                Privacy
              </a>
              <a href="/terms" className="text-cream-500/60 hover:text-gold-500 text-sm transition-colors">
                Terms
              </a>
              <a href="/support" className="text-cream-500/60 hover:text-gold-500 text-sm transition-colors">
                Support
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
