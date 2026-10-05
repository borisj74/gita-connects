import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { BeforeSend } from '@vercel/analytics';

// Counting only runs in production builds, so these tests load the module
// with PROD on and the Vercel package mocked, then play the script's part:
// it calls beforeSend with each event it is about to send.
const inject = vi.fn();
vi.mock('@vercel/analytics', () => ({ inject }));

async function load() {
  vi.resetModules();
  vi.stubEnv('PROD', true);
  return import('./analytics.js');
}

const filter = (): BeforeSend => inject.mock.calls[0][0].beforeSend;
const view = (path: string) => ({ type: 'pageview' as const, url: `${window.location.origin}${path}` });

describe('visit counts in production', () => {
  beforeEach(() => inject.mockClear());
  afterEach(() => {
    vi.unstubAllEnvs();
    window.history.replaceState(null, '', '/');
  });

  it('lets the landing page’s own view through once, with automatic tracking on', async () => {
    window.history.replaceState(null, '', '/home');
    (await load()).countLandingVisit();
    expect(inject).toHaveBeenCalledTimes(1);
    expect(inject.mock.calls[0][0].disableAutoTrack).toBeUndefined();
    expect(filter()(view('/home'))?.url).toBe(`${window.location.origin}/home`);
    expect(filter()(view('/home#tour'))).toBeNull();
  });

  it('names the app’s one view after the button that opened it', async () => {
    window.history.replaceState(null, '', '/app?from=hero');
    (await load()).countArrivalFromLanding();
    expect(filter()(view('/app'))?.url).toBe(`${window.location.origin}/app/from-hero`);
    expect(filter()(view('/app'))).toBeNull();
    expect(filter()({ type: 'event', url: view('/app').url })).toBeNull();
  });

  it('loads nothing when the app is opened any other way', async () => {
    window.history.replaceState(null, '', '/app');
    (await load()).countArrivalFromLanding();
    expect(inject).not.toHaveBeenCalled();
  });
});
