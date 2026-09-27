/**
 * Serves Prabhupada's translation and purport for one verse, from the first
 * source that has it: a local copy of the book on this machine (localCopy),
 * the private bbt_verses table in Supabase on the deployed site
 * (fromSupabase), or else vedabase.io, fetched at request time.
 *
 * The text is the Bhaktivedanta Book Trust's copyright. It is deliberately
 * never committed to this repository and never bundled: the local copy lives
 * in gitignored private/, the hosted copy in a table no browser can read, and
 * a fetched verse is passed straight through. This is a server function
 * rather than a browser fetch because vedabase.io sends no CORS header, and
 * one endpoint keeps the attribution in one place.
 *
 * If this endpoint fails for any reason the client falls back to linking out,
 * so a parser break degrades to the previous behaviour rather than an error.
 */
import { parse, type HTMLElement } from 'node-html-parser';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { vedabasePage } from '../src/data/vedabase.js';

// Node.js runtime is the default; no config export needed.

const ATTRIBUTION =
  'Content used with permission of © The Bhaktivedanta Book Trust International, Inc. All rights reserved.';

const VERSE_COUNTS: Record<number, number> = {
  1: 47, 2: 72, 3: 43, 4: 42, 5: 29, 6: 47, 7: 30, 8: 28, 9: 34,
  10: 42, 11: 55, 12: 20, 13: 35, 14: 27, 15: 20, 16: 24, 17: 28, 18: 78,
};

/**
 * A local copy of the book, imported from the BBT's EPUB by
 * scripts/import-bbt.ts into private/ (gitignored, never committed). When it
 * is present, verses are served from it and vedabase.io is not contacted at
 * all; when it is not, as on a deploy built from the repository, the verse is
 * fetched from Vedabase as before. Read once per process.
 */
type LocalVerse = { sanskrit: string; transliteration: string; synonyms: string; translation: string; purport: string[] };
let local: Record<string, LocalVerse> | null | undefined;
function localCopy(): Record<string, LocalVerse> | null {
  if (local === undefined) {
    try {
      local = JSON.parse(readFileSync(join(process.cwd(), 'private', 'bbt', 'bg.json'), 'utf8')).pages;
    } catch {
      local = null;
    }
  }
  return local ?? null;
}

/**
 * The book on the deployed site, where there is no local copy: the
 * bbt_verses table in Supabase (supabase/migrations/0004_bbt_verses.sql),
 * filled by `npm run bbt:upload`. Browsers cannot read that table; this reads
 * it through Supabase's REST API with the service-role key, a server-only
 * environment variable (never VITE_-prefixed, so never in the bundle).
 * Returns null when not configured or on any failure, so the caller falls
 * back to Vedabase.
 */
async function fromSupabase(page: string): Promise<LocalVerse | null> {
  const base = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) {
    // Names only, never values: this is the first thing to check in the logs.
    console.error(`[api/verse] Supabase not configured: ${!base ? 'SUPABASE_URL' : 'SUPABASE_SERVICE_ROLE_KEY'} is not set`);
    return null;
  }
  const url = new URL('/rest/v1/bbt_verses', base);
  url.searchParams.set('page', `eq.${page}`);
  url.searchParams.set('select', 'sanskrit,transliteration,synonyms,translation,purport');
  // Legacy keys are JWTs and go in both headers; the newer sb_secret_ keys
  // belong in apikey alone.
  const headers: Record<string, string> = { apikey: key };
  if (!key.startsWith('sb_')) headers.Authorization = `Bearer ${key}`;
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(5000) });
    if (!res.ok) {
      console.error(`[api/verse] Supabase answered ${res.status} for ${page}`);
      return null;
    }
    const [row] = (await res.json()) as LocalVerse[];
    if (!row?.translation) {
      console.error(`[api/verse] bbt_verses has no row for ${page}; has \`npm run bbt:upload\` been run?`);
      return null;
    }
    return row;
  } catch (err) {
    console.error(`[api/verse] Supabase unreachable for ${page}: ${String(err)}`);
    return null;
  }
}

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

// A named method export. Vercel's Node runtime only uses the Web-standard
// Request/Response signature for GET/POST/... exports; a default export is
// invoked Node-style as (req, res), in which case a returned Response is
// ignored and the function hangs waiting for res.end().
export async function GET(request: Request): Promise<Response> {
  // Base is only used for parsing; request.url is absolute under the Web
  // signature but this stays safe if a runtime ever passes a bare path.
  const url = new URL(request.url, 'http://localhost');
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

  const page = vedabasePage(chapter, verse);
  const source = `https://vedabase.io/en/library/bg/${page}/`;

  const stored = localCopy()?.[page];
  if (stored) {
    return Response.json(
      { id: `${chapter}.${verse}`, ...stored, attribution: ATTRIBUTION, source },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  }

  const hosted = await fromSupabase(page);
  if (hosted) {
    return Response.json(
      { id: `${chapter}.${verse}`, ...hosted, attribution: ATTRIBUTION, source },
      // As for a Vedabase fetch below: cached at the edge, never persisted.
      { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } },
    );
  }

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
