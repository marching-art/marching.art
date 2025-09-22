// pages/HomePage.js - Enhanced Homepage for Ultimate Fantasy Drum Corps Game
import React, { useState, useEffect, useRef } from 'react';
import { motion, useScroll, useTransform, useInView, AnimatePresence } from 'framer-motion';
import { useUserStore } from '../store/userStore';
import { firebaseUtils } from '../firebase';

// Enhanced Feature Card Component
const FeatureCard = ({ title, accentText, icon, children, delay = 0, gradient = false }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 50, scale: 0.95 }}
      animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
      transition={{ duration: 0.6, delay, ease: "easeOut" }}
      className={`group relative overflow-hidden rounded-2xl p-8 transition-all duration-500 hover:scale-105 cursor-pointer ${
        gradient 
          ? 'bg-gradient-to-br from-primary/10 to-secondary/10 dark:from-primary-dark/10 dark:to-secondary-dark/10' 
          : 'bg-surface dark:bg-surface-dark'
      } border border-accent dark:border-accent-dark hover:border-primary dark:hover:border-primary-dark shadow-lg hover:shadow-2xl`}
      whileHover={{ y: -5 }}
    >
      {/* Animated background */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-secondary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      {/* Icon with animation */}
      <motion.div 
        className="relative z-10"
        whileHover={{ rotate: 5, scale: 1.1 }}
        transition={{ type: "spring", stiffness: 300 }}
      >
        <div className="flex items-center mb-4">
          <div className="text-primary dark:text-primary-dark mr-3">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
            </svg>
          </div>
          <span className="text-sm font-semibold text-secondary dark:text-secondary-dark bg-secondary/10 dark:bg-secondary-dark/10 px-3 py-1 rounded-full">
            {accentText}
          </span>
        </div>
        
        <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-3 group-hover:text-primary dark:group-hover:text-primary-dark transition-colors">
          {title}
        </h3>
        
        <p className="text-text-secondary dark:text-text-secondary-dark group-hover:text-text-primary dark:group-hover:text-text-primary-dark transition-colors">
          {children}
        </p>
      </motion.div>
      
      {/* Hover effect overlay */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full -translate-y-16 translate-x-16 group-hover:scale-150 transition-transform duration-700" />
    </motion.div>
  );
};

// Enhanced Testimonial Component
const TestimonialCard = ({ name, title, quote, avatar, delay = 0 }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, x: -50 }}
      animate={isInView ? { opacity: 1, x: 0 } : {}}
      transition={{ duration: 0.6, delay }}
      className="bg-surface dark:bg-surface-dark p-8 rounded-2xl border border-accent dark:border-accent-dark shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
    >
      <div className="flex items-center mb-4">
        <div className="w-12 h-12 bg-gradient-to-r from-primary to-secondary dark:from-primary-dark dark:to-secondary-dark rounded-full flex items-center justify-center text-white font-bold text-lg mr-4">
          {avatar}
        </div>
        <div>
          <h4 className="font-semibold text-text-primary dark:text-text-primary-dark">{name}</h4>
          <p className="text-sm text-text-secondary dark:text-text-secondary-dark">{title}</p>
        </div>
      </div>
      <blockquote className="text-text-primary dark:text-text-primary-dark italic">
        "{quote}"
      </blockquote>
    </motion.div>
  );
};

// Enhanced Statistics Counter
const StatCounter = ({ value, label, suffix = "", prefix = "" }) => {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (isInView) {
      const duration = 2000;
      const steps = 60;
      const increment = value / steps;
      let current = 0;

      const timer = setInterval(() => {
        current += increment;
        if (current >= value) {
          setCount(value);
          clearInterval(timer);
        } else {
          setCount(Math.floor(current));
        }
      }, duration / steps);

      return () => clearInterval(timer);
    }
  }, [isInView, value]);

  return (
    <div ref={ref} className="text-center">
      <motion.div
        initial={{ scale: 0 }}
        animate={isInView ? { scale: 1 } : {}}
        transition={{ type: "spring", stiffness: 100, delay: 0.2 }}
        className="text-4xl md:text-5xl font-bold text-primary dark:text-primary-dark mb-2"
      >
        {prefix}{count.toLocaleString()}{suffix}
      </motion.div>
      <div className="text-text-secondary dark:text-text-secondary-dark font-medium">
        {label}
      </div>
    </div>
  );
};

// Enhanced Community Card
const CommunityCard = () => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      className="relative bg-gradient-to-br from-primary to-secondary dark:from-primary-dark dark:to-secondary-dark rounded-2xl p-8 text-white overflow-hidden"
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      whileHover={{ scale: 1.05 }}
      transition={{ type: "spring", stiffness: 300 }}
    >
      {/* Animated background elements */}
      <motion.div
        className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full"
        animate={{ rotate: isHovered ? 180 : 0 }}
        transition={{ duration: 2 }}
      />
      <motion.div
        className="absolute -bottom-10 -left-10 w-32 h-32 bg-white/5 rounded-full"
        animate={{ scale: isHovered ? 1.2 : 1 }}
        transition={{ duration: 1 }}
      />
      
      <div className="relative z-10">
        <h3 className="text-2xl font-bold mb-4">Join Our Community</h3>
        <p className="text-white/90 mb-6">
          Connect with thousands of drum corps fans, share strategies, and compete in leagues with friends from around the world.
        </p>
        
        <div className="grid grid-cols-3 gap-4 mb-6">
          <StatCounter value={12500} label="Active Players" suffix="+" />
          <StatCounter value={850} label="Daily Lineups" suffix="+" />
          <StatCounter value={450} label="Leagues" suffix="+" />
        </div>
        
        <motion.button
          className="bg-white text-primary font-semibold px-6 py-3 rounded-xl hover:bg-gray-100 transition-colors"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          Join Now - It's Free! 🎺
        </motion.button>
      </div>
    </motion.div>
  );
};

// Main HomePage Component
const HomePage = ({ onLoginClick, onSignUpClick }) => {
  const { logUserActivity } = useUserStore();
  const [isVisible, setIsVisible] = useState(false);
  const heroRef = useRef(null);
  const { scrollY } = useScroll();
  const y1 = useTransform(scrollY, [0, 300], [0, 100]);
  const y2 = useTransform(scrollY, [0, 300], [0, -100]);

  useEffect(() => {
    setIsVisible(true);
    
    // Track page view
    firebaseUtils.trackEvent('page_view', {
      page: 'homepage',
      timestamp: new Date().toISOString()
    });
  }, []);

  const features = [
    {
      title: "Real-Time Scoring",
      accentText: "🔥 Live Updates",
      icon: "M13 10V3L4 14h7v7l9-11h-7z",
      description: "Experience the thrill of live competition with real-time scoring updates. Your fantasy points reflect actual DCI performance data.",
      delay: 0
    },
    {
      title: "Staff Trading System",
      accentText: "⭐ Hall of Fame",
      icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 715.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 919.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0z",
      description: "Hire legendary DCI Hall of Fame staff members to boost your corps' performance. Each staff member provides unique multipliers.",
      delay: 0.1
    },
    {
      title: "Historical Deep Dive",
      accentText: "📊 50+ Years",
      icon: "M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z",
      description: "Access comprehensive data spanning over 50 years of DCI history. Build lineups from legendary performers across all eras.",
      delay: 0.2
    },
    {
      title: "Advanced Analytics",
      accentText: "🤖 AI Powered",
      icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
      description: "Get AI-powered lineup recommendations, performance predictions, and strategic insights to dominate your leagues.",
      delay: 0.3
    },
    {
      title: "Class Progression",
      accentText: "🏆 Unlock Elite",
      icon: "M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z",
      description: "Start in A Class and work your way up to World Class. Unlock new features, performers, and challenges as you progress.",
      delay: 0.4
    },
    {
      title: "Social Leagues",
      accentText: "🌟 Compete",
      icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 715.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 919.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0z",
      description: "Create or join leagues with friends. Weekly head-to-head matchups, season-long competitions, and championship tournaments.",
      delay: 0.5
    }
  ];

  const testimonials = [
    {
      name: "Sarah M.",
      title: "League Champion 2024",
      quote: "The most engaging fantasy sports experience I've ever had. The historical data integration is incredible!",
      avatar: "SM",
      delay: 0
    },
    {
      name: "Mike R.",
      title: "DCI Alumni",
      quote: "As someone who marched for 4 years, this game captures the essence of what makes drum corps special.",
      avatar: "MR",
      delay: 0.2
    },
    {
      name: "Jessica L.",
      title: "Community Manager",
      quote: "The staff trading system adds such a unique strategic element. I love building my dream instructional team!",
      avatar: "JL",
      delay: 0.4
    }
  ];

  const premiumFeatures = [
    "🔮 AI Lineup Optimizer",
    "📈 Advanced Performance Analytics", 
    "⚡ Priority Trade Processing",
    "🎯 Exclusive Staff Members",
    "📊 Detailed Opponent Scouting",
    "🏆 Premium League Features",
    "🎨 Custom Corps Branding",
    "📱 Mobile App Access"
  ];

  return (
    <div className="relative overflow-hidden">
      {/* Enhanced Hero Section */}
      <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Dynamic Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-background via-primary/5 to-secondary/5 dark:from-background-dark dark:via-primary-dark/5 dark:to-secondary-dark/5" />
        
        {/* Animated elements */}
        <motion.div 
          style={{ y: y1 }}
          className="absolute top-20 left-10 w-32 h-32 bg-primary/10 rounded-full blur-xl"
        />
        <motion.div 
          style={{ y: y2 }}
          className="absolute bottom-20 right-10 w-24 h-24 bg-secondary/10 rounded-full blur-xl"
        />

        {/* Hero Content */}
        <div className="relative z-20 text-center px-6 max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={isVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
            transition={{ duration: 0.8 }}
          >
            <motion.div
              className="mb-6"
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
            >
              <span className="text-8xl">🎺</span>
            </motion.div>
            
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold text-text-primary dark:text-text-primary-dark tracking-tight mb-6">
              Your Field of 
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary dark:from-primary-dark dark:to-secondary-dark">
                Dreams Awaits
              </span>
            </h1>
            
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={isVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="text-xl md:text-2xl text-text-secondary dark:text-text-secondary-dark mb-8 max-w-4xl mx-auto leading-relaxed"
            >
              Assemble your ultimate drum corps lineup from 50+ years of DCI legends. 
              Hire Hall of Fame staff, compete in leagues, and become the greatest director of all time.
            </motion.p>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="flex flex-col sm:flex-row gap-4 justify-center items-center"
            >
              <motion.button
                onClick={onSignUpClick}
                className="group relative bg-gradient-to-r from-primary to-secondary dark:from-primary-dark dark:to-secondary-dark text-white font-bold py-4 px-8 rounded-2xl text-lg overflow-hidden transition-all duration-300 hover:scale-105 shadow-xl hover:shadow-2xl"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <span className="relative z-10">🚀 Start Your Legacy</span>
                <div className="absolute inset-0 bg-white/20 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300" />
              </motion.button>
              
              <motion.button 
                onClick={onLoginClick}
                className="border-2 border-primary dark:border-primary-dark text-primary dark:text-primary-dark font-semibold py-4 px-8 rounded-2xl text-lg hover:bg-primary hover:text-white dark:hover:bg-primary-dark transition-all duration-300 hover:scale-105"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Sign In →
              </motion.button>
            </motion.div>
            
            {/* Social proof */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={isVisible ? { opacity: 1 } : { opacity: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="mt-12 text-text-secondary dark:text-text-secondary-dark"
            >
              <p className="text-sm mb-4">Trusted by thousands of drum corps fans worldwide</p>
              <div className="flex justify-center items-center space-x-8">
                <StatCounter value={12500} label="" suffix="+ Players" />
                <StatCounter value={850} label="" suffix="+ Daily Lineups" />
                <StatCounter value={450} label="" suffix="+ Active Leagues" />
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Enhanced Features Section */}
      <section className="py-20 bg-surface dark:bg-surface-dark relative">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-6xl font-bold text-text-primary dark:text-text-primary-dark mb-4">
              The Most Complete 
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary dark:from-primary-dark dark:to-secondary-dark">
                {" "}Fantasy Experience
              </span>
            </h2>
            <p className="text-xl text-text-secondary dark:text-text-secondary-dark max-w-3xl mx-auto">
              Features that bring the excitement of drum corps to your fingertips.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
            {features.map((feature, index) => (
              <FeatureCard
                key={feature.title}
                title={feature.title}
                accentText={feature.accentText}
                icon={feature.icon}
                delay={feature.delay}
                gradient={index % 2 === 0}
              >
                {feature.description}
              </FeatureCard>
            ))}
          </div>

          <div className="flex justify-center">
            <CommunityCard />
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 bg-background dark:bg-background-dark">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-text-primary dark:text-text-primary-dark mb-4">
              How It Works
            </h2>
            <p className="text-xl text-text-secondary dark:text-text-secondary-dark">
              Get started in just three simple steps
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Draft Your Corps",
                description: "Select 8 performers across different captions from over 50 years of DCI history. Stay within your point budget to build the perfect lineup.",
                icon: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              },
              {
                step: "02", 
                title: "Hire Your Staff",
                description: "Recruit legendary DCI Hall of Fame staff members to boost your corps' performance. Each staff member provides unique multipliers and strategic advantages.",
                icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 715.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 919.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0z"
              },
              {
                step: "03",
                title: "Compete & Win",
                description: "Join leagues, compete in daily challenges, and climb the rankings. Build your legacy as the greatest fantasy drum corps director of all time.",
                icon: "M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
              }
            ].map((step, index) => (
              <motion.div
                key={step.step}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.2 }}
                className="relative text-center group"
              >
                <motion.div 
                  className="w-16 h-16 bg-gradient-to-r from-primary to-secondary dark:from-primary-dark dark:to-secondary-dark rounded-full flex items-center justify-center text-white font-bold text-xl mx-auto mb-6 shadow-lg"
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  {step.step}
                </motion.div>
                
                <div className="bg-surface dark:bg-surface-dark p-6 rounded-2xl border border-accent dark:border-accent-dark shadow-lg group-hover:shadow-xl transition-all duration-300 hover:scale-105">
                  <div className="text-primary dark:text-primary-dark mb-4">
                    <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={step.icon} />
                    </svg>
                  </div>
                  
                  <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-3">
                    {step.title}
                  </h3>
                  
                  <p className="text-text-secondary dark:text-text-secondary-dark">
                    {step.description}
                  </p>
                </div>
                
                {/* Connecting line */}
                {index < 2 && (
                  <div className="hidden md:block absolute top-8 left-full w-full h-0.5 bg-gradient-to-r from-primary/30 to-secondary/30 transform -translate-y-1/2 z-10" />
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Premium Features Section */}
      <section className="py-20 bg-gradient-to-br from-primary/5 to-secondary/5 dark:from-primary-dark/5 dark:to-secondary-dark/5">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-text-primary dark:text-text-primary-dark mb-4">
              Unlock Premium Power
            </h2>
            <p className="text-xl text-text-secondary dark:text-text-secondary-dark max-w-3xl mx-auto">
              Take your game to the next level with exclusive premium features designed for serious competitors.
            </p>
          </motion.div>

          <div className="max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="bg-gradient-to-br from-primary to-secondary dark:from-primary-dark dark:to-secondary-dark rounded-3xl p-8 md:p-12 text-white relative overflow-hidden"
            >
              {/* Background decorations */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-32 translate-x-32" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-24 -translate-x-24" />
              
              <div className="relative z-10">
                <div className="text-center mb-12">
                  <motion.div
                    animate={{ rotate: [0, 10, -10, 0] }}
                    transition={{ duration: 3, repeat: Infinity }}
                    className="text-6xl mb-4"
                  >
                    👑
                  </motion.div>
                  <h3 className="text-3xl md:text-4xl font-bold mb-4">
                    Premium Director Status
                  </h3>
                  <p className="text-xl text-white/90 max-w-2xl mx-auto">
                    Join the elite ranks of premium directors and access exclusive features that give you the competitive edge.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
                  {premiumFeatures.map((feature, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: index * 0.1 }}
                      className="flex items-center bg-white/10 rounded-xl p-4 backdrop-blur-sm"
                    >
                      <span className="text-lg">{feature}</span>
                    </motion.div>
                  ))}
                </div>

                <div className="text-center">
                  <motion.button
                    className="bg-white text-primary font-bold py-4 px-8 rounded-2xl text-lg hover:bg-gray-100 transition-all duration-300 inline-flex items-center gap-2 shadow-xl"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={onSignUpClick}
                  >
                    <span>🚀 Upgrade to Premium</span>
                  </motion.button>
                  <p className="text-white/80 text-sm mt-4">
                    Free trial • Cancel anytime • Instant access
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 bg-surface dark:bg-surface-dark">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-text-primary dark:text-text-primary-dark mb-4">
              What Directors Are Saying
            </h2>
            <p className="text-xl text-text-secondary dark:text-text-secondary-dark">
              Join thousands of satisfied players worldwide
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <TestimonialCard key={index} {...testimonial} />
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-20 bg-gradient-to-r from-primary to-secondary dark:from-primary-dark dark:to-secondary-dark relative overflow-hidden">
        {/* Background animations */}
        <motion.div
          className="absolute inset-0"
          animate={{
            background: [
              "linear-gradient(45deg, var(--color-primary) 0%, var(--color-secondary) 100%)",
              "linear-gradient(45deg, var(--color-secondary) 0%, var(--color-primary) 100%)",
              "linear-gradient(45deg, var(--color-primary) 0%, var(--color-secondary) 100%)"
            ]
          }}
          transition={{ duration: 8, repeat: Infinity }}
        />
        
        <div className="container mx-auto px-6 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-4xl mx-auto"
          >
            <motion.div
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 4, repeat: Infinity }}
              className="text-8xl mb-6"
            >
              🏆
            </motion.div>
            
            <h2 className="text-4xl md:text-6xl font-bold text-white mb-6">
              Ready to Make History?
            </h2>
            
            <p className="text-xl text-white/90 mb-8 max-w-3xl mx-auto">
              Join the ultimate fantasy drum corps experience. Build your legacy, compete with the best, 
              and become the director you've always dreamed of being.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <motion.button 
                onClick={onSignUpClick}
                className="group relative bg-white text-primary font-bold py-4 px-8 rounded-2xl text-lg overflow-hidden transition-all duration-300 hover:scale-105 shadow-xl hover:shadow-2xl"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <span className="relative z-10 flex items-center gap-2">
                  🎺 Start Your Journey
                </span>
                <div className="absolute inset-0 bg-gray-100 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300" />
              </motion.button>
              
              <motion.button 
                className="border-2 border-white text-white font-semibold py-4 px-8 rounded-2xl text-lg hover:bg-white hover:text-primary transition-all duration-300 hover:scale-105"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Learn More →
              </motion.button>
            </div>
            
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.5 }}
              className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-3xl mx-auto"
            >
              <div className="text-center">
                <div className="text-3xl font-bold text-white mb-2">Free Forever</div>
                <div className="text-white/80">Start playing today</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-white mb-2">No Downloads</div>
                <div className="text-white/80">Play in your browser</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-white mb-2">Mobile Ready</div>
                <div className="text-white/80">Perfect on any device</div>
              </div>
            </motion.div>
          </motion.div>
        </div>
        
        {/* Floating elements */}
        <motion.div
          className="absolute top-10 left-10 text-4xl"
          animate={{ y: [0, -20, 0] }}
          transition={{ duration: 3, repeat: Infinity }}
        >
          🎺
        </motion.div>
        <motion.div
          className="absolute top-20 right-20 text-3xl"
          animate={{ y: [0, 20, 0] }}
          transition={{ duration: 4, repeat: Infinity, delay: 1 }}
        >
          🥁
        </motion.div>
        <motion.div
          className="absolute bottom-20 left-20 text-3xl"
          animate={{ y: [0, -15, 0] }}
          transition={{ duration: 3.5, repeat: Infinity, delay: 2 }}
        >
          🎭
        </motion.div>
      </section>
    </div>
  );
};

export default HomePage;