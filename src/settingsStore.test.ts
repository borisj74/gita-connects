import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  persistWithSignal, subscribeSettings, readPreferences, applyRemoteSettings,
  subscribeRemoteSettings, _resetSettingsForTests,
} from './settingsStore.js';

const THEME = 'gita-connects-theme';
const UPDATED = 'gita-connects-prefs-updated';

describe('persistWithSignal', () => {
  beforeEach(() => {
    localStorage.clear();
    _resetSettingsForTests();
  });

  it('stamps and notifies when the write changes something', () => {
    const heard = vi.fn();
    subscribeSettings(heard);
    persistWithSignal(() => localStorage.setItem(THEME, 'dark'));
    expect(heard).toHaveBeenCalledOnce();
    expect(localStorage.getItem(UPDATED)).not.toBeNull();
  });

  it('stays quiet when the write leaves the value as it was', () => {
    localStorage.setItem(THEME, 'dark');
    const heard = vi.fn();
    subscribeSettings(heard);
    // This is what every mount does: re-persist what is already stored.
    persistWithSignal(() => localStorage.setItem(THEME, 'dark'));
    expect(heard).not.toHaveBeenCalled();
    expect(localStorage.getItem(UPDATED)).toBeNull();
  });
});

describe('applyRemoteSettings', () => {
  beforeEach(() => {
    localStorage.clear();
    _resetSettingsForTests();
  });

  it('writes the pulled settings and tells the UI, but not the pusher', () => {
    const local = vi.fn();
    const remote = vi.fn();
    subscribeSettings(local);
    subscribeRemoteSettings(remote);

    applyRemoteSettings(
      { theme: 'dark', hiddenFilters: ['goal'], detailSections: { sanskrit: true }, updatedAt: 42 },
      [{ id: 'custom-x', label: 'X', color: '#5e9b8e', isCustom: true, updatedAt: 42 }],
    );

    expect(readPreferences()).toEqual({
      theme: 'dark',
      hiddenFilters: ['goal'],
      detailSections: { sanskrit: true },
      updatedAt: 42,
    });
    expect(remote).toHaveBeenCalledOnce();
    // A pull is not an edit; signalling one would push it straight back.
    expect(local).not.toHaveBeenCalled();
  });
});

describe('readPreferences', () => {
  beforeEach(() => {
    localStorage.clear();
    _resetSettingsForTests();
  });

  it('falls back to sane values on an empty or corrupt store', () => {
    expect(readPreferences()).toEqual({ theme: 'light', hiddenFilters: [], detailSections: {}, updatedAt: 0 });
    localStorage.setItem('gita-connects-hidden-filters', '{not json');
    expect(readPreferences().hiddenFilters).toEqual([]);
  });
});
