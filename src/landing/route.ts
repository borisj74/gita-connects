/**
 * Who sees the landing page at /, and who goes straight to the canvas.
 *
 * The landing page is for people meeting Gita Connects for the first time.
 * Someone with work in this browser, or signed in, came back to read, so
 * they are sent on to /app. So is a sign-in link from an older email, which
 * still points at / and carries the session in the address.
 */
import { AUTOSAVE_KEY } from '../autosave.js';
import { NETWORKS_KEY } from '../networksStore.js';
import { NOTES_KEY } from '../notes.js';

/** Supabase keeps a signed-in session under sb-<project>-auth-token. */
const SESSION_KEY = /^sb-.+-auth-token$/;

function hasContent(raw: string | null): boolean {
  if (!raw) return false;
  try {
    const value: unknown = JSON.parse(raw);
    if (Array.isArray(value)) return value.length > 0;
    if (value && typeof value === 'object') return Object.keys(value).length > 0;
    return Boolean(value);
  } catch {
    return false;
  }
}

/** Whether this browser holds the reader's work or a signed-in session. */
export function hasSavedWork(storage: Storage): boolean {
  try {
    if (hasContent(storage.getItem(AUTOSAVE_KEY))) return true;
    if (hasContent(storage.getItem(NETWORKS_KEY))) return true;
    if (hasContent(storage.getItem(NOTES_KEY))) return true;
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key && SESSION_KEY.test(key) && storage.getItem(key)) return true;
    }
  } catch {
    // Storage blocked: nothing saved here that we can see.
  }
  return false;
}

/** Whether the address carries a sign-in result for the app to pick up. */
export function isAuthCallback(location: Pick<Location, 'hash' | 'search'>): boolean {
  const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
  const search = new URLSearchParams(location.search);
  return (
    hash.has('access_token') ||
    hash.has('error_description') ||
    search.has('code') ||
    search.has('error_description')
  );
}

/** The address to send this visitor to instead of the landing page, if any. */
export function appRedirect(location: Location, storage: Storage): string | null {
  if (!isAuthCallback(location) && !hasSavedWork(storage)) return null;
  // Keep the query and the fragment: a sign-in link's session travels in them.
  return `/app${location.search}${location.hash}`;
}
