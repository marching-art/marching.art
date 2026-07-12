// =============================================================================
// LANDING PAGE - NEWS & DATA HUB
// =============================================================================
// Three-column layout: News Feed | Live Data | Auth Widget
// Laws: No marketing fluff, no parallax, no testimonials

import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Trophy,
  Lock,
  Mail,
  AlertCircle,
  LayoutDashboard,
  User,
  LogOut,
  Flame,
  Zap,
  MessageCircle,
  Coins,
  Play,
  Newspaper,
  Calendar,
  HelpCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { useProfileStore } from '../store/profileStore';
import NewsFeed from '../components/Landing/NewsFeed';
import GuestActionBar from '../components/Landing/GuestActionBar';
import BottomNav from '../components/BottomNav';
import NextPerformancePanel from '../components/Dashboard/NextPerformancePanel';
import DesktopNavItem from '../components/Layout/DesktopNavItem';
import { useScheduleStore } from '../store/scheduleStore';
import HeroBanner from '../components/Landing/HeroBanner';
import HowItWorks from '../components/Landing/HowItWorks';
import SocialProofBar from '../components/Landing/SocialProofBar';
import UrgencyBanner from '../components/Landing/UrgencyBanner';
import CommunityPulse from '../components/Landing/CommunityPulse';
import {
  LiveScoresBox,
  FantasyTrendingBox,
  StandingsModal,
  YouTubeModal,
} from '../components/Sidebar';
import { useBodyScroll } from '../hooks/useBodyScroll';
import { useTickerData } from '../hooks/useTickerData';
import { useLandingScores } from '../hooks/useLandingScores';
import { useYoutubeSearch } from '../hooks/useYoutubeSearch';
import { useFirstVisit } from '../hooks/useFirstVisit';
import { useSEO } from '../hooks/useSEO';

// =============================================================================
// LANDING PAGE COMPONENT
// =============================================================================

const Landing = () => {
  useBodyScroll();
  // Homepage keeps the site-default title/description; the hook pins the
  // canonical URL so client-side navigation back home never leaks stale meta.
  useSEO({ path: '/' });
  const { user, signIn, signOut } = useAuth();
  const profile = useProfileStore((state) => state.profile);

  // Signed-in home surfaces the director's next show as the primary action.
  // Data comes straight from the global stores (already listening app-wide) —
  // NOT useDashboardData, which carries heavy side effects (season-setup wizard,
  // milestone writes, achievement modals) that must never fire from the home page.
  const corps = useProfileStore((state) => state.corps);
  const competitions = useScheduleStore((state) => state.competitions);

  // Resolve the corps the director last viewed, mirroring the Dashboard's
  // per-user localStorage key so home and dashboard agree on which corps is
  // "active"; fall back to the first available class.
  const activeCorps = useMemo(() => {
    if (!corps) return null;
    const classes = Object.keys(corps);
    if (classes.length === 0) return null;
    let selected = classes[0];
    try {
      const saved = user && localStorage.getItem(`selectedCorps_${user.uid}`);
      if (saved && classes.includes(saved)) selected = saved;
    } catch {
      // localStorage unavailable (private browsing) — first class is fine.
    }
    return corps[selected];
  }, [corps, user]);

  // First-visit detection for progressive disclosure
  // New visitors see educational content; returning visitors get data-focused view
  const { isFirstVisit, isLoading: isFirstVisitLoading, markAsReturning } = useFirstVisit();

  // Stagger secondary data loading to prioritize news feed on initial paint
  // Ticker and scores data loads after a brief delay to reduce bandwidth contention
  const [secondaryDataEnabled, setSecondaryDataEnabled] = useState(false);

  useEffect(() => {
    // Use requestIdleCallback if available, otherwise setTimeout
    // This ensures news feed renders first before loading sidebar data
    const enableSecondaryData = () => setSecondaryDataEnabled(true);

    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(enableSecondaryData, { timeout: 500 });
      return () => window.cancelIdleCallback(id);
    } else {
      const id = setTimeout(enableSecondaryData, 100);
      return () => clearTimeout(id);
    }
  }, []);

  const { tickerData, loading: tickerLoading } = useTickerData({ enabled: secondaryDataEnabled });
  const {
    liveScores,
    displayDay,
    loading: scoresLoading,
    hasData: hasScoresData,
  } = useLandingScores({ enabled: secondaryDataEnabled });

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showStandingsModal, setShowStandingsModal] = useState(false);

  // YouTube search hook
  const { videoModal, handleYoutubeSearch, handleRetrySearch, closeVideoModal } =
    useYoutubeSearch();

  // Compute trending players from movers across all classes
  const trendingPlayers = useMemo(() => {
    if (!tickerData?.byClass) return [];

    // Collect movers from all classes
    const allMovers = [];
    for (const classKey of ['worldClass', 'openClass', 'aClass']) {
      const classData = tickerData.byClass[classKey];
      if (classData?.movers) {
        classData.movers.forEach((mover) => {
          // Calculate percentage change
          const prevScore = parseFloat(mover.previousScore);
          const changeValue = parseFloat(mover.change);
          const percentChange = prevScore > 0 ? (changeValue / prevScore) * 100 : 0;

          allMovers.push({
            name: mover.fullName,
            change: `${changeValue >= 0 ? '+' : ''}${percentChange.toFixed(1)}%`,
            direction: mover.direction,
            absChange: Math.abs(percentChange),
          });
        });
      }
    }

    // Sort by absolute percentage change and take top 4
    return allMovers.sort((a, b) => b.absChange - a.absChange).slice(0, 4);
  }, [tickerData]);

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success('Signed out successfully');
    } catch {
      toast.error('Failed to sign out');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
      markAsReturning(); // User has engaged - mark as returning visitor
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
    <div className="min-h-screen flex flex-col bg-background">
      {/* FIXED HEADER */}
      <header className="flex-shrink-0 h-14 bg-surface-card border-b border-line">
        <div className="h-full flex items-center px-4 lg:px-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-none overflow-hidden">
              <img src="/logo192.svg" alt="marching.art" className="w-full h-full object-cover" />
            </div>
            <span className="text-base font-bold text-white tracking-wider">marching.art</span>
          </div>
          <div className="ml-auto flex items-center gap-1">
            {/* Signed-out auth actions live in the bottom nav (GuestActionBar:
                Demo / Sign In / Join), not the header — so the header corner is
                free for the Discord + Privacy/Terms utility links below. */}
            {/* Authenticated user - Compact status chip on mobile.
                Replaces the old oversized DASHBOARD button: navigation now lives
                in the persistent BottomNav below, so the header only needs to
                surface glanceable status (coins + level). Links to the dashboard
                to preserve the one-tap path into the game. */}
            {user && profile && (
              <Link
                to="/dashboard"
                aria-label={`Dashboard — ${(profile.corpsCoin || 0).toLocaleString()} coins, level ${profile.xpLevel || 1}`}
                className="lg:hidden flex items-center gap-2 min-h-[44px] pl-3 pr-2 rounded-none bg-white/[0.04] border border-line active:scale-95 transition-all duration-150 press-feedback"
              >
                <span className="flex items-center gap-1 text-sm font-bold text-brand font-data tabular-nums">
                  <Coins className="w-3.5 h-3.5" />
                  {(profile.corpsCoin || 0).toLocaleString()}
                </span>
                <span className="flex items-center gap-1 text-sm font-bold text-purple-400 font-data tabular-nums pl-2 border-l border-line">
                  <Zap className="w-3.5 h-3.5" />
                  {profile.xpLevel || 1}
                </span>
              </Link>
            )}
            {/* Desktop links */}
            {user ? (
              /* Signed in: the app's primary navigation, matching GameShell's top
                 nav. Without this the home screen would be the only page where a
                 desktop user has no way into Dashboard/Schedule/Scores/Profile
                 (previously hidden inside the sidebar widget's quick-links). */
              <nav className="hidden lg:flex items-center gap-1" aria-label="Primary">
                <DesktopNavItem to="/" icon={Newspaper} label="News" end />
                <DesktopNavItem to="/dashboard" icon={LayoutDashboard} label="Dashboard" />
                <DesktopNavItem to="/schedule" icon={Calendar} label="Schedule" />
                <DesktopNavItem to="/scores" icon={Trophy} label="Scores" />
                <DesktopNavItem to="/profile" icon={User} label="Profile" />
              </nav>
            ) : (
              /* Signed out: Discord + Privacy/Terms in the header corner, now on
                 mobile too (they used to be desktop-only). Discord is an icon;
                 the legal links stay compact. Auth moved to the bottom nav. */
              <div className="flex items-center gap-0.5">
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
                <Link
                  to="/privacy"
                  className="px-2 py-2.5 min-h-touch text-xs text-muted hover:text-secondary active:text-white transition-colors press-feedback flex items-center"
                >
                  Privacy
                </Link>
                <Link
                  to="/terms"
                  className="px-2 py-2.5 min-h-touch text-xs text-muted hover:text-secondary active:text-white transition-colors press-feedback flex items-center"
                >
                  Terms
                </Link>
              </div>
            )}
            {/* Discord — signed-in users don't get the informational link row
                above, so surface the community link as an icon here (matches the
                Discord icon in GameShell's header on every other page). Sits after
                the chip on mobile and after the nav on desktop. */}
            {user && (
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
            )}
            {/* Game Guide — mirrors the help icon in GameShell's header so the
                guide is reachable from the home page too. Signed-in only, sitting
                after Discord to match the icon order elsewhere on the site. */}
            {user && (
              <Link
                to="/guide"
                className="p-2 text-muted hover:text-white hover:bg-white/10 rounded-none transition-colors press-feedback flex items-center"
                title="Game Guide"
                aria-label="Game Guide"
              >
                <HelpCircle className="w-5 h-5" />
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* SCROLLABLE CONTENT */}
      <main className="flex-1 pb-24 lg:pb-4">
        <div className="p-4 lg:p-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6">
            {/* ============================================================= */}
            {/* SIDEBAR */}
            {/* On desktop: 4 cols on right, sticky */}
            {/* On mobile: Full width. Shows AFTER hero for first-time visitors, */}
            {/* BEFORE news for returning/authenticated users */}
            {/* ============================================================= */}
            <div
              className={`${!user && !isFirstVisitLoading && isFirstVisit ? 'order-2' : 'order-1'} lg:order-2 lg:col-span-4`}
            >
              <div className="lg:sticky lg:top-4 space-y-4 lg:space-y-5">
                {/* ------------------------------------------------------- */}
                {/* YOUR NEXT SHOW - the director's primary action, promoted */}
                {/* to the top of home. Renders nothing off-season or when no */}
                {/* show is upcoming, so it never shows an empty shell. */}
                {/* ------------------------------------------------------- */}
                {user && (
                  <NextPerformancePanel
                    competitions={competitions}
                    selectedShows={activeCorps?.selectedShows || {}}
                    lineup={activeCorps?.lineup || {}}
                  />
                )}

                {/* ------------------------------------------------------- */}
                {/* AUTH WIDGET - Login or User Dashboard */}
                {/* ------------------------------------------------------- */}
                {user ? (
                  /* AUTHENTICATED USER WIDGET */
                  <div className="bg-surface-card border border-line rounded-none">
                    {/* User Header */}
                    <div className="bg-surface-raised px-4 py-3 border-b border-line">
                      <h3 className="text-[10px] font-bold text-muted uppercase tracking-wider flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-interactive" />
                        My Fantasy
                      </h3>
                    </div>

                    {/* User Info */}
                    <div className="p-4 border-b border-line">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-interactive flex items-center justify-center text-white font-bold text-sm">
                          {profile?.displayName?.[0]?.toUpperCase() ||
                            user.email?.[0]?.toUpperCase() ||
                            'D'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-white truncate">
                            {profile?.displayName || 'Director'}
                          </div>
                          <div className="text-xs text-muted truncate">{user.email}</div>
                        </div>
                      </div>

                      {/* Quick Stats - desktop only. On mobile these live in the
                          header status chip (coins + level), so the full grid here
                          would just repeat them; the card stays a slim identity
                          strip on phones. */}
                      {profile && (
                        <div className="hidden lg:grid grid-cols-2 gap-x-4 gap-y-2 mt-3 pt-3 border-t border-line/50">
                          <div className="flex items-center gap-1.5">
                            <Zap className="w-3.5 h-3.5 text-purple-500" />
                            <span className="text-xs text-muted">Level</span>
                            <span className="text-sm font-bold text-white">
                              {profile.xpLevel || 1}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Trophy className="w-3.5 h-3.5 text-interactive" />
                            <span className="text-xs text-muted">XP</span>
                            <span className="text-sm font-bold text-white font-data tabular-nums">
                              {profile.xp?.toLocaleString() || 0}
                            </span>
                          </div>
                          {profile.engagement?.loginStreak > 0 && (
                            <div className="flex items-center gap-1.5">
                              <Flame className="w-3.5 h-3.5 text-orange-500" />
                              <span className="text-xs text-muted">Streak</span>
                              <span className="text-sm font-bold text-orange-500 font-data tabular-nums">
                                {profile.engagement.loginStreak}
                              </span>
                            </div>
                          )}
                          <div className="flex items-center gap-1.5">
                            <Coins className="w-3.5 h-3.5 text-brand" />
                            <span className="text-xs text-muted">Coins</span>
                            <span className="text-sm font-bold text-brand font-data tabular-nums">
                              {(profile.corpsCoin || 0).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Quick Links removed — the app's primary destinations now
                        live in the desktop header nav (added above), matching
                        every other page. Only Sign Out remains, since the header
                        nav intentionally doesn't carry it. */}

                    {/* Sign Out - hidden on mobile (accessible from Dashboard), show on desktop */}
                    <div className="hidden lg:block px-2 py-2 border-t border-line bg-surface-sunken">
                      <button
                        onClick={handleSignOut}
                        className="flex items-center gap-2 px-2 min-h-[44px] w-full text-sm text-muted hover:text-red-400 active:text-red-500 transition-colors press-feedback rounded-none"
                      >
                        <LogOut className="w-4 h-4" />
                        Sign Out
                      </button>
                    </div>
                  </div>
                ) : (
                  /* LOGIN/REGISTER WIDGET */
                  <div className="bg-surface-card border border-line rounded-none">
                    {/* Card Header */}
                    <div className="bg-surface-raised px-4 py-3 border-b border-line">
                      <h3 className="text-[10px] font-bold text-muted uppercase tracking-wider flex items-center gap-2">
                        <Trophy className="w-3.5 h-3.5 text-secondary" />
                        Play Now
                      </h3>
                    </div>

                    {/* Card Body - Compact Form */}
                    <form onSubmit={handleSubmit} className="p-4 space-y-3">
                      {/* Error Message */}
                      {error && (
                        <div className="p-2.5 bg-red-500/10 border border-red-500/30 rounded-none flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-red-300">{error}</p>
                        </div>
                      )}

                      {/* Email Input - 44px+ height for touch targets */}
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                        <input
                          type="email"
                          placeholder="Email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          disabled={loading}
                          className="w-full min-h-[44px] h-11 pl-10 pr-3 bg-surface-sunken border border-line rounded-none text-base text-white placeholder-muted focus:outline-none focus:border-interactive disabled:opacity-50 transition-colors"
                        />
                      </div>

                      {/* Password Input - 44px+ height for touch targets */}
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                        <input
                          type="password"
                          placeholder="Password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          disabled={loading}
                          className="w-full min-h-[44px] h-11 pl-10 pr-3 bg-surface-sunken border border-line rounded-none text-base text-white placeholder-muted focus:outline-none focus:border-interactive disabled:opacity-50 transition-colors"
                        />
                      </div>

                      {/* Actions Row - 44px+ height for touch targets */}
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={loading}
                          className="flex-1 min-h-[44px] h-11 bg-interactive text-white font-bold text-sm uppercase tracking-wider flex items-center justify-center hover:bg-interactive-hover active:bg-interactive-subtle active:scale-[0.98] transition-all duration-150 press-feedback-strong disabled:opacity-50 disabled:cursor-not-allowed rounded-none"
                        >
                          {loading ? '...' : 'Sign In'}
                        </button>
                        <Link
                          to="/register"
                          className="flex-1 min-h-[44px] h-11 border border-line text-muted font-bold text-sm uppercase tracking-wider flex items-center justify-center hover:border-line-strong hover:text-white active:scale-[0.98] transition-all duration-150 press-feedback rounded-none"
                        >
                          Register
                        </Link>
                      </div>

                      {/* Free to play badge - prominent placement */}
                      <div className="flex items-center justify-center gap-2 py-2 bg-green-500/10 border border-green-500/20 rounded-none">
                        <Zap className="w-4 h-4 text-green-500" />
                        <span className="text-sm font-semibold text-green-400">
                          100% Free to Play
                        </span>
                      </div>

                      {/* Try Demo Link */}
                      <Link
                        to="/preview"
                        className="flex items-center justify-center gap-2 py-2.5 border border-interactive/30 rounded-none text-interactive hover:bg-interactive/10 hover:border-interactive/50 transition-colors"
                      >
                        <Play className="w-4 h-4" />
                        <span className="text-sm font-medium">Try Demo First</span>
                      </Link>

                      {/* Footer Links */}
                      <div className="flex items-center justify-center text-xs text-muted pt-1">
                        <Link
                          to="/forgot-password"
                          className="hover:text-interactive transition-colors"
                        >
                          Forgot password?
                        </Link>
                      </div>
                    </form>
                  </div>
                )}

                {/* URGENCY BANNER - Show time-sensitive info */}
                {!user && <UrgencyBanner showCTA={true} maxTriggers={2} />}

                {/* COMMUNITY PULSE - Live activity feed for social proof */}
                <CommunityPulse />

                {/* FANTASY TRENDING MODULE */}
                <FantasyTrendingBox
                  trendingPlayers={trendingPlayers}
                  loading={tickerLoading}
                  dayLabel={tickerData?.dayLabel}
                />

                {/* LIVE SCORE TICKER */}
                <LiveScoresBox
                  liveScores={liveScores}
                  displayDay={displayDay}
                  loading={scoresLoading}
                  hasData={hasScoresData}
                  onYoutubeClick={handleYoutubeSearch}
                  onShowStandings={() => setShowStandingsModal(true)}
                />
              </div>
            </div>

            {/* ============================================================= */}
            {/* MAIN COLUMN - Hero (first-time visitors) + News Feed */}
            {/* On desktop: 8 cols on left */}
            {/* On mobile: First for first-time visitors, after sidebar otherwise */}
            {/* ============================================================= */}
            <div
              className={`${!user && !isFirstVisitLoading && isFirstVisit ? 'order-1' : 'order-2'} lg:order-1 lg:col-span-8 space-y-4 lg:space-y-5`}
            >
              {/* =============================================================
                FIRST-TIME VISITOR SECTION - Hero + How It Works
                Shows value proposition and educational content inline with
                the articles column for new unauthenticated users.
                ============================================================= */}
              {!user && !isFirstVisitLoading && isFirstVisit && (
                <>
                  <HeroBanner onDismiss={markAsReturning} />
                  <SocialProofBar />
                  <HowItWorks />
                </>
              )}

              {/* Section header for mobile - helps users understand the content */}
              <div className="flex items-center gap-2 mb-0 lg:hidden">
                <span className="text-xs font-bold text-muted uppercase tracking-wider">
                  Latest News
                </span>
                <div className="flex-1 h-px bg-line" />
              </div>
              {/* Dynamic News Feed powered by Gemini AI */}
              <NewsFeed maxItems={5} />
            </div>
          </div>
        </div>
      </main>

      {/* FULL STANDINGS MODAL */}
      <StandingsModal
        show={showStandingsModal}
        liveScores={liveScores}
        displayDay={displayDay}
        onClose={() => setShowStandingsModal(false)}
        onYoutubeClick={handleYoutubeSearch}
      />

      {/* YOUTUBE VIDEO MODAL */}
      <YouTubeModal videoModal={videoModal} onClose={closeVideoModal} onRetry={handleRetrySearch} />

      {/* PERSISTENT MOBILE NAV — the home screen previously had none, which is
          why it leaned on an oversized DASHBOARD button. Signed-in users get the
          same 5-tab BottomNav as the rest of the app; signed-out visitors get a
          conversion bar (Demo / Sign In / Join) instead of gated app tabs that
          would dead-end at the login wall. Both are lg:hidden. */}
      {user ? <BottomNav /> : <GuestActionBar />}
    </div>
  );
};

export default Landing;
