/**
 * Serves Prabhupada's translation and purport for one verse, fetched from
 * vedabase.io at request time.
 *
 * The Bhaktivedanta Book Trust granted this project permission to DISPLAY
 * that text, not to redistribute it. So it is deliberately never committed to
 * this repository, never written to disk, and never bundled: it is fetched
 * when a reader opens a verse and passed straight through. That is also why
 * this is a server function rather than a browser fetch — vedabase.io sends no
 * CORS header, and proxying keeps the attribution and caching in one place.
 *
 * If this endpoint fails for any reason the client falls back to linking out,
 * so a parser break degrades to the previous behaviour rather than an error.
 */
import { parse, type HTMLElement } from 'node-html-parser';

export const config = { runtime: 'nodejs' };

const ATTRIBUTION =
  'Content used with permission of © The Bhaktivedanta Book Trust International, Inc. All rights reserved.';

const VERSE_COUNTS: Record<number, number> = {
  1: 47, 2: 72, 3: 43, 4: 42, 5: 29, 6: 47, 7: 30, 8: 28, 9: 34,
  10: 42, 11: 55, 12: 20, 13: 35, 14: 27, 15: 20, 16: 24, 17: 28, 18: 78,
};

/** Text of the first element matching `selector`, as paragraphs. */
function paragraphs(root: HTMLElement, selector: string): string[] {
  const block = root.querySelector(selector);
  if (!block) return [];

  // Vedabase wraps each paragraph in its own div; fall back to the block's own
  // text when it has no children, so a markup change degrades to one paragraph.
  const parts = block.querySelectorAll('p, div');
  const source = parts.length > 0 ? parts : [block];

  return source
    .map((node) => node.structuredText.replace(/\s+/g, ' ').trim())
    .filter((text, i, all) => text.length > 0 && all.indexOf(text) === i);
}

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const chapter = Number(url.searchParams.get('chapter'));
  const verse = Number(url.searchParams.get('verse'));

  if (
    !Number.isInteger(chapter) ||
    !Number.isInteger(verse) ||
    !(chapter in VERSE_COUNTS) ||
    verse < 1 ||
    verse > VERSE_COUNTS[chapter]
  ) {
    return Response.json({ error: 'Unknown verse' }, { status: 400 });
  }

  const source = `https://vedabase.io/en/library/bg/${chapter}/${verse}/`;

  try {
    const upstream = await fetch(source, {
      headers: { 'User-Agent': 'gita-connects (+https://gita-connects.vercel.app)' },
      signal: AbortSignal.timeout(8000),
    });
    if (!upstream.ok) {
      return Response.json({ error: `Upstream ${upstream.status}`, source }, { status: 502 });
    }

    const root = parse(await upstream.text());

    // The heading inside each block ("Translation", "Purport") is chrome, not
    // scripture — drop it so the panel shows its own labels.
    // Match the label exactly — "TEXT 47" is a heading, but a verse block
    // beginning with that word is not, and a prefix match would drop it.
    const isHeading = (text: string) =>
      /^(translation|purport|synonyms)$/i.test(text.trim()) ||
      /^text\s+[\d–-]+$/i.test(text.trim());
    const take = (selector: string) => paragraphs(root, selector).filter((t) => !isHeading(t));

    // Sanskrit and transliteration come from Vedabase too, not just the
    // translation: the imported gita/gita dataset has misaligned
    // transliterations in places (1.5 swallows the opening line of 1.6), and
    // the verse shown to a reader should match Vedabase exactly.
    const translation = take('.av-translation');
    const purport = take('.av-purport');
    const devanagari = take('.av-devanagari');
    const verseText = take('.av-verse_text');
    const synonyms = take('.av-synonyms');

    if (translation.length === 0) {
      return Response.json({ error: 'Could not read the verse', source }, { status: 502 });
    }

    return Response.json(
      {
        id: `${chapter}.${verse}`,
        sanskrit: devanagari.join(' '),
        transliteration: verseText.join(' '),
        synonyms: synonyms.join(' '),
        translation: translation.join(' '),
        purport,
        attribution: ATTRIBUTION,
        source,
      },
      {
        // Cache at the edge so a popular verse is not refetched per reader.
        // Short-lived and never persisted to the repo or to disk.
        headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
      },
    );
  } catch {
    return Response.json({ error: 'Vedabase is unreachable', source }, { status: 504 });
  }
}
