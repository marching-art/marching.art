import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTickerCollapsed } from './useTickerCollapsed';

const STORAGE_KEY = 'marching.art:tickerCollapsed';

describe('useTickerCollapsed', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to expanded (not collapsed) with no stored preference', () => {
    const { result } = renderHook(() => useTickerCollapsed());
    expect(result.current[0]).toBe(false);
  });

  it('reads a stored collapsed preference on mount', () => {
    localStorage.setItem(STORAGE_KEY, '1');
    const { result } = renderHook(() => useTickerCollapsed());
    expect(result.current[0]).toBe(true);
  });

  it('toggles and persists the choice', () => {
    const { result } = renderHook(() => useTickerCollapsed());

    act(() => result.current[1]());
    expect(result.current[0]).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('1');

    act(() => result.current[1]());
    expect(result.current[0]).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('0');
  });

  it('survives a remount by reading persisted state', () => {
    const first = renderHook(() => useTickerCollapsed());
    act(() => first.result.current[1]());
    first.unmount();

    const second = renderHook(() => useTickerCollapsed());
    expect(second.result.current[0]).toBe(true);
  });
});
