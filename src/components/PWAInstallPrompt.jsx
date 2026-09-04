// src/components/PWAInstallPrompt.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { m, AnimatePresence } from 'framer-motion';
import { Download, X, Smartphone, Monitor, ExternalLink, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { wasInterruptShownThisSession } from '../hooks/useModalQueue';
import { buildOpenInBrowserUrl } from '../utils/installGuide';
import { Heading } from './ui';

// Routes where the nudge would be noise: the guide itself, the auth forms, and
// onboarding (which already owns the director's attention).
const QUIET_ROUTES = ['/install', '/login', '/register', '/forgot-password', '/onboarding'];

/**
 * PWA Install Prompt Component
 *
 * A transient, engagement-gated nudge to install the app. Install state is
 * sourced from the shared usePWAInstall hook so that dismissing this prompt does
 * NOT throw away the ability to install — the persistent "Install App" entry in
 * Settings, and the /install page, keep working for the rest of the session.
 *
 * The nudge deliberately does NOT try to teach the whole procedure in a toast.
 * It offers the one-tap native install where the browser has one; everywhere
 * else it is a single "Show me how" that opens /install, which shows the exact
 * steps for this device and browser — and, when the page is trapped inside
 * another app's mini browser, how to get out of it first.
 */
const PWAInstallPrompt = () => {
  const {
    platform,
    isInstalled,
    canPromptInstall,
    needsManualInstall,
    inAppBrowser,
    promptInstall,
  } = usePWAInstall();
  const [showPrompt, setShowPrompt] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const quietRoute = QUIET_ROUTES.some((r) => pathname.startsWith(r));

  // Decide whether to surface the transient nudge. Respects a 7-day dismissal
  // window and waits for engagement (a delay) before appearing.
  useEffect(() => {
    if (isInstalled || quietRoute) return;

    // Only nudge when there's actually something to offer: a native prompt, or
    // manual steps for a platform that supports installation.
    if (!canPromptInstall && !needsManualInstall) return;

    // One interruption per visit: if the dashboard already put a dialog in
    // front of this session (season recap, setup, tour), the nudge waits for
    // another day rather than stacking on top of it.
    if (wasInterruptShownThisSession()) return;

    // Don't re-nudge if dismissed within the last 7 days.
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    const dismissedDate = dismissed ? parseInt(dismissed, 10) : 0;
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    if (dismissedDate > sevenDaysAgo) return;

    // iOS/manual platforms have no native prompt event to wait on — show after a
    // longer engagement delay. Native-prompt platforms appear a bit sooner.
    const delay = canPromptInstall ? 8000 : 20000;
    const timer = setTimeout(() => setShowPrompt(true), delay);
    return () => clearTimeout(timer);
  }, [isInstalled, canPromptInstall, needsManualInstall, quietRoute]);

  // Hide the nudge the moment the app becomes installed, or the director
  // navigates somewhere it shouldn't sit on top of.
  useEffect(() => {
    if (isInstalled || quietRoute) setShowPrompt(false);
  }, [isInstalled, quietRoute]);

  const handleInstall = useCallback(async () => {
    const outcome = await promptInstall();
    if (outcome === 'accepted') {
      toast.success('Installing marching.art...');
    } else if (outcome === 'unavailable') {
      navigate('/install');
    }
    setShowPrompt(false);
  }, [promptInstall, navigate]);

  const handleDismiss = useCallback(() => {
    setShowPrompt(false);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  }, []);

  const handleShowHow = useCallback(() => {
    // Opening the guide counts as "seen" — the page itself is the follow-up.
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
    setShowPrompt(false);
    navigate('/install');
  }, [navigate]);

  // Get platform-specific content
  const getPlatformContent = () => {
    if (inAppBrowser) {
      const target = platform === 'ios' || platform === 'ipados' ? 'Safari' : 'Chrome';
      return {
        icon: ExternalLink,
        title: `Open in ${target} to install`,
        description: `${inAppBrowser.name}'s built-in browser can't add marching.art to your home screen.`,
      };
    }
    switch (platform) {
      case 'ios':
        return {
          icon: Smartphone,
          title: 'Add to Home Screen',
          description:
            'Three taps in Safari — no App Store needed. Get score-drop notifications too.',
        };
      case 'ipados':
        return {
          icon: Smartphone,
          title: 'Add to Home Screen',
          description: 'Get the full app experience on your iPad — no App Store needed.',
        };
      case 'android':
        return {
          icon: Smartphone,
          title: 'Install App',
          description: 'Add marching.art to your home screen for quick access and offline support',
        };
      case 'windows':
      case 'macos':
        return {
          icon: Monitor,
          title: 'Install Desktop App',
          description:
            'Install marching.art as a desktop app for faster access and better performance',
        };
      default:
        return {
          icon: Download,
          title: 'Install App',
          description: 'Install marching.art for offline access and better performance',
        };
    }
  };

  if (!showPrompt || isInstalled) {
    return null;
  }

  const content = getPlatformContent();
  const Icon = content.icon;
  const escapeUrl = inAppBrowser
    ? buildOpenInBrowserUrl(platform, `${window.location.origin}/install`)
    : null;

  return (
    <AnimatePresence>
      <m.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50"
        role="region"
        aria-label={content.title}
      >
        <div className="bg-surface-card border border-line rounded-none p-4">
          <button
            onClick={handleDismiss}
            className="absolute top-3 right-3 p-1.5 rounded-none hover:bg-white/10 transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4 text-muted" />
          </button>

          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-interactive rounded-none flex items-center justify-center flex-shrink-0">
              <Icon className="w-6 h-6 text-charcoal-900" />
            </div>

            <div className="flex-1 min-w-0">
              <Heading level="title" as="h3" className="mb-1 pr-6">
                {content.title}
              </Heading>
              <p className="text-sm text-muted mb-4">{content.description}</p>

              {/* Native prompt available: one-tap install. Otherwise a single
                  clear next step — the guide page does the teaching. */}
              {canPromptInstall ? (
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={handleInstall}
                    className="flex-1 min-h-[44px] flex items-center justify-center gap-2 px-4 py-2 bg-interactive text-white font-bold text-sm rounded-none hover:bg-interactive-hover transition-all"
                  >
                    <Download className="w-4 h-4" />
                    Install
                  </button>
                  <button
                    onClick={handleDismiss}
                    className="min-h-[44px] px-4 py-2 text-muted hover:text-white hover:bg-white/5 rounded-none transition-colors"
                  >
                    Later
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2 mt-4">
                  {escapeUrl && (
                    <a
                      href={escapeUrl}
                      className="min-h-[44px] flex items-center justify-center gap-2 px-4 py-2 bg-interactive text-white font-bold text-sm rounded-none hover:bg-interactive-hover transition-all"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Open in {platform === 'ios' || platform === 'ipados' ? 'Safari' : 'Chrome'}
                    </a>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={handleShowHow}
                      className={`flex-1 min-h-[44px] flex items-center justify-center gap-2 px-4 py-2 font-bold text-sm rounded-none transition-all ${
                        escapeUrl
                          ? 'border border-line text-secondary hover:text-white hover:bg-white/5'
                          : 'bg-interactive text-white hover:bg-interactive-hover'
                      }`}
                    >
                      Show me how
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleDismiss}
                      className="min-h-[44px] px-4 py-2 text-muted hover:text-white hover:bg-white/5 rounded-none transition-colors"
                    >
                      Later
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </m.div>
    </AnimatePresence>
  );
};

export default PWAInstallPrompt;
