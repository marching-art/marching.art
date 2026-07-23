// @ts-nocheck -- grandfathered before checkJs; remove when this file is typed or cleaned up
// =============================================================================
// PODIUM LANDING — SIGNUP / LOGIN PAGE FOCUSED ON THE PODIUM CLASS
// =============================================================================
// A dedicated entry point at /podium, modeled on the index (Landing) auth
// widget but built entirely around the Podium Class director-sim gameplay.
// Two-column on desktop: gameplay pitch on the left, sign-in / create-account
// card on the right. Authenticated users are bounced to the dashboard by the
// route guard in App.jsx, so this page only ever renders for signed-out
// visitors. Content is distilled from docs/PODIUM.md and mirrors
// the public /podium-guide.

import React, { useState, startTransition } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { m } from 'framer-motion';
import { Heading } from '../components/ui';
import {
  Medal,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  AlertCircle,
  ChevronLeft,
  Zap,
  CalendarClock,
  Route as RouteIcon,
  Gauge,
  Trophy,
  BookOpen,
  MessageCircle,
  Play,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { useBodyScroll } from '../hooks/useBodyScroll';
import { useFirstVisit } from '../hooks/useFirstVisit';
import { useSEO } from '../hooks/useSEO';

const GOLD = '#c9a227';

// The gameplay pitch — one line per Podium pillar, drawn from the design doc.
const PILLARS = [
  {
    icon: CalendarClock,
    title: 'A daily director loop',
    body: 'Found a corps and earn every point. Allocate rehearsal blocks across seven sections each day — install content early, clean it late — and watch your show grow the way real shows grow.',
  },
  {
    icon: Gauge,
    title: 'Condition matters',
    body: 'Stamina, morale, food, and rest are live meters. Grind too hard and the corps burns out; a smart rest day before Finals can win it. Money buys margin, never a single point.',
  },
  {
    icon: RouteIcon,
    title: 'Route a real tour',
    body: 'Pick up to 4 shows a week from the same schedule every class uses. Miles cost budget and stamina, southern July heat drains more, and three branded majors anchor everyone’s season.',
  },
  {
    icon: Trophy,
    title: 'Score against history',
    body: 'Your 8 captions land inside the real historical envelope of DCI results for that day. Nightly box-score recaps, the only class that shows all eight captions. No corps ever scores 100.',
  },
  {
    icon: Medal,
    title: 'Climb to Champion Status',
    body: 'Reputation is earned only from results, season over season. Rise A → Open → World Class, develop a staff of lifelong careers, and chase the dozen-season climb to a champion corps.',
  },
];

const PodiumLanding = () => {
  useBodyScroll();
  useSEO({
    title: 'Podium Class | marching.art — Run Your Own Drum Corps',
    description:
      'Join Podium Class on marching.art: found a drum corps, run rehearsals, route a tour, and climb to Champion Status. Free to play — sign in or create your corps.',
    path: '/podium',
  });

  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();
  const { markAsReturning } = useFirstVisit();

  // One card, two modes. Defaults to create-account since /podium is a
  // recruiting surface for new directors, but returning players can toggle.
  const [mode, setMode] = useState('register');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    displayName: '',
    acceptTerms: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isRegister = mode === 'register';

  // Land the director on the Podium tab, not the default fantasy class. The
  // Dashboard restores its active class from `selectedCorps_<uid>` in
  // localStorage and explicitly honors 'podiumClass' even before a Podium
  // corps exists (it renders the founding flow), so writing that key here —
  // before we navigate — points sign-in straight at Podium Class.
  const preselectPodium = (uid) => {
    if (!uid) return;
    try {
      localStorage.setItem(`selectedCorps_${uid}`, 'podiumClass');
    } catch {
      // localStorage unavailable (private mode) — the dashboard just falls
      // back to the default tab; sign-in still succeeds.
    }
  };

  const update = (field) => (e) =>
    setFormData((prev) => ({
      ...prev,
      [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value,
    }));

  const switchMode = (next) => {
    setMode(next);
    setError('');
  };

  const validate = () => {
    if (!formData.email || !formData.password) {
      setError('Please fill in all required fields');
      return false;
    }
    if (isRegister) {
      if (!formData.displayName.trim()) {
        setError('Please choose a director name');
        return false;
      }
      if (formData.password.length < 8) {
        setError('Password must be at least 8 characters long');
        return false;
      }
      if (!formData.acceptTerms) {
        setError('You must accept the terms and conditions');
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!validate()) return;

    setLoading(true);
    try {
      if (isRegister) {
        const cred = await signUp(formData.email, formData.password, formData.displayName.trim());
        preselectPodium(cred?.user?.uid);
        markAsReturning();
        toast.success('Corps founded — welcome, Director!');
        startTransition(() => navigate('/onboarding'));
      } else {
        const cred = await signIn(formData.email, formData.password);
        preselectPodium(cred?.user?.uid);
        markAsReturning();
        toast.success('Welcome back!');
        startTransition(() => navigate('/dashboard'));
      }
    } catch (err) {
      console.error('Podium auth error:', err);
      switch (err.code) {
        case 'auth/email-already-in-use':
          setError('An account already exists with this email address');
          break;
        // Email enumeration protection collapses user-not-found and
        // wrong-password into a single invalid-credential error
        case 'auth/invalid-credential':
          setError('Incorrect email or password');
          break;
        case 'auth/invalid-email':
          setError('Invalid email address');
          break;
        case 'auth/weak-password':
          setError('Password is too weak. Please use a stronger password');
          break;
        case 'auth/too-many-requests':
          setError('Too many attempts. Try again later');
          break;
        default:
          setError(
            isRegister
              ? 'Failed to create account. Please try again'
              : 'Failed to sign in. Please try again'
          );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-white flex flex-col">
      {/* HEADER */}
      <header className="flex-shrink-0 h-14 bg-surface-card border-b border-line flex items-center px-4">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-muted hover:text-white active:text-white transition-colors press-feedback min-h-touch px-2 -ml-2"
        >
          <ChevronLeft className="w-5 h-5" />
          <span className="text-sm font-medium">marching.art</span>
        </Link>
        <div className="ml-auto flex items-center gap-1">
          <Link
            to="/podium-guide"
            className="hidden sm:inline-flex items-center gap-1.5 px-2 py-2 min-h-touch text-xs text-muted hover:text-white transition-colors press-feedback"
          >
            <BookOpen className="w-4 h-4" />
            Guide
          </Link>
          <a
            href="https://discord.gg/YvFRJ97A5H"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 text-muted hover:text-[#5865F2] hover:bg-white/10 rounded-none transition-colors press-feedback flex items-center"
            title="Join our Discord"
            aria-label="Join our Discord"
          >
            <MessageCircle className="w-5 h-5" />
          </a>
        </div>
      </header>

      {/* MAIN — document-body scroll (like the index). A nested overflow-y-auto
          here fights the flex column and traps/kills the scroll on tall
          content, so let the page scroll normally. */}
      <main className="flex-1 pb-16">
        <div className="max-w-6xl mx-auto px-4 py-8 lg:py-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
            {/* ============================================================= */}
            {/* PITCH COLUMN */}
            {/* ============================================================= */}
            <div className="lg:col-span-7 order-2 lg:order-1">
              <m.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                {/* Eyebrow */}
                <div className="inline-flex items-center gap-2 px-2.5 py-1 mb-4 border border-line bg-surface-sunken">
                  <Medal className="w-3.5 h-3.5" style={{ color: GOLD }} />
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted">
                    Podium Class
                  </span>
                </div>

                {/* Hero */}
                <Heading level="display" className="leading-[1.05]">
                  Found your corps.
                  <br />
                  <span style={{ color: GOLD }}>Earn every point.</span>
                </Heading>
                <p className="mt-4 text-base lg:text-lg text-muted max-w-xl leading-relaxed">
                  Podium Class is the director&rsquo;s chair. Not fantasy drafting — a full season
                  simulation. You run the rehearsals, route the tour, manage the corps, and every
                  night the recap tells you whether you called it right.
                </p>

                {/* CTA row: primary demo + free-to-play chip. The demo is the
                    "try it out" path the index has (/preview) — a Podium version
                    that needs no signup. */}
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <Link
                    to="/podium/preview"
                    className="inline-flex items-center gap-2 h-11 px-5 text-black font-bold text-sm uppercase tracking-wider active:scale-[0.98] transition-all duration-150 press-feedback-strong rounded-none"
                    style={{ backgroundColor: GOLD }}
                  >
                    <Play className="w-4 h-4" />
                    Try it — no signup
                  </Link>
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded-none">
                    <Zap className="w-4 h-4 text-green-500" />
                    <span className="text-sm font-semibold text-green-400">
                      100% free, always open
                    </span>
                  </span>
                </div>

                {/* Pillars */}
                <div className="mt-8 space-y-4">
                  {PILLARS.map(({ icon: Icon, title, body }) => (
                    <div key={title} className="flex gap-3.5">
                      <div className="flex-shrink-0 w-9 h-9 flex items-center justify-center bg-surface-sunken border border-line">
                        <Icon className="w-4 h-4" style={{ color: GOLD }} />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white">{title}</h3>
                        <p className="text-[13px] leading-relaxed text-muted mt-0.5">{body}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Full guide link */}
                <Link
                  to="/podium-guide"
                  className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-secondary hover:text-white transition-colors"
                >
                  <BookOpen className="w-4 h-4" style={{ color: GOLD }} />
                  Read the full Podium Class guide
                </Link>
              </m.div>
            </div>

            {/* ============================================================= */}
            {/* AUTH COLUMN */}
            {/* ============================================================= */}
            <div className="lg:col-span-5 order-1 lg:order-2">
              <div className="lg:sticky lg:top-8">
                <m.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.05 }}
                  className="bg-surface-card border border-line rounded-none"
                >
                  {/* Mode toggle */}
                  <div className="grid grid-cols-2 border-b border-line">
                    <button
                      type="button"
                      onClick={() => switchMode('register')}
                      className={`h-12 text-sm font-bold uppercase tracking-wider transition-colors press-feedback ${
                        isRegister ? 'text-black' : 'text-muted hover:text-white bg-surface-sunken'
                      }`}
                      style={isRegister ? { backgroundColor: GOLD } : undefined}
                    >
                      Found Corps
                    </button>
                    <button
                      type="button"
                      onClick={() => switchMode('login')}
                      className={`h-12 text-sm font-bold uppercase tracking-wider transition-colors press-feedback ${
                        !isRegister ? 'text-black' : 'text-muted hover:text-white bg-surface-sunken'
                      }`}
                      style={!isRegister ? { backgroundColor: GOLD } : undefined}
                    >
                      Sign In
                    </button>
                  </div>

                  <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    <div>
                      <Heading level="title">
                        {isRegister ? 'Start your corps' : 'Welcome back, Director'}
                      </Heading>
                      <p className="text-xs text-muted mt-1">
                        {isRegister
                          ? 'Create a free account and take the podium in under two minutes.'
                          : 'Sign in to pick up your season where you left it.'}
                      </p>
                    </div>

                    {/* Error */}
                    {error && (
                      <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-none flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-red-300">{error}</p>
                      </div>
                    )}

                    {/* Director name (register only) */}
                    {isRegister && (
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                        <input
                          type="text"
                          placeholder="Director name"
                          value={formData.displayName}
                          onChange={update('displayName')}
                          required
                          disabled={loading}
                          autoComplete="name"
                          className="w-full min-h-[44px] h-11 pl-10 pr-3 bg-surface-sunken border border-line rounded-none text-base text-white placeholder-muted focus:outline-none focus:border-interactive disabled:opacity-50 transition-colors"
                        />
                      </div>
                    )}

                    {/* Email */}
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                      <input
                        type="email"
                        placeholder="Email"
                        value={formData.email}
                        onChange={update('email')}
                        required
                        disabled={loading}
                        autoComplete="email"
                        className="w-full min-h-[44px] h-11 pl-10 pr-3 bg-surface-sunken border border-line rounded-none text-base text-white placeholder-muted focus:outline-none focus:border-interactive disabled:opacity-50 transition-colors"
                      />
                    </div>

                    {/* Password */}
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder={isRegister ? 'Password (min 8 characters)' : 'Password'}
                        value={formData.password}
                        onChange={update('password')}
                        required
                        disabled={loading}
                        autoComplete={isRegister ? 'new-password' : 'current-password'}
                        className="w-full min-h-[44px] h-11 pl-10 pr-11 bg-surface-sunken border border-line rounded-none text-base text-white placeholder-muted focus:outline-none focus:border-interactive disabled:opacity-50 transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-1 top-1/2 -translate-y-1/2 p-2 text-muted hover:text-white transition-colors min-w-touch min-h-touch flex items-center justify-center"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>

                    {/* Terms (register only) */}
                    {isRegister && (
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.acceptTerms}
                          onChange={update('acceptTerms')}
                          className="w-5 h-5 mt-0.5 rounded-none border-line bg-surface-sunken text-interactive focus:ring-interactive focus:ring-offset-0 flex-shrink-0"
                        />
                        <span className="text-xs text-muted leading-relaxed">
                          I accept the{' '}
                          <Link to="/terms" className="hover:underline" style={{ color: GOLD }}>
                            Terms
                          </Link>{' '}
                          and{' '}
                          <Link to="/privacy" className="hover:underline" style={{ color: GOLD }}>
                            Privacy Policy
                          </Link>
                        </span>
                      </label>
                    )}

                    {/* Submit */}
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full h-12 text-black font-bold text-sm uppercase tracking-wider flex items-center justify-center active:scale-[0.98] transition-all duration-150 press-feedback-strong disabled:opacity-50 disabled:cursor-not-allowed rounded-none"
                      style={{ backgroundColor: GOLD }}
                    >
                      {loading ? (
                        <span className="flex items-center gap-2">
                          <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                          {isRegister ? 'Founding…' : 'Signing in…'}
                        </span>
                      ) : isRegister ? (
                        'Found My Corps — Free'
                      ) : (
                        'Sign In'
                      )}
                    </button>

                    {/* Secondary links */}
                    <div className="flex items-center justify-between text-xs text-muted pt-1">
                      {isRegister ? (
                        <button
                          type="button"
                          onClick={() => switchMode('login')}
                          className="hover:text-white transition-colors"
                        >
                          Have an account? Sign in
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => switchMode('register')}
                            className="hover:text-white transition-colors"
                          >
                            New here? Found a corps
                          </button>
                          <Link
                            to="/forgot-password"
                            className="hover:text-white transition-colors"
                          >
                            Forgot password?
                          </Link>
                        </>
                      )}
                    </div>
                  </form>

                  {/* Try-the-demo path — mirrors the index's "Try Demo First",
                      Podium-flavored and pointed at the sample loop. */}
                  <Link
                    to="/podium/preview"
                    className="flex items-center justify-center gap-2 mx-5 mb-5 py-2.5 border border-interactive/30 rounded-none text-interactive hover:bg-interactive/10 hover:border-interactive/50 transition-colors"
                  >
                    <Play className="w-4 h-4" />
                    <span className="text-sm font-medium">Try the demo first</span>
                  </Link>
                </m.div>

                {/* Reassurance strip */}
                <p className="mt-3 text-center text-[11px] text-muted leading-relaxed">
                  Podium is one of five corps classes on marching.art. One account plays them all.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PodiumLanding;
