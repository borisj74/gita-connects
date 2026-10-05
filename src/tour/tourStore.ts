/**
 * Whether this browser has seen the guided tour. Remembered locally, like the
 * theme: the welcome shows once, and ⋯ → Take the tour replays it any time.
 */
import { AUTOSAVE_KEY } from '../autosave.js';
import { NOTES_KEY } from '../notes.js';
import { NETWORKS_KEY } from '../networksStore.js';

export const TOUR_KEY = 'gita-connects-tour';
const CONNECT_HINT_KEY = 'gita-connects-connect-hint-dismissed';

export type TourStatus = 'done' | 'skipped';

export function readTourStatus(): TourStatus | null {
  try {
    const value = localStorage.getItem(TOUR_KEY);
    return value === 'done' || value === 'skipped' ? value : null;
  } catch {
    return null;
  }
}

export function saveTourStatus(status: TourStatus): void {
  try {
    localStorage.setItem(TOUR_KEY, status);
  } catch {
    // The welcome just shows again next visit — not worth surfacing.
  }
}

/** Something stored under `key` that isn't empty ("[]", "{}"). */
function has(key: string): boolean {
  try {
    const raw = localStorage.getItem(key);
    return !!raw && raw !== '[]' && raw !== '{}';
  } catch {
    return false;
  }
}

/**
 * Someone who used the app before the tour existed: they have a canvas,
 * saved networks or notes, or already drew a connection. They are not
 * greeted as new; the tour is there for them in the ⋯ menu.
 */
export function isReturningVisitor(): boolean {
  return has(AUTOSAVE_KEY) || has(NETWORKS_KEY) || has(NOTES_KEY) || has(CONNECT_HINT_KEY);
}

/** Show the welcome on this visit? */
export function shouldWelcome(): boolean {
  return readTourStatus() === null && !isReturningVisitor();
}
