import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Play, 
  Trophy, 
  Users, 
  BarChart3, 
  Star, 
  ArrowRight, 
  Sparkles,
  Crown,
  Zap,
  Target,
  Calendar,
  Award,
  TrendingUp,
  ChevronDown,
  Music,
  Shield,
  Flame
} from 'lucide-react';

const HomePage = () => {
  const { currentUser } = useAuth();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % 3);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const heroSlides = [
    {
      title: "Master the Art of Fantasy Drum Corps",
      subtitle: "Build your dream corps and compete against the best",
      accent: "🎺",
      gradient: "from-purple-600 to-pink-600"
    },
    {
      title: "Strategic Team Building",
      subtitle: "Choose from 25 elite DCI corps across 8 captions",
      accent: "🏆",
      gradient: "from-blue-600 to-cyan-600"
    },
    {
      title: "Compete in Live Seasons",
      subtitle: "Real DCI scores power your fantasy competition",
      accent: "⚡",
      gradient: "from-orange-600 to-red-600"
    }
  ];

  const features = [
    {
      icon: <Crown className="w-8 h-8" />,
      title: "Four Competition Classes",
      description: "Progress from SoundSport to World Class as you gain experience and unlock new challenges.",
      gradient: "from-purple-500 to-pink-500"
    },
    {
      icon: <Users className="w-8 h-8" />,
      title: "Strategic Caption Selection",
      description: "Build your perfect lineup across 8 captions: GE1, GE2, Visual, Color Guard, Brass, Music, and Percussion.",
      gradient: "from-blue-500 to-cyan-500"
    },
    {
      icon: <Award className="w-8 h-8" />,
      title: "Hall of Fame Staff",
      description: "Hire legendary DCI staff members to boost your corps' performance and gain competitive advantages.",
      gradient: "from-green-500 to-emerald-500"
    },
    {
      icon: <BarChart3 className="w-8 h-8" />,
      title: "Real DCI Data",
      description: "Your fantasy scores are based on actual DCI performances, creating authentic competition dynamics.",
      gradient: "from-orange-500 to-red-500"
    },
    {
      icon: <Trophy className="w-8 h-8" />,
      title: "League Competition",
      description: "Join leagues with friends and compete for seasonal championships and bragging rights.",
      gradient: "from-yellow-500 to-amber-500"
    },
    {
      icon: <TrendingUp className="w-8 h-8" />,
      title: "Performance Analytics",
      description: "Deep dive into score analysis and historical data to optimize your strategy and dominate.",
      gradient: "from-indigo-500 to-purple-500"
    }
  ];

  const gameplayHighlights = [
    {
      week: "Weeks 1-7",
      title: "Off-Season Competition",
      description: "Build your corps and compete in up to 4 shows per week",
      icon: <Calendar className="w-6 h-6" />,
      color: "text-blue-500"
    },
    {
      week: "Week 8",
      title: "Regional Championships",
      description: "Prove your worth in elite regional competitions",
      icon: <Shield className="w-6 h-6" />,
      color: "text-purple-500"
    },
    {
      week: "Weeks 9-10",
      title: "DCI Championships",
      description: "The ultimate test - compete for the title in Indianapolis",
      icon: <Crown className="w-6 h-6" />,
      color: "text-gold-500"
    }
  ];

  const stats = [
    { label: "Active Players", value: "2,500+", icon: <Users className="w-5 h-5" /> },
    { label: "Corps Available", value: "25", icon: <Star className="w-5 h-5" /> },
    { label: "Seasons Completed", value: "15", icon: <Trophy className="w-5 h-5" /> },
    { label: "Total Competitions", value: "450+", icon: <Target className="w-5 h-5" /> }
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section with Carousel */}
      <section className="relative overflow-hidden bg-gradient-to-br from-background-dark via-surface-dark to-background-dark min-h-screen flex items-center">
        {/* Animated Background */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse"></div>
          <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-secondary rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse animation-delay-2000"></div>
          <div className="absolute bottom-1/4 left-1/2 w-96 h-96 bg-accent rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse animation-delay-4000"></div>
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-6xl mx-auto">
            {/* Hero Content */}
            <div className={`text-center transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
              <div className="text-8xl mb-6 animate-pulse">
                {heroSlides[currentSlide].accent}
              </div>
              
              <h1 className="text-5xl md:text-7xl font-bold text-gradient-primary mb-6 leading-tight">
                {heroSlides[currentSlide].title}
              </h1>
              
              <p className="text-xl md:text-2xl text-text-secondary-dark mb-8 max-w-3xl mx-auto">
                {heroSlides[currentSlide].subtitle}
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
                {currentUser ? (
                  <Link to="/dashboard" className="btn-primary-glow text-lg px-8 py-4 inline-flex items-center gap-3">
                    <Play className="w-6 h-6" />
                    Enter Dashboard
                    <ArrowRight className="w-5 h-5" />
                  </Link>
                ) : (
                  <button className="btn-primary-glow text-lg px-8 py-4 inline-flex items-center gap-3">
                    <Play className="w-6 h-6" />
                    Start Playing Free
                    <ArrowRight className="w-5 h-5" />
                  </button>
                )}
                
                <Link to="/leaderboard" className="btn-ghost text-lg px-8 py-4 inline-flex items-center gap-3">
                  <Trophy className="w-6 h-6" />
                  View Leaderboard
                </Link>
              </div>

              {/* Slide Indicators */}
              <div className="flex justify-center gap-2">
                {heroSlides.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentSlide(index)}
                    className={`w-3 h-3 rounded-full transition-all duration-300 ${
                      currentSlide === index ? 'bg-primary-dark scale-125' : 'bg-accent-dark/50 hover:bg-accent-dark'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
          <ChevronDown className="w-8 h-8 text-text-secondary-dark" />
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-surface-dark">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center group">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-4 group-hover:scale-110 transition-transform duration-300">
                  <div className="text-primary-dark">
                    {stat.icon}
                  </div>
                </div>
                <div className="text-3xl font-bold text-text-primary-dark mb-2">{stat.value}</div>
                <div className="text-text-secondary-dark">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-background-dark">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gradient-primary mb-6">
              The Ultimate Fantasy Experience
            </h2>
            <p className="text-xl text-text-secondary-dark max-w-3xl mx-auto">
              Experience the thrill of building and managing your dream drum corps with features designed for both casual fans and competitive strategists.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="card-glow p-8 text-center group hover:scale-105 transition-all duration-300">
                <div className={`inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r ${feature.gradient} rounded-full mb-6 group-hover:rotate-12 transition-transform duration-300`}>
                  <div className="text-white">
                    {feature.icon}
                  </div>
                </div>
                <h3 className="text-xl font-bold text-text-primary-dark mb-4">{feature.title}</h3>
                <p className="text-text-secondary-dark leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Gameplay Timeline */}
      <section className="py-20 bg-surface-dark">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-text-primary-dark mb-6">
              Season Structure
            </h2>
            <p className="text-xl text-text-secondary-dark max-w-3xl mx-auto">
              Each 10-week season follows the real DCI schedule, culminating in championships in Indianapolis.
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="relative">
              {/* Timeline Line */}
              <div className="absolute left-1/2 transform -translate-x-1/2 h-full w-1 bg-gradient-to-b from-primary via-secondary to-accent rounded-full"></div>

              {gameplayHighlights.map((phase, index) => (
                <div key={index} className={`flex items-center mb-12 ${index % 2 === 0 ? 'flex-row' : 'flex-row-reverse'}`}>
                  <div className={`w-5/12 ${index % 2 === 0 ? 'text-right pr-8' : 'text-left pl-8'}`}>
                    <div className="card p-6">
                      <div className={`inline-flex items-center gap-2 ${phase.color} mb-3`}>
                        {phase.icon}
                        <span className="font-bold">{phase.week}</span>
                      </div>
                      <h3 className="text-xl font-bold text-text-primary-dark mb-2">{phase.title}</h3>
                      <p className="text-text-secondary-dark">{phase.description}</p>
                    </div>
                  </div>
                  
                  {/* Timeline Node */}
                  <div className="relative z-10">
                    <div className={`w-6 h-6 rounded-full border-4 border-white bg-gradient-to-r ${
                      index === 0 ? 'from-blue-500 to-cyan-500' :
                      index === 1 ? 'from-purple-500 to-pink-500' :
                      'from-yellow-500 to-orange-500'
                    } shadow-lg`}></div>
                  </div>
                  
                  <div className="w-5/12"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How to Play Section */}
      <section className="py-20 bg-background-dark">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gradient-primary mb-6">
              How to Play
            </h2>
            <p className="text-xl text-text-secondary-dark max-w-3xl mx-auto">
              Master the art of fantasy drum corps in three simple steps.
            </p>
          </div>

          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center group">
              <div className="relative mb-8">
                <div className="w-24 h-24 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center mx-auto group-hover:scale-110 transition-transform duration-300">
                  <Users className="w-12 h-12 text-white" />
                </div>
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-primary-dark rounded-full flex items-center justify-center text-white font-bold">1</div>
              </div>
              <h3 className="text-xl font-bold text-text-primary-dark mb-4">Build Your Corps</h3>
              <p className="text-text-secondary-dark">Select from 25 DCI corps across 8 captions to create your perfect lineup within your point budget.</p>
            </div>

            <div className="text-center group">
              <div className="relative mb-8">
                <div className="w-24 h-24 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto group-hover:scale-110 transition-transform duration-300">
                  <Calendar className="w-12 h-12 text-white" />
                </div>
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-primary-dark rounded-full flex items-center justify-center text-white font-bold">2</div>
              </div>
              <h3 className="text-xl font-bold text-text-primary-dark mb-4">Compete Weekly</h3>
              <p className="text-text-secondary-dark">Enter up to 4 competitions per week and watch your scores based on real DCI performance data.</p>
            </div>

            <div className="text-center group">
              <div className="relative mb-8">
                <div className="w-24 h-24 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full flex items-center justify-center mx-auto group-hover:scale-110 transition-transform duration-300">
                  <Trophy className="w-12 h-12 text-white" />
                </div>
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-primary-dark rounded-full flex items-center justify-center text-white font-bold">3</div>
              </div>
              <h3 className="text-xl font-bold text-text-primary-dark mb-4">Win Championships</h3>
              <p className="text-text-secondary-dark">Rise through the ranks and compete for the ultimate prize at the DCI World Championships.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Community Section */}
      <section className="py-20 bg-surface-dark">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <div className="flex justify-center gap-4 mb-8">
              <Flame className="w-12 h-12 text-orange-500 animate-pulse" />
              <Users className="w-12 h-12 text-blue-500 animate-pulse animation-delay-1000" />
              <Star className="w-12 h-12 text-yellow-500 animate-pulse animation-delay-2000" />
            </div>
            
            <h2 className="text-4xl md:text-5xl font-bold text-text-primary-dark mb-6">
              Join the Community
            </h2>
            <p className="text-xl text-text-secondary-dark mb-8 max-w-3xl mx-auto">
              Connect with fellow drum corps enthusiasts, join competitive leagues, and share your passion for the marching arts.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
              <div className="card p-6 text-center">
                <div className="text-4xl mb-4">🏆</div>
                <h3 className="font-bold text-text-primary-dark mb-2">Competitive Leagues</h3>
                <p className="text-text-secondary-dark text-sm">Join leagues with friends and compete for bragging rights</p>
              </div>
              
              <div className="card p-6 text-center">
                <div className="text-4xl mb-4">💬</div>
                <h3 className="font-bold text-text-primary-dark mb-2">Active Chat</h3>
                <p className="text-text-secondary-dark text-sm">Discuss strategy and share your passion</p>
              </div>
              
              <div className="card p-6 text-center">
                <div className="text-4xl mb-4">📊</div>
                <h3 className="font-bold text-text-primary-dark mb-2">Detailed Stats</h3>
                <p className="text-text-secondary-dark text-sm">Track your progress with comprehensive analytics</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/leagues" className="btn-secondary text-lg px-8 py-4 inline-flex items-center gap-3">
                <Users className="w-6 h-6" />
                Browse Leagues
              </Link>
              
              <Link to="/leaderboard" className="btn-ghost text-lg px-8 py-4 inline-flex items-center gap-3">
                <BarChart3 className="w-6 h-6" />
                View Rankings
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-20 bg-gradient-to-r from-primary/20 via-secondary/20 to-accent/20">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-4xl mx-auto">
            <div className="text-6xl mb-6">🎺</div>
            <h2 className="text-4xl md:text-6xl font-bold text-gradient-primary mb-6">
              Ready to March?
            </h2>
            <p className="text-xl text-text-secondary-dark mb-8 max-w-2xl mx-auto">
              Join thousands of drum corps fans in the ultimate fantasy competition. Your journey to championship glory starts now.
            </p>
            
            {currentUser ? (
              <Link to="/dashboard" className="btn-primary-glow text-xl px-12 py-6 inline-flex items-center gap-4">
                <Crown className="w-8 h-8" />
                Continue Your Journey
                <Sparkles className="w-6 h-6" />
              </Link>
            ) : (
              <button className="btn-primary-glow text-xl px-12 py-6 inline-flex items-center gap-4">
                <Crown className="w-8 h-8" />
                Start Your Legacy
                <Sparkles className="w-6 h-6" />
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;