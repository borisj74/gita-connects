// Regenerates src/data/verses/ch-NN.json from the public-domain gita/gita
// dataset (Unlicense). Only the Sanskrit, its transliteration, and the
// word-by-word glosses are imported — all public domain. No English
// translation is copied: Prabhupada's translation and purport are under
// Bhaktivedanta Book Trust copyright, so the app deep-links to vedabase.io
// for those instead of reproducing them.
//
// Usage: node scripts/import-verses.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE = 'https://raw.githubusercontent.com/gita/gita/main/data/verse.json';
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'verses');

// Verse counts per chapter in Bhagavad-gita, used to validate the import.
const EXPECTED = {
  1: 47, 2: 72, 3: 43, 4: 42, 5: 29, 6: 47, 7: 30, 8: 28, 9: 34,
  10: 42, 11: 55, 12: 20, 13: 35, 14: 27, 15: 20, 16: 24, 17: 28, 18: 78,
};
const EXPECTED_TOTAL = Object.values(EXPECTED).reduce((a, b) => a + b, 0);

/** Collapse the dataset's embedded newlines and stray spacing into one line. */
const tidy = (s) => (s ?? '').replace(/\s*\n\s*/g, ' ').replace(/\s+/g, ' ').trim();

/** Strip the trailing "।।1.1।।" verse marker the Devanagari text carries. */
const stripMarker = (s) => tidy(s).replace(/।*\s*\d+\.\d+\s*।*।*\s*$/, '').trim();

const response = await fetch(SOURCE);
if (!response.ok) {
  throw new Error(`Failed to fetch ${SOURCE}: HTTP ${response.status}`);
}
const raw = await response.json();

if (raw.length !== EXPECTED_TOTAL) {
  throw new Error(`Expected ${EXPECTED_TOTAL} verses, dataset has ${raw.length}`);
}

const byChapter = new Map();
for (const v of raw) {
  const chapter = v.chapter_number;
  const verse = v.verse_number;
  const entry = {
    id: `${chapter}.${verse}`,
    chapter,
    verse,
    sanskrit: stripMarker(v.text),
    transliteration: tidy(v.transliteration),
    wordMeanings: tidy(v.word_meanings),
  };
  for (const field of ['sanskrit', 'transliteration', 'wordMeanings']) {
    if (!entry[field]) throw new Error(`${entry.id} has an empty ${field}`);
  }
  byChapter.set(chapter, [...(byChapter.get(chapter) ?? []), entry]);
}

await mkdir(OUT_DIR, { recursive: true });

for (const [chapter, expected] of Object.entries(EXPECTED)) {
  const num = Number(chapter);
  const entries = (byChapter.get(num) ?? []).sort((a, b) => a.verse - b.verse);

  if (entries.length !== expected) {
    throw new Error(`Chapter ${num}: expected ${expected} verses, got ${entries.length}`);
  }
  entries.forEach((entry, i) => {
    if (entry.verse !== i + 1) {
      throw new Error(`Chapter ${num}: verse numbering breaks at ${entry.id}`);
    }
  });

  const file = join(OUT_DIR, `ch-${String(num).padStart(2, '0')}.json`);
  await writeFile(file, `${JSON.stringify(entries, null, 2)}\n`, 'utf8');
  console.log(`ch-${String(num).padStart(2, '0')}.json  ${entries.length} verses`);
}

console.log(`\nImported ${raw.length} verses into ${OUT_DIR}`);
