import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Trophy, 
  Users, 
  BarChart3, 
  Calendar, 
  Settings, 
  HelpCircle,
  Mail,
  Twitter,
  Github,
  Heart,
  Crown,
  Star,
  Zap
} from 'lucide-react';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  const footerSections = [
    {
      title: "Game",
      links: [
        { label: "Dashboard", href: "/dashboard", icon: <Crown className="w-4 h-4" /> },
        { label: "Leaderboard", href: "/leaderboard", icon: <Trophy className="w-4 h-4" /> },
        { label: "Leagues", href: "/leagues", icon: <Users className="w-4 h-4" /> },
        { label: "Scores", href: "/scores", icon: <BarChart3 className="w-4 h-4" /> },
        { label: "Schedule", href: "/schedule", icon: <Calendar className="w-4 h-4" /> },
      ]
    },
    {
      title: "Help & Support",
      links: [
        { label: "How to Play", href: "/how-to-play", icon: <HelpCircle className="w-4 h-4" /> },
        { label: "Settings", href: "/settings", icon: <Settings className="w-4 h-4" /> },
        { label: "Contact Us", href: "/contact", icon: <Mail className="w-4 h-4" /> },
        { label: "FAQ", href: "/faq", icon: <Star className="w-4 h-4" /> },
      ]
    },
    {
      title: "Community",
      links: [
        { label: "Discord", href: "https://discord.gg/marching-art", icon: <Users className="w-4 h-4" />, external: true },
        { label: "Twitter", href: "https://twitter.com/marching_art", icon: <Twitter className="w-4 h-4" />, external: true },
        { label: "GitHub", href: "https://github.com/marching-art", icon: <Github className="w-4 h-4" />, external: true },
        { label: "Hall of Fame", href: "/hall-of-fame", icon: <Crown className="w-4 h-4" /> },
      ]
    }
  ];

  const stats = [
    { label: "Active Players", value: "2,500+", icon: <Users className="w-5 h-5" /> },
    { label: "Total Seasons", value: "15", icon: <Trophy className="w-5 h-5" /> },
    { label: "Competitions", value: "450+", icon: <Star className="w-5 h-5" /> },
    { label: "Fantasy Corps", value: "10,000+", icon: <Zap className="w-5 h-5" /> }
  ];

  return (
    <footer className="bg-surface-dark border-t border-accent-dark/20 mt-auto">
      {/* Main Footer Content */}
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Brand Section */}
          <div className="lg:col-span-1">
            <div className="flex items-center gap-3 mb-6">
              <img 
                src="/logo192.png" 
                alt="marching.art logo" 
                className="w-12 h-12 rounded-xl shadow-lg"
              />
              <div>
                <h3 className="text-2xl font-bold text-gradient-primary">marching.art</h3>
                <p className="text-sm text-text-secondary-dark">The Ultimate Fantasy Drum Corps Game</p>
              </div>
            </div>
            
            <p className="text-text-secondary-dark mb-6 leading-relaxed">
              Experience the thrill of building and managing your dream drum corps. 
              Compete with friends, climb the leaderboards, and become a legend in the marching arts.
            </p>

            {/* Social Links */}
            <div className="flex gap-3">
              <a 
                href="https://twitter.com/marching_art" 
                target="_blank" 
                rel="noopener noreferrer"
                className="btn-icon group"
              >
                <Twitter className="w-5 h-5 text-text-secondary-dark group-hover:text-blue-400 transition-colors" />
              </a>
              <a 
                href="https://discord.gg/marching-art" 
                target="_blank" 
                rel="noopener noreferrer"
                className="btn-icon group"
              >
                <Users className="w-5 h-5 text-text-secondary-dark group-hover:text-indigo-400 transition-colors" />
              </a>
              <a 
                href="https://github.com/marching-art" 
                target="_blank" 
                rel="noopener noreferrer"
                className="btn-icon group"
              >
                <Github className="w-5 h-5 text-text-secondary-dark group-hover:text-gray-300 transition-colors" />
              </a>
            </div>
          </div>

          {/* Navigation Sections */}
          {footerSections.map((section, index) => (
            <div key={index} className="lg:col-span-1">
              <h4 className="text-lg font-semibold text-text-primary-dark mb-4">{section.title}</h4>
              <ul className="space-y-3">
                {section.links.map((link, linkIndex) => (
                  <li key={linkIndex}>
                    {link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-text-secondary-dark hover:text-primary-dark transition-colors duration-200 group"
                      >
                        <span className="group-hover:scale-110 transition-transform duration-200">
                          {link.icon}
                        </span>
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        to={link.href}
                        className="flex items-center gap-2 text-text-secondary-dark hover:text-primary-dark transition-colors duration-200 group"
                      >
                        <span className="group-hover:scale-110 transition-transform duration-200">
                          {link.icon}
                        </span>
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Stats Section */}
        <div className="mt-12 pt-8 border-t border-accent-dark/20">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((stat, index) => (
              <div key={index} className="text-center group">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-primary/10 rounded-full mb-3 group-hover:scale-110 transition-transform duration-300">
                  <div className="text-primary-dark">
                    {stat.icon}
                  </div>
                </div>
                <div className="text-2xl font-bold text-text-primary-dark mb-1">{stat.value}</div>
                <div className="text-sm text-text-secondary-dark">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Newsletter Signup */}
        <div className="mt-12 pt-8 border-t border-accent-dark/20">
          <div className="max-w-md mx-auto text-center">
            <h4 className="text-lg font-semibold text-text-primary-dark mb-3 flex items-center justify-center gap-2">
              <Mail className="w-5 h-5 text-primary-dark" />
              Stay Updated
            </h4>
            <p className="text-text-secondary-dark mb-4">
              Get notified about new features, season updates, and special events.
            </p>
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="Enter your email"
                className="input-field flex-1"
              />
              <button className="btn-primary px-6">
                Subscribe
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-accent-dark/20 bg-background-dark/50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2 text-text-secondary-dark">
              <span>&copy; {currentYear} marching.art</span>
              <span className="hidden md:inline">•</span>
              <span className="flex items-center gap-1">
                Made with <Heart className="w-4 h-4 text-red-500 animate-pulse" /> for the marching arts community
              </span>
            </div>

            {/* Legal Links */}
            <div className="flex items-center gap-4 text-sm">
              <Link 
                to="/privacy" 
                className="text-text-secondary-dark hover:text-primary-dark transition-colors"
              >
                Privacy Policy
              </Link>
              <Link 
                to="/terms" 
                className="text-text-secondary-dark hover:text-primary-dark transition-colors"
              >
                Terms of Service
              </Link>
              <Link 
                to="/cookies" 
                className="text-text-secondary-dark hover:text-primary-dark transition-colors"
              >
                Cookie Policy
              </Link>
            </div>
          </div>

          {/* Season Info */}
          <div className="mt-4 pt-4 border-t border-accent-dark/10 text-center">
            <div className="inline-flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-full">
              <Crown className="w-4 h-4 text-primary-dark" />
              <span className="text-sm font-medium text-primary-dark">
                Season 2025 • Week {Math.ceil((new Date() - new Date('2025-06-01')) / (7 * 24 * 60 * 60 * 1000))} Active
              </span>
              <Zap className="w-4 h-4 text-primary-dark animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;