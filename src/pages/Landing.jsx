// @ts-nocheck -- grandfathered before checkJs; remove when this file is typed or cleaned up
// =============================================================================
// LANDING PAGE - NEWS & DATA HUB
// =============================================================================
// Three-column layout: News Feed | Live Data | Auth Widget
// Laws: No marketing fluff, no parallax, no testimonials

import React, { useState, useMemo, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Trophy,
  Lock,
  Mail,
  AlertCircle,
  User,
  LogOut,
  Flame,
  Zap,
  Coins,
  Play,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { useProfileStore } from '../store/profileStore';
import NewsFeed from '../components/Landing/NewsFeed';
import GuestActionBar from '../components/Landing/GuestActionBar';
import BottomNav from '../components/BottomNav';
import SiteHeader from '../components/Layout/SiteHeader';
import SiteFooter from '../components/Layout/SiteFooter';
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
import { resolveAuthRedirect } from '../hooks/useAuthRedirect';

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
  const navigate = useNavigate();
  const location = useLocation();
  // Set only when ProtectedRoute redirected here from a route the visitor was
  // actually trying to reach; null on an ordinary visit to the home page.
  const redirectAfterAuth = location.state?.from ? resolveAuthRedirect(location.state.from) : null;

  // Signed-in home surfaces the director's next show as the primary action.
  // Data comes straight from the global stores (already listening app-wide) —
  // NOT useDashboardData, which carries heavy side effects (season-setup wizard,
  // milestone writes, achievement modals) that must never fire from the home page.
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
  const { videoModal, handleYoutubeSearch, handleRetrySearch, handleResetVideo, closeVideoModal } =
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
      // Signing in from the home page normally keeps you on the home page (it
      // becomes the signed-in home). The exception is arriving here because
      // ProtectedRoute bounced you off a deep link — then finish the trip.
      if (redirectAfterAuth) navigate(redirectAfterAuth, { replace: true });
    } catch (err) {
      console.error('Login error:', err);
      switch (err.code) {
        // Email enumeration protection collapses user-not-found and
        // wrong-password into a single invalid-credential error
        case 'auth/invalid-credential':
          setError('Incorrect email or password');
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

  // ---------------------------------------------------------------------------
  // HOME LAYOUT ORDER
  // The home grid is two columns on desktop (news left, rail right) but a single
  // stacked column on mobile. We want mobile to lead with the visitor's most
  // valuable content instead of burying the news feed under the entire rail:
  //   - signed in:       News → live data → identity
  //   - returning guest: Play Now  → News → live data
  //   - first visit:     Hero+News → Play Now → live data
  // The rail collapses to `display: contents` on mobile (see the wrapper below),
  // so its widgets become direct grid items and a single per-element `order`
  // value can interleave them with the news column (a separate grid child). The
  // same values drive the desktop rail's flex column — there only their relative
  // order matters, since the news column is placed on the left independently via
  // `lg:order-last` on the rail wrapper.
  const firstVisitGuest = !user && !isFirstVisitLoading && isFirstVisit;
  const order = user
    ? { news: 2, live: 3, trending: 4, community: 5, account: 6 }
    : firstVisitGuest
      ? { news: 1, account: 2, live: 3, trending: 4, community: 5, urgency: 6 }
      : { account: 1, news: 2, live: 3, trending: 4, community: 5, urgency: 6 };

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-background">
      {/* Fixed header + one fixed scroll region + fixed bottom bar, matching
          GameShell (and PublicShell). Keeps the header pinned on mobile and
          stops page content from scrolling behind the bottom bar's safe-area
          strip. */}
      <SiteHeader />

      {/* SCROLLABLE CONTENT — the single scroll region between the fixed header
          and the fixed bottom bar. `main-content-bottom` reserves the mobile
          bar (66px + safe area) and collapses to bottom:0 on lg. */}
      <main
        id="main-content"
        role="main"
        className="fixed top-14 left-0 right-0 main-content-bottom overflow-y-auto overflow-x-hidden pb-4"
      >
        <div className="p-4 lg:p-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6">
            {/* ============================================================= */}
            {/* RAIL — Next Show + auth + live-data widgets */}
            {/* Desktop: 4 cols on the right, sticky flex column. */}
            {/* Mobile: `contents` on both wrappers so each widget becomes a */}
            {/* direct grid item, letting per-widget `order` (computed above) */}
            {/* interleave them with the news column instead of stacking the */}
            {/* whole rail above or below it. */}
            {/* ============================================================= */}
            <div className="contents lg:block lg:col-span-4 lg:order-last">
              <div className="contents lg:flex lg:flex-col lg:gap-5 lg:sticky lg:top-4">
                {/* ------------------------------------------------------- */}
                {/* AUTH WIDGET - Login (guest) or identity strip (signed in). */}
                {/* Guests keep it near the top for conversion; signed-in users */}
                {/* get it demoted below news + live data, since the mobile card */}
                {/* only repeats the coins/level already in the header. */}
                {/* ------------------------------------------------------- */}
                <div style={{ order: order.account }}>
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
                </div>

                {/* URGENCY BANNER - guest-only, time-sensitive CTA */}
                {!user && (
                  <div style={{ order: order.urgency }}>
                    <UrgencyBanner showCTA={true} maxTriggers={2} />
                  </div>
                )}

                {/* COMMUNITY PULSE - Live activity feed for social proof */}
                <div style={{ order: order.community }}>
                  <CommunityPulse />
                </div>

                {/* FANTASY TRENDING MODULE */}
                <div style={{ order: order.trending }}>
                  <FantasyTrendingBox
                    trendingPlayers={trendingPlayers}
                    loading={tickerLoading}
                    dayLabel={tickerData?.dayLabel}
                  />
                </div>

                {/* LIVE SCORE TICKER — lifted above community + identity so the */}
                {/* rail (and the mobile stack) leads with fresh scores. */}
                <div style={{ order: order.live }}>
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
            </div>

            {/* ============================================================= */}
            {/* MAIN COLUMN - Hero (first-time visitors) + News Feed */}
            {/* Desktop: 8 cols on the left (`order.news` sits ahead of the */}
            {/* rail's `lg:order-last`). Mobile: `order.news` slots the feed */}
            {/* right after the visitor's primary action (see order map above). */}
            {/* ============================================================= */}
            <div style={{ order: order.news }} className="lg:col-span-8 space-y-4 lg:space-y-5">
              {/* =============================================================
                FIRST-TIME VISITOR SECTION - Hero + How It Works
                Shows value proposition and educational content inline with
                the articles column for new unauthenticated users.
                ============================================================= */}
              {firstVisitGuest && (
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

        {/* Shared utility links. Lives inside the fixed scroll region so it
            trails the content at the end of the scroll; as a sibling of the
            out-of-flow <main> it would collapse to the top under the header. */}
        <SiteFooter />
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
      <YouTubeModal
        videoModal={videoModal}
        onClose={closeVideoModal}
        onRetry={handleRetrySearch}
        onReset={handleResetVideo}
      />

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
