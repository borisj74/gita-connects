/**
 * The small settings that are worth carrying between devices: the custom link
 * types a reader invented, which link types they have hidden, light or dark,
 * and which sections of the verse panel they keep open.
 *
 * These already lived in localStorage under four separate keys, written from
 * three different components. This does not move them — the keys and their
 * shapes are unchanged — it adds the two things cloud sync needs and nothing
 * else had: a timestamp to merge on, and a way to hear that something changed.
 *
 * Local edits call `settingsChanged`, which sync listens for. A pull calls
 * `applyRemoteSettings`, which writes the keys and fires a separate signal the
 * UI listens for. Keeping the two directions apart is what stops a pull from
 * looking like an edit and bouncing straight back to the server.
 */
import { useSyncExternalStore } from 'react';
import { loadCustomConnectionTypes, saveCustomConnectionTypes, type ConnectionTypeDef } from './connectionTypes.js';

const HIDDEN_FILTERS_KEY = 'gita-connects-hidden-filters';
const DETAIL_SECTIONS_KEY = 'gita-connects-detail-sections';
const THEME_KEY = 'gita-connects-theme';
const CUSTOM_TYPES_KEY = 'gita-connects-custom-connection-types';
const UPDATED_KEY = 'gita-connects-prefs-updated';

export type Theme = 'light' | 'dark';

export interface Preferences {
  theme: Theme;
  hiddenFilters: string[];
  detailSections: Record<string, boolean>;
  /** When this device last changed any of the above. */
  updatedAt: number;
}

/** A custom link type as stored, with the timestamp merging needs. */
export type StoredType = ConnectionTypeDef & { updatedAt?: number };

const readJson = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

export function readPreferences(): Preferences {
  const theme = localStorage.getItem(THEME_KEY);
  return {
    theme: theme === 'dark' ? 'dark' : 'light',
    hiddenFilters: readJson<string[]>(HIDDEN_FILTERS_KEY, []),
    detailSections: readJson<Record<string, boolean>>(DETAIL_SECTIONS_KEY, {}),
    updatedAt: Number(localStorage.getItem(UPDATED_KEY) ?? 0),
  };
}

export const readCustomTypes = (): StoredType[] => loadCustomConnectionTypes() as StoredType[];

// --- change signals -------------------------------------------------------

const localListeners = new Set<() => void>();
const remoteListeners = new Set<() => void>();

const WATCHED_KEYS = [THEME_KEY, HIDDEN_FILTERS_KEY, DETAIL_SECTIONS_KEY, CUSTOM_TYPES_KEY];

const snapshot = () => WATCHED_KEYS.map((k) => localStorage.getItem(k) ?? '').join('\u0000');

/**
 * Run a write and stamp the settings only if it actually changed something.
 *
 * The obvious alternative — skipping the first run of each effect — does not
 * survive StrictMode, which mounts twice and keeps refs between the passes, so
 * the guard is already spent by the time the real write happens. Comparing the
 * stored value cannot be fooled by when or how often an effect runs.
 */
export function persistWithSignal(write: () => void): void {
  const before = snapshot();
  write();
  if (snapshot() !== before) settingsChanged();
}

/** Call after a local edit so sync knows there is something to push. */
export function settingsChanged(): void {
  try {
    localStorage.setItem(UPDATED_KEY, String(Date.now()));
  } catch {
    // Preference only; losing the stamp costs a redundant push, not data.
  }
  localListeners.forEach((l) => l());
}

export function subscribeSettings(listener: () => void): () => void {
  localListeners.add(listener);
  return () => {
    localListeners.delete(listener);
  };
}

/**
 * Write settings pulled from another device, then tell the UI to re-read.
 * Deliberately does not fire the local signal: this is not an edit.
 */
export function applyRemoteSettings(prefs: Preferences, customTypes: StoredType[]): void {
  try {
    localStorage.setItem(THEME_KEY, prefs.theme);
    localStorage.setItem(HIDDEN_FILTERS_KEY, JSON.stringify(prefs.hiddenFilters));
    localStorage.setItem(DETAIL_SECTIONS_KEY, JSON.stringify(prefs.detailSections));
    localStorage.setItem(UPDATED_KEY, String(prefs.updatedAt));
    saveCustomConnectionTypes(customTypes);
  } catch {
    // Full quota: the session keeps what it has rather than half-applying.
    return;
  }
  version += 1;
  remoteListeners.forEach((l) => l());
}

export function subscribeRemoteSettings(listener: () => void): () => void {
  remoteListeners.add(listener);
  return () => {
    remoteListeners.delete(listener);
  };
}

let version = 0;

/** Re-render the caller whenever settings arrive from another device. */
export const useRemoteSettingsVersion = (): number =>
  useSyncExternalStore(subscribeRemoteSettings, () => version, () => 0);

/** Test hook: forget subscribers between tests. */
export function _resetSettingsForTests(): void {
  localListeners.clear();
  remoteListeners.clear();
  version = 0;
}
