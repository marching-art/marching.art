import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearPendingRedirect,
  consumePendingRedirect,
  peekPendingRedirect,
  rememberPendingRedirect,
} from './pendingRedirect';

describe('pendingRedirect', () => {
  afterEach(() => {
    clearPendingRedirect();
    vi.useRealTimers();
  });

  it('remembers a deep link and hands it back once', () => {
    rememberPendingRedirect('/leagues?join=ABC123');
    expect(peekPendingRedirect()).toBe('/leagues?join=ABC123');
    expect(consumePendingRedirect()).toBe('/leagues?join=ABC123');
    expect(peekPendingRedirect()).toBeNull();
  });

  it('ignores the default target and anything that is not a router-relative path', () => {
    rememberPendingRedirect('/dashboard');
    rememberPendingRedirect('https://evil.example/phish');
    rememberPendingRedirect('//evil.example');
    rememberPendingRedirect(null);
    expect(peekPendingRedirect()).toBeNull();
  });

  it('forgets a target after an hour', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-01T12:00:00Z'));
    rememberPendingRedirect('/profile/maestro');
    vi.setSystemTime(new Date('2026-09-01T13:30:00Z'));
    expect(peekPendingRedirect()).toBeNull();
  });

  it('survives garbage in storage', () => {
    sessionStorage.setItem('ma:pendingRedirect', '{not json');
    expect(peekPendingRedirect()).toBeNull();
  });
});
