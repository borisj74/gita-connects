import { useEffect, useState } from 'react';

export interface VerseText {
  sanskrit: string;
  transliteration: string;
  synonyms: string;
  translation: string;
  purport: string[];
  attribution: string;
  source: string;
}

export type VerseTextState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; text: VerseText }
  | { status: 'unavailable' };

/**
 * Fetches Prabhupada's translation and purport for a verse from our own
 * /api/verse endpoint, which proxies vedabase.io.
 *
 * The Bhaktivedanta Book Trust permits this project to display that text but
 * not to redistribute it, so it is fetched per view and never stored. When the
 * fetch fails the caller falls back to linking out to vedabase.io, so a parser
 * break or an outage degrades gracefully instead of emptying the panel.
 *
 * Pass a null id to stand down — the hook still runs, keeping hook order
 * stable in callers that render an empty state.
 */
export function useVerseText(verseId: string | null): VerseTextState {
  const [state, setState] = useState<VerseTextState>({ status: 'idle' });
  const [requested, setRequested] = useState<string | null>(verseId);

  // Reset during render rather than in the effect: setting state inside an
  // effect body would queue a second render pass for every verse change.
  if (verseId !== requested) {
    setRequested(verseId);
    setState(verseId ? { status: 'loading' } : { status: 'idle' });
  }

  useEffect(() => {
    if (!verseId) return;

    const [chapter, verse] = verseId.split('.');
    const controller = new AbortController();

    fetch(`/api/verse?chapter=${chapter}&verse=${verse}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((text: VerseText) => {
        if (!text.translation?.trim()) throw new Error('Empty translation');
        setState({ status: 'ready', text });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        // The panel only ever says "could not load", which hid a dev-server
        // misconfiguration once already. Put the real reason in the console.
        console.error(`[verse ${verseId}] translation unavailable:`, error);
        setState({ status: 'unavailable' });
      });

    return () => controller.abort();
  }, [verseId]);

  return state;
}
