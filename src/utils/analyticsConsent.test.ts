// The consent store is the single source of truth for whether Google
// Analytics may run (Privacy §7). These pin: off-by-default, persistence,
// change notification, cross-tab sync, and graceful behaviour without storage.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  ANALYTICS_CONSENT_KEY,
  getAnalyticsConsent,
  isAnalyticsAllowed,
  setAnalyticsConsent,
  resetAnalyticsConsent,
  subscribeAnalyticsConsent,
  useAnalyticsConsent,
} from './analyticsConsent';

beforeEach(() => {
  resetAnalyticsConsent();
});

describe('analytics consent store', () => {
  it('is unset (analytics off) until the visitor answers', () => {
    expect(getAnalyticsConsent()).toBe('unset');
    expect(isAnalyticsAllowed()).toBe(false);
  });

  it('persists a grant and a denial in localStorage', () => {
    setAnalyticsConsent('granted');
    expect(isAnalyticsAllowed()).toBe(true);
    expect(localStorage.getItem(ANALYTICS_CONSENT_KEY)).toBe('granted');

    setAnalyticsConsent('denied');
    expect(isAnalyticsAllowed()).toBe(false);
    expect(localStorage.getItem(ANALYTICS_CONSENT_KEY)).toBe('denied');
  });

  it('ignores junk in storage', () => {
    localStorage.setItem(ANALYTICS_CONSENT_KEY, 'maybe');
    resetAnalyticsConsent();
    localStorage.setItem(ANALYTICS_CONSENT_KEY, 'maybe');
    // A fresh read (simulated by a storage event) must not treat junk as consent.
    window.dispatchEvent(new StorageEvent('storage', { key: ANALYTICS_CONSENT_KEY }));
    expect(getAnalyticsConsent()).toBe('unset');
  });

  it('notifies subscribers once per change, not on repeats', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeAnalyticsConsent(listener);

    setAnalyticsConsent('granted');
    setAnalyticsConsent('granted');
    expect(listener).toHaveBeenCalledTimes(1);

    setAnalyticsConsent('denied');
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    setAnalyticsConsent('granted');
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('picks up a decision made in another tab', () => {
    const listener = vi.fn();
    subscribeAnalyticsConsent(listener);

    localStorage.setItem(ANALYTICS_CONSENT_KEY, 'granted');
    window.dispatchEvent(new StorageEvent('storage', { key: ANALYTICS_CONSENT_KEY }));

    expect(getAnalyticsConsent()).toBe('granted');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('still honours the choice for this page when storage throws', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    try {
      setAnalyticsConsent('granted');
      expect(isAnalyticsAllowed()).toBe(true);
    } finally {
      setItem.mockRestore();
    }
  });
});

describe('useAnalyticsConsent', () => {
  it('reflects the store and writes through setEnabled / grant / deny', () => {
    const { result } = renderHook(() => useAnalyticsConsent());
    expect(result.current.consent).toBe('unset');
    expect(result.current.asked).toBe(false);
    expect(result.current.enabled).toBe(false);

    act(() => result.current.grant());
    expect(result.current.consent).toBe('granted');
    expect(result.current.asked).toBe(true);
    expect(result.current.enabled).toBe(true);

    act(() => result.current.setEnabled(false));
    expect(result.current.consent).toBe('denied');
    expect(result.current.enabled).toBe(false);
    expect(localStorage.getItem(ANALYTICS_CONSENT_KEY)).toBe('denied');

    act(() => result.current.deny());
    expect(result.current.consent).toBe('denied');
  });
});
