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
// Shared cache: a verse opened in the panel and shown on a card is fetched
// once per session. Promises are cached too so concurrent mounts share one
// request. Text lives in memory only, never in storage.
const cache = new Map<string, VerseText | Promise<VerseText>>();

/** Fetch (or reuse) the translation for a verse id like "2.47". */
export function fetchVerseText(verseId: string, signal?: AbortSignal): Promise<VerseText> {
  const hit = cache.get(verseId);
  if (hit) return Promise.resolve(hit);

  const [chapter, verse] = verseId.split('.');
  const request = fetch(`/api/verse?chapter=${chapter}&verse=${verse}`, { signal })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
    .then((text: VerseText) => {
      if (!text.translation?.trim()) throw new Error('Empty translation');
      cache.set(verseId, text);
      return text;
    })
    .catch((error: unknown) => {
      cache.delete(verseId);
      throw error;
    });
  cache.set(verseId, request);
  return request;
}

/** Synchronous lookup for text already fetched this session. */
export function cachedVerseText(verseId: string): VerseText | undefined {
  const hit = cache.get(verseId);
  return hit && !(hit instanceof Promise) ? hit : undefined;
}

export function useVerseText(verseId: string | null): VerseTextState {
  const initial = (id: string | null): VerseTextState => {
    if (!id) return { status: 'idle' };
    const cached = cachedVerseText(id);
    return cached ? { status: 'ready', text: cached } : { status: 'loading' };
  };
  const [state, setState] = useState<VerseTextState>(() => initial(verseId));
  const [requested, setRequested] = useState<string | null>(verseId);

  // Reset during render rather than in the effect: setting state inside an
  // effect body would queue a second render pass for every verse change.
  if (verseId !== requested) {
    setRequested(verseId);
    setState(initial(verseId));
  }

  useEffect(() => {
    if (!verseId || cachedVerseText(verseId)) return;

    // The request is shared through the cache and may have other readers, so
    // unmount just stops listening rather than aborting it.
    let alive = true;

    fetchVerseText(verseId)
      .then((text) => {
        if (alive) setState({ status: 'ready', text });
      })
      .catch((error: unknown) => {
        if (!alive) return;
        // The panel only ever says "could not load", which hid a dev-server
        // misconfiguration once already. Put the real reason in the console.
        console.error(`[verse ${verseId}] translation unavailable:`, error);
        setState({ status: 'unavailable' });
      });

    return () => {
      alive = false;
    };
  }, [verseId]);

  return state;
}
