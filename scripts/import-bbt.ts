/**
 * Imports Bhagavad-gita As It Is from the BBT's EPUB into a private local
 * file, private/bbt/bg.json, which api/verse.ts serves instead of fetching
 * each verse from vedabase.io.
 *
 * The text is the Bhaktivedanta Book Trust's copyright. private/ is
 * gitignored: the file must never be committed, bundled or published. Run
 * this on each machine that serves the app, from your own copy of the EPUB.
 *
 *   npm run import:bbt -- ~/Downloads/EN_BG_epub_r11.epub
 *   npm run import:bbt -- ~/Downloads/bg_text          (the EPUB, unzipped)
 *
 * Every one of our 701 verses is checked to land on a section of the book,
 * using the same verse-to-page mapping as the Vedabase link.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, type HTMLElement } from 'node-html-parser';
import { vedabasePage } from '../src/data/vedabase.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'private', 'bbt', 'bg.json');
const VERSES_DIR = join(ROOT, 'src', 'data', 'verses');

export interface BbtVerse {
  sanskrit: string;
  transliteration: string;
  synonyms: string;
  translation: string;
  purport: string[];
}

const input = process.argv[2];
if (!input || !existsSync(input)) {
  console.error('Usage: npm run import:bbt -- <path to the EPUB, or to the folder it unzips to>');
  process.exit(1);
}

// An EPUB is a zip; unpack it to a temporary folder first.
let dir = input;
let unpacked: string | undefined;
if (statSync(input).isFile()) {
  unpacked = mkdtempSync(join(tmpdir(), 'bbt-'));
  execFileSync('unzip', ['-q', input, '-d', unpacked]);
  dir = unpacked;
}

/** Every file below `dir` whose name matches, e.g. OEBPS/ENBG02XT.xhtml. */
function find(from: string, pattern: RegExp): string[] {
  return readdirSync(from, { withFileTypes: true }).flatMap((e) => {
    const path = join(from, e.name);
    if (e.isDirectory()) return e.name === '__MACOSX' ? [] : find(path, pattern);
    return pattern.test(e.name) ? [path] : [];
  });
}

const chapterFiles = find(dir, /^ENBG(\d\d)XT\.xhtml$/).sort();
if (chapterFiles.length !== 18) {
  console.error(`Expected 18 chapter files (ENBG01XT.xhtml … ENBG18XT.xhtml), found ${chapterFiles.length}. Is this the English Bhagavad-gita As It Is EPUB?`);
  process.exit(1);
}

const tidy = (s: string) => s.replace(/\s+/g, ' ').trim();
/** Text of an element, with line breaks inside verses as spaces. */
const textOf = (el: HTMLElement) => tidy(el.innerHTML.replace(/<br\s*\/?>/g, ' ').replace(/<[^>]+>/g, '').replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d))));

const pages: Record<string, BbtVerse> = {};

for (const file of chapterFiles) {
  const chapter = Number(/ENBG(\d\d)XT/.exec(file)![1]);
  const body = parse(readFileSync(file, 'utf8')).querySelector('body')!;

  // Walk the chapter in order. Each "Text 47" / "Texts 16–18" heading starts
  // a section; the h3 headings switch between its parts.
  let key: string | undefined;
  let part: 'verse' | 'synonyms' | 'translation' | 'purport' | undefined;
  const walk = (nodes: HTMLElement[]) => {
    for (const el of nodes) {
      if (el.nodeType !== 1) continue;
      const cls = el.getAttribute('class') ?? '';
      if (el.tagName === 'H2' && cls.includes('header-number')) {
        const m = /Texts?\s+(\d+)(?:\s*[–-]\s*(\d+))?/.exec(textOf(el));
        if (!m) continue;
        key = m[2] ? `${chapter}/${m[1]}-${m[2]}` : `${chapter}/${m[1]}`;
        pages[key] = { sanskrit: '', transliteration: '', synonyms: '', translation: '', purport: [] };
        part = 'verse';
        continue;
      }
      if (!key || !part) continue;
      const v = pages[key];
      if (el.tagName === 'H3') {
        part = cls.startsWith('synonyms') ? 'synonyms' : cls.startsWith('translation') ? 'translation' : cls.startsWith('purport') ? 'purport' : part;
        continue;
      }
      if (part === 'verse' && el.tagName === 'DIV') {
        const text = textOf(el);
        // The book writes the double danda as two single ones (।।); use the
        // proper character (॥), as Vedabase does.
        if (cls.startsWith('indic-')) v.sanskrit = tidy(`${v.sanskrit} ${text.replace(/।\s*।/g, '॥')}`);
        else v.transliteration = tidy(`${v.transliteration} ${text}`);
      } else if (part === 'synonyms' && cls === 'synonyms') {
        v.synonyms = textOf(el);
      } else if (part === 'translation' && el.tagName === 'P') {
        v.translation = tidy(`${v.translation} ${textOf(el)}`);
      } else if (part === 'purport') {
        // Hidden cross-references are markup for the e-reader, not text.
        if (cls.includes('invisible')) continue;
        if (el.tagName === 'DIV') walk(el.childNodes as HTMLElement[]);
        else if (el.tagName === 'P') {
          const text = textOf(el);
          if (text) v.purport.push(text);
        }
      }
    }
  };
  walk(body.childNodes as HTMLElement[]);
}

// Every one of our verses must land on a section with a translation.
const verses = readdirSync(VERSES_DIR)
  .filter((f) => f.endsWith('.json'))
  .flatMap((f) => JSON.parse(readFileSync(join(VERSES_DIR, f), 'utf8')) as { id: string; chapter: number; verse: number }[]);
const missing = verses.filter((v) => !pages[vedabasePage(v.chapter, v.verse)]?.translation).map((v) => v.id);
const noSynonyms = Object.entries(pages).filter(([, v]) => !v.synonyms || !v.sanskrit || !v.transliteration).map(([k]) => k);

if (unpacked) rmSync(unpacked, { recursive: true, force: true });

if (missing.length) {
  console.error(`${missing.length} of our verses have no section in the book: ${missing.slice(0, 20).join(', ')}`);
  process.exit(1);
}

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify({ edition: 'Bhagavad-gita As It Is (BBT EPUB)', pages }), 'utf8');

const withPurport = Object.values(pages).filter((v) => v.purport.length).length;
console.log(`${Object.keys(pages).length} sections of the book; all ${verses.length} of our verses found.`);
console.log(`${withPurport} sections have a purport.${noSynonyms.length ? ` Incomplete sections: ${noSynonyms.join(', ')}` : ''}`);
console.log(`Wrote ${OUT} (never commit this file).`);
