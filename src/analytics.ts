/**
 * Visit counts, with Vercel Web Analytics: no cookies, nothing stored in the
 * browser (see the cookie policy, "Visit counts on the home page").
 *
 * Only two things are ever counted. The landing page counts its own visits,
 * and the app counts one arrival when it is opened from a landing-page
 * button, named after that button. Nothing a reader does inside the app is
 * counted, and opening the app any other way sends nothing at all.
 */
import { inject, pageview } from '@vercel/analytics';

/** The landing page's buttons tag their link to the app with ?from=<place>. */
export const FROM_PARAM = 'from';
const PLACE = /^[a-z][a-z-]{0,23}$/;

// Local development and tests send nothing; Vercel serves the script and
// receives the counts on its own deployments only.
const enabled = import.meta.env.PROD;

// Automatic tracking stays off, so the script never counts anything on its
// own (a later route change in the app, say). Each page sends the one view
// it means to, by hand.
function countOnce(path: string): void {
  inject({ mode: 'production', framework: 'vite', disableAutoTrack: true });
  pageview({ path });
}

export function countLandingVisit(): void {
  if (enabled) countOnce(window.location.pathname);
}

/**
 * Where the app was opened from, taken off the address so a reload or a
 * shared link is not counted again. Null when the app was not opened from a
 * landing-page button.
 */
export function takeArrivalPlace(location: Location, history: History): string | null {
  const url = new URL(location.href);
  const place = url.searchParams.get(FROM_PARAM);
  if (place === null) return null;
  url.searchParams.delete(FROM_PARAM);
  history.replaceState(history.state, '', url);
  return PLACE.test(place) ? place : null;
}

/** Count one arrival in the app from a landing-page button, then nothing more. */
export function countArrivalFromLanding(): void {
  const place = takeArrivalPlace(window.location, window.history);
  if (place && enabled) countOnce(`/app/from-${place}`);
}
