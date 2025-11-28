// src/pages/Landing.jsx
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy, Users, Star, ArrowRight, Target, Calendar,
  Wrench, Music, Shield, Flag, ChevronDown, Play,
  Zap, TrendingUp, Award, Clock, Sparkles
} from 'lucide-react';

const Landing = () => {
  const [expandedFaq, setExpandedFaq] = useState(null);

  const features = [
    {
      icon: Flag,
      title: 'Build Your Corps',
      description: 'Create and manage your own fantasy drum corps from the ground up',
      color: 'text-gold-500'
    },
    {
      icon: Target,
      title: 'Daily Management',
      description: 'Run rehearsals, manage staff, maintain equipment, and keep morale high',
      color: 'text-blue-400'
    },
    {
      icon: Trophy,
      title: 'Compete & Win',
      description: 'Watch your corps perform and climb the leaderboards against other directors',
      color: 'text-purple-400'
    }
  ];

  const howItWorks = [
    {
      step: 1,
      icon: Flag,
      title: 'Create Your Corps',
      description: 'Name your drum corps and choose a show concept. Start in SoundSport and work your way up to World Class.',
      color: 'from-green-500/20 to-green-600/10'
    },
    {
      step: 2,
      icon: Users,
      title: 'Build Your Staff',
      description: 'Hire legendary instructors from drum corps history. Each staff member brings unique expertise to your program.',
      color: 'from-blue-500/20 to-blue-600/10'
    },
    {
      step: 3,
      icon: Calendar,
      title: 'Manage Daily Operations',
      description: 'Run rehearsals, check on your members, maintain equipment, and prepare your show for competition.',
      color: 'from-purple-500/20 to-purple-600/10'
    },
    {
      step: 4,
      icon: Star,
      title: 'Compete & Progress',
      description: 'Your corps performs at shows throughout the season. Earn XP, CorpsCoin, and unlock higher competition classes.',
      color: 'from-gold-500/20 to-gold-600/10'
    }
  ];

  const dailyActivities = [
    { icon: Target, name: 'Rehearsal', description: 'Improve readiness' },
    { icon: Users, name: 'Staff Meeting', description: 'Coordinate with instructors' },
    { icon: Wrench, name: 'Equipment Check', description: 'Maintain your gear' },
    { icon: Shield, name: 'Member Morale', description: 'Keep members happy' },
    { icon: Music, name: 'Show Review', description: 'Analyze performance' },
  ];

  const competitionClasses = [
    { name: 'SoundSport', color: 'bg-green-500', description: 'Entry level - Free to start' },
    { name: 'A Class', color: 'bg-blue-500', description: 'Intermediate competition' },
    { name: 'Open Class', color: 'bg-purple-500', description: 'Advanced division' },
    { name: 'World Class', color: 'bg-gold-500', description: 'Elite competition' },
  ];

  const faqs = [
    {
      question: 'Is this game free to play?',
      answer: 'Yes! You can play entirely for free. Start with a SoundSport corps and earn CorpsCoin through gameplay to unlock higher competition classes. Optional Battle Pass available for extra rewards.'
    },
    {
      question: 'How do I improve my corps?',
      answer: 'Daily activities are key! Run rehearsals to improve readiness, hire staff to boost your scoring potential, maintain equipment, and keep member morale high. Consistency pays off!'
    },
    {
      question: 'What are CorpsCoin used for?',
      answer: 'CorpsCoin is the in-game currency earned from performances. Use it to unlock new competition classes, hire staff, repair and upgrade equipment, and boost morale when needed.'
    },
    {
      question: 'Can I compete against friends?',
      answer: 'Absolutely! Create or join leagues to compete head-to-head with other directors. Trade staff, chat, and see who can build the best corps.'
    },
    {
      question: 'How does scoring work?',
      answer: 'Scores are based on DCI scoring sheets, influenced by your staff expertise, show difficulty, equipment condition, member readiness, and morale. Higher preparation = better scores!'
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
                <img src="/logo192.webp" alt="marching.art logo" className="w-full h-full object-cover" />
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
      <section className="relative overflow-hidden py-12 sm:py-20 lg:py-28">
        {/* Background Effects */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-10 w-48 sm:w-72 h-48 sm:h-72 bg-gold-500/20 rounded-full blur-3xl animate-float" />
          <div className="absolute bottom-20 right-10 w-64 sm:w-96 h-64 sm:h-96 bg-cream-500/20 rounded-full blur-3xl animate-float"
               style={{ animationDelay: '2s' }} />
        </div>

        <div className="container-responsive relative z-10 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gold-500/10 border border-gold-500/30 mb-6">
                <Sparkles className="w-4 h-4 text-gold-500" />
                <span className="text-sm text-gold-400 font-medium">The Fantasy Sports Game for Marching Arts</span>
              </div>

              {/* Main Headline */}
              <h1 className="text-4xl sm:text-5xl md:text-7xl font-display font-bold mb-4 sm:mb-6">
                <span className="text-gradient">Build Your Dream</span>
                <br />
                <span className="text-cream-100">Drum Corps</span>
              </h1>

              {/* Subheadline */}
              <p className="text-lg sm:text-xl md:text-2xl text-cream-300 mb-8 sm:mb-10 leading-relaxed px-4 sm:px-0 max-w-2xl mx-auto">
                Manage daily operations, hire legendary staff, compete against directors worldwide, and lead your corps to championship glory.
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <Link to="/register" className="btn-primary text-base sm:text-lg px-6 sm:px-8 py-3 sm:py-4 inline-flex items-center w-full sm:w-auto justify-center">
                  <Play className="w-5 h-5 mr-2" />
                  Start Playing Free
                </Link>
                <a href="#how-it-works" className="btn-ghost text-base sm:text-lg px-6 sm:px-8 py-3 sm:py-4 inline-flex items-center w-full sm:w-auto justify-center">
                  Learn How It Works
                  <ArrowRight className="w-5 h-5 ml-2" />
                </a>
              </div>

              {/* Quick Stats */}
              <div className="mt-12 grid grid-cols-3 gap-4 max-w-lg mx-auto">
                <div className="text-center">
                  <div className="text-2xl sm:text-3xl font-bold text-gold-500">Free</div>
                  <div className="text-xs sm:text-sm text-cream-500/60">to Play</div>
                </div>
                <div className="text-center border-x border-cream-500/10">
                  <div className="text-2xl sm:text-3xl font-bold text-cream-100">4</div>
                  <div className="text-xs sm:text-sm text-cream-500/60">Classes to Unlock</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl sm:text-3xl font-bold text-cream-100">Daily</div>
                  <div className="text-xs sm:text-sm text-cream-500/60">Competitions</div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Quick Features Section */}
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
                    <div className="p-3 rounded-xl bg-charcoal-800/50">
                      <Icon className="w-6 h-6 sm:w-8 sm:h-8" />
                    </div>
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

      {/* How It Works Section */}
      <section id="how-it-works" className="py-16 sm:py-24 bg-charcoal-900/50">
        <div className="container-responsive px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl sm:text-4xl font-display font-bold text-cream-100 mb-4">
              How It Works
            </h2>
            <p className="text-cream-400 max-w-2xl mx-auto">
              Step into the shoes of a drum corps director. Every decision you make impacts your corps' success.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {howItWorks.map((item, index) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className={`relative glass rounded-2xl p-6 overflow-hidden`}
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${item.color} opacity-50`} />
                  <div className="relative z-10">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-charcoal-800 flex items-center justify-center">
                        <span className="text-2xl font-bold text-gold-500">{item.step}</span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Icon className="w-5 h-5 text-cream-300" />
                          <h3 className="text-lg font-semibold text-cream-100">{item.title}</h3>
                        </div>
                        <p className="text-cream-400 text-sm">{item.description}</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Daily Activities Section */}
      <section className="py-16 sm:py-24">
        <div className="container-responsive px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl sm:text-4xl font-display font-bold text-cream-100 mb-4">
              A Day in the Life
            </h2>
            <p className="text-cream-400 max-w-2xl mx-auto">
              Every day brings new opportunities to improve your corps. Here's what successful directors do:
            </p>
          </motion.div>

          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4">
              {dailyActivities.map((activity, index) => {
                const Icon = activity.icon;
                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.05 }}
                    className="glass rounded-xl p-4 text-center hover:border-gold-500/30 transition-all"
                  >
                    <div className="w-10 h-10 rounded-lg bg-gold-500/10 flex items-center justify-center mx-auto mb-2">
                      <Icon className="w-5 h-5 text-gold-500" />
                    </div>
                    <h4 className="text-sm font-semibold text-cream-100 mb-1">{activity.name}</h4>
                    <p className="text-xs text-cream-500/60">{activity.description}</p>
                  </motion.div>
                );
              })}
            </div>

            {/* Rewards callout */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="mt-8 glass-premium rounded-xl p-6 border border-gold-500/20"
            >
              <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
                <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-gradient-to-br from-gold-500/20 to-yellow-500/20 flex items-center justify-center">
                  <Zap className="w-7 h-7 text-gold-500" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-cream-100 mb-1">Earn XP & CorpsCoin Daily</h3>
                  <p className="text-cream-400 text-sm">Complete daily activities to earn rewards. Build streaks for bonus XP. Level up to unlock new competition classes!</p>
                </div>
                <div className="flex gap-4">
                  <div className="text-center">
                    <div className="text-xl font-bold text-blue-400">+XP</div>
                    <div className="text-xs text-cream-500/60">Experience</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-gold-500">+CC</div>
                    <div className="text-xs text-cream-500/60">CorpsCoin</div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Competition Classes Section */}
      <section className="py-16 sm:py-24 bg-charcoal-900/50">
        <div className="container-responsive px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl sm:text-4xl font-display font-bold text-cream-100 mb-4">
              Rise Through the Ranks
            </h2>
            <p className="text-cream-400 max-w-2xl mx-auto">
              Start in SoundSport and climb your way to World Class. Each class offers new challenges and bigger rewards.
            </p>
          </motion.div>

          <div className="flex flex-col sm:flex-row gap-4 max-w-4xl mx-auto items-stretch">
            {competitionClasses.map((classItem, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="flex-1 glass rounded-xl p-4 sm:p-6 text-center relative overflow-hidden"
              >
                <div className={`absolute top-0 left-0 right-0 h-1 ${classItem.color}`} />
                <div className="flex items-center justify-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-cream-500/60" />
                  <span className="text-xs text-cream-500/60 uppercase tracking-wider">Level {index + 1}</span>
                </div>
                <h3 className="text-lg font-semibold text-cream-100 mb-1">{classItem.name}</h3>
                <p className="text-xs text-cream-400">{classItem.description}</p>
                {index === 0 && (
                  <div className="mt-3 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/20 text-green-400 text-xs">
                    <Sparkles className="w-3 h-3" />
                    Start Here
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 sm:py-24">
        <div className="container-responsive px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl sm:text-4xl font-display font-bold text-cream-100 mb-4">
              Frequently Asked Questions
            </h2>
          </motion.div>

          <div className="max-w-2xl mx-auto space-y-3">
            {faqs.map((faq, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
                className="glass rounded-xl overflow-hidden"
              >
                <button
                  onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                  className="w-full p-4 flex items-center justify-between text-left hover:bg-cream-500/5 transition-colors"
                >
                  <span className="font-semibold text-cream-100 pr-4">{faq.question}</span>
                  <ChevronDown className={`w-5 h-5 text-cream-500/60 transition-transform flex-shrink-0 ${
                    expandedFaq === index ? 'rotate-180' : ''
                  }`} />
                </button>
                <AnimatePresence>
                  {expandedFaq === index && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 text-cream-400 text-sm">
                        {faq.answer}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-16 sm:py-24 bg-gradient-to-b from-charcoal-900/50 to-charcoal-950">
        <div className="container-responsive px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-3xl mx-auto text-center"
          >
            <Award className="w-12 h-12 text-gold-500 mx-auto mb-6" />
            <h2 className="text-3xl sm:text-4xl font-display font-bold text-cream-100 mb-4">
              Ready to Lead Your Corps to Glory?
            </h2>
            <p className="text-cream-400 mb-8 max-w-xl mx-auto">
              Join thousands of directors building their dream corps. Free to play, no credit card required.
            </p>
            <Link to="/register" className="btn-primary text-lg px-8 py-4 inline-flex items-center">
              <Play className="w-5 h-5 mr-2" />
              Start Your Journey
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-6 sm:py-8 border-t border-cream-500/10">
        <div className="container-responsive px-4">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg overflow-hidden flex items-center justify-center">
                <img src="/logo192.webp" alt="marching.art logo" className="w-full h-full object-cover" loading="lazy" />
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
