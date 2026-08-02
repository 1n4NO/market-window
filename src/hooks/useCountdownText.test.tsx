import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useCountdownText } from './useCountdownText';

describe('useCountdownText', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllTimers();
  });

  it('updates countdown text and cleans up its interval', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-02T00:00:00.000Z'));

    const { result, rerender, unmount } = renderHook(({ targetAt }) => useCountdownText(targetAt), {
      initialProps: { targetAt: '2026-08-02T00:00:05.000Z' },
    });

    expect(result.current).toBe('5s');

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current).toBe('4s');

    rerender({ targetAt: '2026-08-02T00:00:05.000Z' });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current).toBe('3s');

    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
