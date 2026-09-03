// Google Analytics must not exist until the visitor consents, and must stop
// collecting the moment they withdraw. These pin the gate around the SDK
// calls themselves — getAnalytics / setAnalyticsCollectionEnabled / logEvent.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const getAnalytics = vi.fn(() => ({ app: 'fake' }));
const setAnalyticsCollectionEnabled = vi.fn();
const logEvent = vi.fn();
const isSupported = vi.fn(async () => true);

vi.mock('firebase/analytics', () => ({
  getAnalytics: (...args: unknown[]) => getAnalytics(...(args as [])),
  setAnalyticsCollectionEnabled: (...args: unknown[]) =>
    setAnalyticsCollectionEnabled(...(args as [])),
  logEvent: (...args: unknown[]) => logEvent(...(args as [])),
  isSupported: () => isSupported(),
}));
vi.mock('./client', () => ({ app: { name: 'fake-app' } }));
vi.mock('../config', () => ({
  FEATURE_FLAGS: { analytics: true },
  FIREBASE_CONFIG: { measurementId: 'G-TEST' },
}));

const consent = await import('../utils/analyticsConsent');
const mod = await import('./analytics');

const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(async () => {
  consent.resetAnalyticsConsent();
  mod._resetAnalyticsForTesting();
  getAnalytics.mockClear();
  setAnalyticsCollectionEnabled.mockClear();
  logEvent.mockClear();
  await flush();
});

describe('consent-gated analytics', () => {
  it('never creates the SDK or logs while consent is unset', async () => {
    await mod.syncAnalyticsWithConsent();
    mod.analytics.logPageView('/');
    expect(getAnalytics).not.toHaveBeenCalled();
    expect(logEvent).not.toHaveBeenCalled();
  });

  it('never creates the SDK after an explicit denial', async () => {
    consent.setAnalyticsConsent('denied');
    await flush();
    mod.analytics.logEvent('anything');
    expect(getAnalytics).not.toHaveBeenCalled();
    expect(logEvent).not.toHaveBeenCalled();
  });

  it('initialises and enables collection once consent is granted, then logs', async () => {
    consent.setAnalyticsConsent('granted');
    await flush();
    await mod.syncAnalyticsWithConsent();

    expect(getAnalytics).toHaveBeenCalledTimes(1);
    expect(setAnalyticsCollectionEnabled).toHaveBeenLastCalledWith(expect.anything(), true);

    mod.analytics.logPageView('/dashboard');
    expect(logEvent).toHaveBeenCalledWith(expect.anything(), 'page_view', {
      page_name: '/dashboard',
    });
  });

  it('switches collection off and drops events when consent is withdrawn', async () => {
    consent.setAnalyticsConsent('granted');
    await flush();
    await mod.syncAnalyticsWithConsent();

    consent.setAnalyticsConsent('denied');
    await flush();
    expect(setAnalyticsCollectionEnabled).toHaveBeenLastCalledWith(expect.anything(), false);

    mod.analytics.logEvent('after_withdrawal');
    expect(logEvent).not.toHaveBeenCalled();

    // Re-granting re-enables without creating a second SDK instance.
    consent.setAnalyticsConsent('granted');
    await flush();
    await mod.syncAnalyticsWithConsent();
    expect(getAnalytics).toHaveBeenCalledTimes(1);
    expect(setAnalyticsCollectionEnabled).toHaveBeenLastCalledWith(expect.anything(), true);
  });

  it('does nothing in unsupported browsers even with consent', async () => {
    isSupported.mockResolvedValueOnce(false);
    consent.setAnalyticsConsent('granted');
    await flush();
    await mod.syncAnalyticsWithConsent();
    expect(getAnalytics).not.toHaveBeenCalled();
    mod.analytics.logEvent('x');
    expect(logEvent).not.toHaveBeenCalled();
  });
});
