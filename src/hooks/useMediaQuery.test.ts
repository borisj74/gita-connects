import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMediaQuery, MOBILE_BREAKPOINT } from './useMediaQuery.js';

type ChangeHandler = (event: MediaQueryListEvent) => void;

/** Install a controllable matchMedia and hand back a trigger for change events. */
function stubMatchMedia(initialMatches: boolean) {
  const handlers = new Set<ChangeHandler>();
  const removeEventListener = vi.fn((_: string, fn: ChangeHandler) => {
    handlers.delete(fn);
  });
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: initialMatches,
      media: query,
      addEventListener: (_: string, fn: ChangeHandler) => handlers.add(fn),
      removeEventListener,
    })),
  );
  return {
    removeEventListener,
    emit(matches: boolean) {
      handlers.forEach((fn) => fn({ matches } as MediaQueryListEvent));
    },
    get handlerCount() {
      return handlers.size;
    },
  };
}

describe('useMediaQuery', () => {
  it('reports the initial match state', () => {
    stubMatchMedia(true);
    const { result } = renderHook(() => useMediaQuery(MOBILE_BREAKPOINT));
    expect(result.current).toBe(true);
  });

  it('reports an initial non-match', () => {
    stubMatchMedia(false);
    const { result } = renderHook(() => useMediaQuery(MOBILE_BREAKPOINT));
    expect(result.current).toBe(false);
  });

  it('updates when the media query changes', () => {
    const media = stubMatchMedia(false);
    const { result } = renderHook(() => useMediaQuery(MOBILE_BREAKPOINT));

    act(() => media.emit(true));
    expect(result.current).toBe(true);

    act(() => media.emit(false));
    expect(result.current).toBe(false);
  });

  it('passes the query string through to matchMedia', () => {
    stubMatchMedia(false);
    renderHook(() => useMediaQuery('(min-width: 1200px)'));
    expect(window.matchMedia).toHaveBeenCalledWith('(min-width: 1200px)');
  });

  it('removes its listener on unmount', () => {
    const media = stubMatchMedia(false);
    const { unmount } = renderHook(() => useMediaQuery(MOBILE_BREAKPOINT));
    expect(media.handlerCount).toBe(1);

    unmount();
    expect(media.removeEventListener).toHaveBeenCalled();
    expect(media.handlerCount).toBe(0);
  });
});

describe('MOBILE_BREAKPOINT', () => {
  it('matches the 768px breakpoint the CSS and App layout assume', () => {
    expect(MOBILE_BREAKPOINT).toBe('(max-width: 768px)');
  });
});
