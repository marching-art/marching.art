// =============================================================================
// LANDING PAGE - ESPN LOGIN PORTAL
// =============================================================================
// A gate, not a brochure. Two-column split with live scoreboard preview.
// Laws: No marketing fluff, no parallax, no testimonials

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, Lock, Mail, ArrowRight, AlertCircle } from 'lucide-react';
import { useAuth } from '../App';
import toast from 'react-hot-toast';

// =============================================================================
// DUMMY SCOREBOARD DATA
// =============================================================================

const LIVE_SCORES = [
  { rank: 1, corps: 'Blue Devils', score: 97.850, ge: 19.70, visual: 19.55, music: 38.60, change: '+0.2' },
  { rank: 2, corps: 'Bluecoats', score: 96.425, ge: 19.45, visual: 19.20, music: 37.78, change: '+0.4' },
  { rank: 3, corps: 'Carolina Crown', score: 95.900, ge: 19.30, visual: 19.10, music: 37.50, change: '-0.1' },
  { rank: 4, corps: 'Santa Clara Vanguard', score: 95.275, ge: 19.15, visual: 19.00, music: 37.13, change: '+0.3' },
  { rank: 5, corps: 'The Cadets', score: 94.650, ge: 18.95, visual: 18.85, music: 36.85, change: '—' },
  { rank: 6, corps: 'Boston Crusaders', score: 93.800, ge: 18.80, visual: 18.60, music: 36.40, change: '+0.5' },
  { rank: 7, corps: 'Phantom Regiment', score: 92.150, ge: 18.50, visual: 18.30, music: 35.35, change: '-0.2' },
  { rank: 8, corps: 'Blue Knights', score: 91.425, ge: 18.35, visual: 18.10, music: 34.98, change: '+0.1' },
];

// =============================================================================
// LANDING PAGE COMPONENT
// =============================================================================

const Landing = () => {
  const { signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
      toast.success('Welcome back!');
    } catch (err) {
      console.error('Login error:', err);
      switch (err.code) {
        case 'auth/user-not-found':
          setError('No account found with this email');
          break;
        case 'auth/wrong-password':
          setError('Incorrect password');
          break;
        case 'auth/invalid-email':
          setError('Invalid email address');
          break;
        case 'auth/too-many-requests':
          setError('Too many attempts. Try again later');
          break;
        default:
          setError('Failed to sign in. Please try again');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
      {/* TOP BAR */}
      <div className="h-12 bg-[#1a1a1a] border-b border-[#333] flex items-center px-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-sm overflow-hidden">
            <img src="/logo192.webp" alt="marching.art" className="w-full h-full object-cover" />
          </div>
          <span className="text-sm font-bold text-white uppercase tracking-wider">
            marching.art
          </span>
        </div>
        <div className="ml-auto flex items-center gap-4">
          <Link to="/privacy" className="text-xs text-gray-500 hover:text-gray-300">
            Privacy
          </Link>
          <Link to="/terms" className="text-xs text-gray-500 hover:text-gray-300">
            Terms
          </Link>
        </div>
      </div>

      {/* MAIN CONTENT - Two Column Split */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2">
        {/* LEFT COLUMN - Live Scoreboard Preview */}
        <div className="bg-[#0a0a0a] border-r border-[#333] p-6 lg:p-8 flex flex-col">
          {/* Brand Header */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="w-5 h-5 text-[#0057B8]" />
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                Live Scores
              </span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-bold text-white uppercase tracking-wide">
              Fantasy Drum Corps
            </h1>
            <h2 className="text-lg lg:text-xl font-bold text-[#0057B8]">
              2025 Season
            </h2>
            <p className="text-sm text-gray-500 mt-2">
              The season starts now.
            </p>
          </div>

          {/* Live Scoreboard - Simple Static Table */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="bg-[#1a1a1a] border border-[#333] flex-1 flex flex-col overflow-hidden">
              {/* Scoreboard Header */}
              <div className="bg-[#222] px-3 py-2 border-b border-[#333] flex items-center justify-between">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  World Class Standings
                </span>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-[10px] text-green-500 font-bold uppercase">Live</span>
                </div>
              </div>

              {/* Static Table */}
              <div className="flex-1 overflow-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-[#1a1a1a] border-b border-[#333]">
                      <th className="px-2 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider text-left w-10">RK</th>
                      <th className="px-2 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider text-left">Corps</th>
                      <th className="px-2 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider text-right w-14">GE</th>
                      <th className="px-2 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider text-right w-14">VIS</th>
                      <th className="px-2 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider text-right w-14">MUS</th>
                      <th className="px-2 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider text-right w-16">Total</th>
                      <th className="px-2 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider text-center w-12">+/-</th>
                    </tr>
                  </thead>
                  <tbody>
                    {LIVE_SCORES.map((row, idx) => (
                      <tr
                        key={row.rank}
                        className={`border-b border-[#333]/50 h-10 ${idx % 2 === 1 ? 'bg-white/[0.02]' : ''}`}
                      >
                        <td className="px-2 py-1">
                          <span className="inline-flex items-center justify-center w-6 h-6 bg-[#222] text-xs font-bold text-gray-400 tabular-nums">
                            {row.rank}
                          </span>
                        </td>
                        <td className="px-2 py-1 text-sm text-white font-medium">{row.corps}</td>
                        <td className="px-2 py-1 text-xs text-gray-400 tabular-nums text-right">{row.ge.toFixed(3)}</td>
                        <td className="px-2 py-1 text-xs text-gray-400 tabular-nums text-right">{row.visual.toFixed(3)}</td>
                        <td className="px-2 py-1 text-xs text-gray-400 tabular-nums text-right">{row.music.toFixed(3)}</td>
                        <td className="px-2 py-1 text-sm text-white font-bold tabular-nums text-right">{row.score.toFixed(3)}</td>
                        <td className="px-2 py-1 text-center">
                          <span className={`text-xs tabular-nums ${
                            row.change.startsWith('+') ? 'text-green-500' :
                            row.change.startsWith('-') ? 'text-red-500' : 'text-gray-500'
                          }`}>
                            {row.change}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Stats Strip */}
            <div className="mt-4 grid grid-cols-3 gap-px bg-[#333]">
              <div className="bg-[#1a1a1a] p-3 text-center">
                <div className="text-lg font-bold text-white tabular-nums">2,847</div>
                <div className="text-[10px] text-gray-500 uppercase">Directors</div>
              </div>
              <div className="bg-[#1a1a1a] p-3 text-center">
                <div className="text-lg font-bold text-white tabular-nums">156</div>
                <div className="text-[10px] text-gray-500 uppercase">Leagues</div>
              </div>
              <div className="bg-[#1a1a1a] p-3 text-center">
                <div className="text-lg font-bold text-white tabular-nums">Week 4</div>
                <div className="text-[10px] text-gray-500 uppercase">Current</div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN - Login Box */}
        <div className="bg-[#111] flex items-center justify-center p-6 lg:p-8">
          <div className="w-full max-w-sm">
            {/* Login Card */}
            <div className="bg-[#1a1a1a] border border-[#333] rounded-sm">
              {/* Card Header */}
              <div className="bg-[#222] px-4 py-3 border-b border-[#333]">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Director Login
                </h3>
              </div>

              {/* Card Body */}
              <form onSubmit={handleSubmit} className="p-4 space-y-4">
                {/* Error Message */}
                {error && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-sm flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-red-300">{error}</p>
                  </div>
                )}

                {/* Email Input */}
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      type="email"
                      placeholder="director@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={loading}
                      className="w-full h-10 pl-10 pr-4 bg-[#0a0a0a] border border-[#333] rounded-sm text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0057B8] disabled:opacity-50"
                    />
                  </div>
                </div>

                {/* Password Input */}
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={loading}
                      className="w-full h-10 pl-10 pr-4 bg-[#0a0a0a] border border-[#333] rounded-sm text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0057B8] disabled:opacity-50"
                    />
                  </div>
                </div>

                {/* Sign In Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-10 bg-[#0057B8] text-white font-bold text-sm uppercase tracking-wider flex items-center justify-center hover:bg-[#0066d6] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    'Signing in...'
                  ) : (
                    <>
                      Sign In
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </button>

                {/* Divider */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-[#333]" />
                  <span className="text-[10px] text-gray-500 uppercase">or</span>
                  <div className="flex-1 h-px bg-[#333]" />
                </div>

                {/* Register Link */}
                <Link
                  to="/register"
                  className="w-full h-10 border border-[#333] text-gray-400 font-bold text-sm uppercase tracking-wider flex items-center justify-center hover:border-[#444] hover:text-white transition-colors"
                >
                  Create Account
                </Link>
              </form>

              {/* Card Footer */}
              <div className="px-4 py-3 border-t border-[#333] bg-[#1a1a1a]/50">
                <Link to="/forgot-password" className="text-xs text-gray-500 hover:text-[#0057B8]">
                  Forgot password?
                </Link>
              </div>
            </div>

            {/* Footer Note */}
            <p className="mt-4 text-center text-[10px] text-gray-600">
              Free to play. No credit card required.
            </p>
          </div>
        </div>
      </div>

      {/* BOTTOM BAR */}
      <div className="h-8 bg-[#1a1a1a] border-t border-[#333] flex items-center justify-center">
        <span className="text-[10px] text-gray-600">
          © 2025 marching.art — Fantasy Sports for the Marching Arts
        </span>
      </div>
    </div>
  );
};

export default Landing;
