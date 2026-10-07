import { describe, it, expect, beforeEach } from 'vitest';
import { appRedirect, hasSavedWork, isAuthCallback } from './route.js';

const at = (path: string) => new URL(path, 'https://gitaconnects.com') as unknown as Location;

describe('landing page routing', () => {
  beforeEach(() => localStorage.clear());

  it('shows the landing page to a first-time visitor', () => {
    expect(hasSavedWork(localStorage)).toBe(false);
    expect(appRedirect(at('/'), localStorage)).toBeNull();
  });

  it.each([
    ['gita-connects-autosave', JSON.stringify({ savedAt: 1, nodes: [{ id: '2.47' }], edges: [] })],
    ['gita-connects-saved-networks', JSON.stringify([{ id: 'a', name: 'Morning study' }])],
    ['gita-connects-notes', JSON.stringify({ '2.47': { text: 'act', updatedAt: 1 } })],
    ['sb-abcdefgh-auth-token', JSON.stringify({ access_token: 'x' })],
  ])('sends a reader with %s to the canvas', (key, value) => {
    localStorage.setItem(key, value);
    expect(appRedirect(at('/'), localStorage)).toBe('/app');
  });

  it('ignores storage that holds nothing', () => {
    localStorage.setItem('gita-connects-saved-networks', '[]');
    localStorage.setItem('gita-connects-notes', '{}');
    localStorage.setItem('gita-connects-theme', 'dark');
    expect(hasSavedWork(localStorage)).toBe(false);
  });

  it('passes a sign-in link on to the canvas with its session intact', () => {
    expect(isAuthCallback(at('/#access_token=abc&type=magiclink'))).toBe(true);
    expect(appRedirect(at('/#access_token=abc&type=magiclink'), localStorage)).toBe(
      '/app#access_token=abc&type=magiclink',
    );
    expect(appRedirect(at('/?code=xyz'), localStorage)).toBe('/app?code=xyz');
    expect(isAuthCallback(at('/#tour'))).toBe(false);
  });
});
