import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Counting only runs in production builds, so these tests load the module
// with PROD on and the Vercel package mocked.
const inject = vi.fn();
const pageview = vi.fn();
vi.mock('@vercel/analytics', () => ({ inject, pageview }));

async function load() {
  vi.resetModules();
  vi.stubEnv('PROD', true);
  return import('./analytics.js');
}

describe('visit counts in production', () => {
  beforeEach(() => {
    inject.mockClear();
    pageview.mockClear();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    window.history.replaceState(null, '', '/');
  });

  it('sends one view for the landing page, with automatic tracking off', async () => {
    window.history.replaceState(null, '', '/home');
    (await load()).countLandingVisit();
    expect(inject).toHaveBeenCalledWith(expect.objectContaining({ disableAutoTrack: true }));
    expect(pageview).toHaveBeenCalledTimes(1);
    expect(pageview).toHaveBeenCalledWith({ path: '/home' });
  });

  it('sends one view named after the button that opened the app', async () => {
    window.history.replaceState(null, '', '/app?from=hero');
    (await load()).countArrivalFromLanding();
    expect(pageview).toHaveBeenCalledTimes(1);
    expect(pageview).toHaveBeenCalledWith({ path: '/app/from-hero' });
  });

  it('sends nothing when the app is opened any other way', async () => {
    window.history.replaceState(null, '', '/app');
    (await load()).countArrivalFromLanding();
    expect(inject).not.toHaveBeenCalled();
    expect(pageview).not.toHaveBeenCalled();
  });
});
