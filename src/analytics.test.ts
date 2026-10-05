import { describe, it, expect, beforeEach } from 'vitest';
import { takeArrivalPlace } from './analytics.js';

describe('arrival from the landing page', () => {
  beforeEach(() => window.history.replaceState(null, '', '/app'));

  it('reads the button the reader came from and takes it off the address', () => {
    window.history.replaceState(null, '', '/app?from=how-connect#x');
    expect(takeArrivalPlace(window.location, window.history)).toBe('how-connect');
    expect(window.location.pathname + window.location.search + window.location.hash).toBe('/app#x');
  });

  it('counts nothing when the app was opened another way', () => {
    expect(takeArrivalPlace(window.location, window.history)).toBeNull();
  });

  it('refuses a place that is not one of ours', () => {
    window.history.replaceState(null, '', '/app?from=%3Cscript%3E');
    expect(takeArrivalPlace(window.location, window.history)).toBeNull();
    expect(window.location.search).toBe('');
  });
});
