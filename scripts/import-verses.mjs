// Regenerates src/data/verses/ch-NN.json from the public-domain gita/gita
// dataset (Unlicense). Only the Sanskrit and its transliteration are
// imported. No English is copied: the dataset's word-by-word glosses have no
// stated source, and the app's English — Prabhupada's translation, synonyms
// and purport — is displayed from vedabase.io under the Bhaktivedanta Book
// Trust's permission, never stored.
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

// Upstream's Devanagari is split by verse correctly, but its transliteration
// is not: some verses run on into the next one (2.42 holds all of 2.43, 1.5
// holds the first line of 1.6), the next verse then repeats it in a different
// spelling, and a few lines carry Devanagari instead of roman. So the
// transliteration is realigned to the Devanagari, verse by verse, using the
// syllable count of each Devanagari verse to find where its roman text ends.

/** Syllables in Devanagari: independent vowels, plus consonants not followed by a virama. */
function devanagariSyllables(s) {
  const chars = [...s];
  let n = 0;
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i].codePointAt(0);
    if ((c >= 0x0905 && c <= 0x0914) || c === 0x0950 || c === 0x0960 || c === 0x0961) n++;
    else if ((c >= 0x0915 && c <= 0x0939) || (c >= 0x0958 && c <= 0x095f)) {
      const next = chars[i + 1] === '\u093C' ? chars[i + 2] : chars[i + 1];
      if (next !== '\u094D') n++;
    }
  }
  return n;
}

/** Syllables in roman transliteration. Vocalic ṛ is spelled "ṛi" or "ṛ" upstream; both count once. */
function romanSyllables(s) {
  const t = s
    .normalize('NFD')
    .toLowerCase()
    .replace(/[rl]\u0323\u0304?i?/g, 'R')
    .replace(/[\u0300-\u036f]/g, '');
  return (t.match(/ai|au|[aeiouR]/g) ?? []).length;
}

// Upstream's Devanagari carries a few spelling slips (5.8 has श्रृणवन् for
// शृण्वन्), so counts may differ by a syllable or two.
const SYLLABLE_TOLERANCE = 3;

// Upstream has no roman text at all for 11.19, only a Devanagari fragment.
// Transliterated here from upstream's own Devanagari.
const MISSING_TRANSLITERATION = {
  '11.19': [
    'anādi-madhyāntam ananta-vīryam',
    'ananta-bāhuṁ śhaśhi-sūrya-netram',
    'paśhyāmi tvāṁ dīpta-hutāśha-vaktraṁ',
    'sva-tejasā viśhvam idaṁ tapantam',
  ],
};

/** Letters only, with spelling variants folded together, to compare two spellings of one line. */
const skeleton = (s) =>
  s
    .normalize('NFD')
    .toLowerCase()
    .replace(/r\u0323i/g, 'r')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/w/g, 'v')
    .replace(/[^a-z]/g, '')
    .replace(/h/g, '')
    .replace(/[mn]/g, 'n');

/** Roman lines of one upstream entry, without the Devanagari lines and "|| 33||" markers some carry. */
const romanLines = (s) =>
  (s ?? '')
    .split('\n')
    .map((line) => line.replace(/\|\|\s*\d+\s*\|\|/g, '').trim())
    .filter((line) => line && !/[\u0900-\u097F]/.test(line));

/**
 * Realign one chapter's transliteration to its Devanagari. Each verse keeps
 * lines until it has its Devanagari's syllables; any lines past that belong to
 * the next verse. If the next verse already holds those lines (in another
 * spelling), the carried lines replace them; otherwise they are prepended.
 */
function realign(entries) {
  let carried = [];
  for (const entry of entries) {
    let lines = MISSING_TRANSLITERATION[entry.id] ?? romanLines(entry.transliteration);
    if (carried.length) {
      const own = skeleton(lines.join(''));
      const extra = skeleton(carried.join(''));
      if (own === extra) lines = carried;
      else if (own.startsWith(extra) || extra.startsWith(own)) {
        throw new Error(`${entry.id}: carried lines only partly overlap its own; check by hand`);
      } else lines = [...carried, ...lines];
    }
    const target = devanagariSyllables(entry.sanskrit);
    const kept = [];
    let count = 0;
    while (lines.length && count < target - SYLLABLE_TOLERANCE) {
      const line = lines.shift();
      kept.push(line);
      count += romanSyllables(line);
    }
    carried = lines;
    entry.transliteration = tidy(kept.join('\n'));
    const diff = Math.abs(romanSyllables(entry.transliteration) - target);
    if (diff > SYLLABLE_TOLERANCE) {
      throw new Error(`${entry.id}: transliteration and Devanagari differ by ${diff} syllables`);
    }
  }
  if (carried.length) {
    throw new Error(`Chapter ${entries[0].chapter} ends with lines left over: ${carried.join(' / ')}`);
  }
}

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
    transliteration: v.transliteration,
  };
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

  realign(entries);
  for (const entry of entries) {
    for (const field of ['sanskrit', 'transliteration']) {
      if (!entry[field]) throw new Error(`${entry.id} has an empty ${field}`);
    }
  }

  const file = join(OUT_DIR, `ch-${String(num).padStart(2, '0')}.json`);
  await writeFile(file, `${JSON.stringify(entries, null, 2)}\n`, 'utf8');
  console.log(`ch-${String(num).padStart(2, '0')}.json  ${entries.length} verses`);
}

console.log(`\nImported ${raw.length} verses into ${OUT_DIR}`);
