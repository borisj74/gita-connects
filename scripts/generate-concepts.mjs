// Generates src/data/curation.generated.ts: machine-proposed concepts and a
// placeholder theme for every verse that has no hand-written curation.
//
// Each verse is scored against a keyword lexicon per concept, using text
// that is public domain or permissively licensed: the word-by-word glosses
// imported under src/data/verses/, and the Purohit Swami (1935) and Sivananda
// translations from the gita/gita dataset. That text is used only as a
// scoring signal and is never written to the output.
//
// Everything this produces is marked reviewed: false. It is a starting point
// for a human, not scholarship — the UI says so, and hand-written entries in
// src/data/curation.ts always take precedence.
//
// Usage: node scripts/generate-concepts.mjs
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const VERSES_DIR = join(ROOT, 'src', 'data', 'verses');
const OUT = join(ROOT, 'src', 'data', 'curation.generated.ts');
const TRANSLATIONS = 'https://raw.githubusercontent.com/gita/gita/main/data/translation.json';

// Translators whose text is usable as a signal. Purohit Swami died in 1941;
// Sivananda's is public domain in India. Neither is stored.
const SIGNAL_AUTHORS = new Set(['Shri Purohit Swami', 'Swami Sivananda']);

// Keyword lexicon. Matched as whole words, case-insensitive, diacritics
// folded, against glosses + translations. Weights let a decisive word
// (e.g. "purport" for universal-form is weak; "universal form" is strong)
// outrank incidental ones. Keep in sync with src/concepts.ts.
const LEXICON = {
  action: [['action', 2], ['act', 1], ['work', 2], ['deed', 2], ['activity', 2], ['karma', 1], ['perform', 1]],
  anger: [['anger', 3], ['wrath', 3], ['angry', 3], ['rage', 3], ['krodha', 3]],
  attachment: [['attachment', 3], ['attached', 3], ['cling', 3], ['sanga', 2], ['fond', 1]],
  austerity: [['austerity', 3], ['austerities', 3], ['penance', 3], ['tapas', 3], ['tapasya', 3], ['ascetic', 2]],
  bondage: [['bondage', 3], ['bound', 2], ['fetter', 3], ['bind', 2], ['entangle', 3], ['imprison', 2]],
  charity: [['charity', 3], ['gift', 2], ['giving', 2], ['dana', 3], ['alms', 3], ['generous', 2]],
  compassion: [['compassion', 3], ['mercy', 3], ['merciful', 3], ['kind', 2], ['kindness', 3], ['pity', 2], ['friend to all', 3], ['nonviolence', 3], ['ahimsa', 3]],
  death: [['death', 3], ['die', 2], ['dies', 2], ['dying', 2], ['dead', 2], ['mortal', 2], ['perish', 2], ['slain', 2], ['slay', 1], ['kill', 1]],
  desire: [['desire', 3], ['lust', 3], ['craving', 3], ['crave', 3], ['want', 1], ['longing', 2], ['kama', 3], ['greed', 2]],
  detachment: [['detach', 3], ['unattached', 3], ['without attachment', 3], ['free from attachment', 3], ['indifferent', 2], ['renounce the fruit', 3], ['fruit of action', 2], ['fruits of action', 2], ['fruits', 1], ['nonattachment', 3]],
  devotion: [['devotion', 3], ['devotee', 3], ['devoted', 3], ['bhakti', 3], ['love', 2], ['loving', 2], ['adore', 2], ['worship', 2]],
  dharma: [['dharma', 3], ['righteous', 3], ['righteousness', 3], ['virtue', 2], ['religion', 2], ['religious principle', 3], ['law', 1], ['right', 1], ['morality', 2]],
  discipline: [['control', 2], ['discipline', 3], ['restrain', 3], ['restraint', 3], ['subdue', 3], ['steady', 1], ['self-control', 3], ['curb', 3], ['regulate', 2], ['practice', 1]],
  duty: [['duty', 3], ['duties', 3], ['prescribed', 2], ['obligation', 3], ['ought', 2], ['svadharma', 3], ['own duty', 3]],
  ego: [['ego', 3], ['egoism', 3], ['pride', 3], ['proud', 3], ['arrogance', 3], ['arrogant', 3], ['vanity', 3], ['conceit', 3], ['false ego', 3], ['ahankara', 3], ['doer', 2]],
  equanimity: [['equanimity', 3], ['equal', 2], ['equally', 2], ['same', 1], ['alike', 2], ['balanced', 3], ['even-minded', 3], ['evenness', 3], ['tranquil', 2], ['peace', 2], ['peaceful', 2], ['calm', 2], ['undisturbed', 3], ['unmoved', 2]],
  faith: [['faith', 3], ['faithful', 3], ['belief', 2], ['believe', 2], ['shraddha', 3], ['trust', 1], ['doubt', 2], ['doubting', 2]],
  grace: [['grace', 3], ['mercy', 2], ['protect', 2], ['protection', 2], ['deliver', 2], ['rescue', 2], ['save', 1], ['carry what they lack', 3]],
  grief: [['grief', 3], ['grieve', 3], ['lament', 3], ['sorrow', 3], ['sorrowful', 3], ['despair', 3], ['despondent', 3], ['tears', 2], ['weep', 2], ['distress', 2], ['anxiety', 2], ['anxious', 2], ['fear', 1]],
  guru: [['guru', 3], ['teacher', 3], ['spiritual master', 3], ['preceptor', 3], ['disciple', 2], ['disciplic', 3], ['instruct', 1], ['succession', 2]],
  illusion: [['illusion', 3], ['maya', 3], ['delusion', 3], ['deluded', 3], ['bewilder', 3], ['bewildered', 3], ['ignorance', 2], ['ignorant', 2], ['confusion', 2], ['confused', 2], ['dream', 1]],
  impermanence: [['impermanent', 3], ['temporary', 3], ['transient', 3], ['fleeting', 3], ['perishable', 3], ['passing', 1], ['nonpermanent', 3], ['come and go', 3], ['appear and disappear', 3]],
  'karma-yoga': [['karma-yoga', 3], ['karma yoga', 3], ['yoga of action', 3], ['work without', 2], ['selfless', 3], ['without desire for', 2], ['sacrifice of work', 2], ['fruit', 1]],
  knowledge: [['knowledge', 3], ['know', 1], ['knows', 1], ['knowing', 1], ['jnana', 3], ['understand', 2], ['understanding', 2], ['learn', 1], ['wise', 1]],
  liberation: [['liberation', 3], ['liberated', 3], ['freedom', 2], ['free from', 1], ['moksha', 3], ['release', 2], ['released', 2], ['salvation', 3], ['supreme abode', 3], ['nirvana', 3], ['emancipation', 3]],
  meditation: [['meditation', 3], ['meditate', 3], ['meditating', 3], ['dhyana', 3], ['concentrate', 2], ['concentration', 2], ['contemplate', 2], ['fix the mind', 3], ['fixed mind', 2], ['yoga', 1], ['yogi', 2]],
  'modes-of-nature': [['mode', 3], ['modes', 3], ['guna', 3], ['gunas', 3], ['goodness', 2], ['passion', 3], ['ignorance', 1], ['sattva', 3], ['rajas', 3], ['tamas', 3], ['material nature', 2], ['prakriti', 2], ['nature', 1]],
  opulence: [['opulence', 3], ['opulences', 3], ['vibhuti', 3], ['glory', 2], ['glories', 2], ['splendor', 3], ['splendour', 3], ['power', 1], ['manifestation', 2], ['among', 1]],
  purity: [['pure', 2], ['purity', 3], ['purified', 3], ['purify', 3], ['clean', 2], ['cleanliness', 3], ['sinless', 3], ['spotless', 3], ['divine qualities', 3], ['divine nature', 3]],
  remembrance: [['remember', 3], ['remembers', 3], ['remembering', 3], ['remembrance', 3], ['forget', 2], ['forgets', 2], ['thinking of me', 3], ['think of me', 3], ['at the time of death', 2]],
  renunciation: [['renunciation', 3], ['renounce', 3], ['renounced', 3], ['sannyasa', 3], ['sannyasi', 3], ['give up', 2], ['gives up', 2], ['abandon', 2], ['abandoning', 2], ['relinquish', 3], ['tyaga', 3]],
  sacrifice: [['sacrifice', 3], ['sacrifices', 3], ['yajna', 3], ['offering', 3], ['offer', 2], ['oblation', 3], ['service', 2], ['serve', 2]],
  'self-realization': [['self-realization', 3], ['self-realized', 3], ['realize', 2], ['realized', 2], ['realization', 3], ['perfection', 2], ['perfect', 1], ['transcendental knowledge', 2], ['knows the self', 3], ['self-knowledge', 3]],
  soul: [['soul', 3], ['atma', 2], ['atman', 3], ['self', 2], ['eternal', 2], ['immortal', 3], ['imperishable', 3], ['indestructible', 3], ['embodied', 2], ['spirit', 2], ['never born', 3], ['never dies', 3], ['unborn', 3]],
  'supreme-person': [['supreme', 2], ['supreme person', 3], ['supreme personality', 3], ['purushottama', 3], ['lord', 1], ['godhead', 3], ['almighty', 3], ['origin of all', 3], ['source of all', 3], ['i am', 1], ['brahman', 2], ['paramatma', 3], ['supersoul', 3]],
  surrender: [['surrender', 3], ['surrendered', 3], ['take refuge', 3], ['refuge', 3], ['shelter', 3], ['submit', 2], ['prapatti', 3], ['abandon all', 2], ['come to me', 2], ['unto me', 1]],
  transcendence: [['transcend', 3], ['transcends', 3], ['transcendental', 2], ['beyond', 2], ['above', 1], ['rise above', 3], ['surpass', 3], ['free from the modes', 3], ['nirguna', 3]],
  unity: [['unity', 3], ['one', 1], ['oneness', 3], ['all beings', 2], ['in all', 2], ['everywhere', 2], ['pervade', 3], ['pervades', 3], ['pervading', 3], ['all-pervading', 3], ['whole', 1], ['union', 3], ['united', 2], ['in me', 1]],
  'universal-form': [['universal form', 3], ['cosmic form', 3], ['vishvarupa', 3], ['visvarupa', 3], ['many mouths', 3], ['many arms', 3], ['thousand', 2], ['blazing', 2], ['effulgence', 2], ['effulgent', 2], ['form', 1], ['see', 1], ['behold', 2], ['vision', 2], ['divine eyes', 3], ['terrible', 2]],
  war: [['war', 3], ['battle', 3], ['fight', 3], ['fighting', 3], ['warrior', 3], ['army', 3], ['armies', 3], ['bow', 2], ['arrow', 2], ['conch', 3], ['chariot', 3], ['kshatriya', 3], ['enemy', 2], ['enemies', 2], ['victory', 2], ['kill', 1], ['slay', 1]],
  wisdom: [['wisdom', 3], ['wise', 3], ['discern', 3], ['discrimination', 3], ['intelligence', 2], ['intelligent', 2], ['buddhi', 3], ['sage', 2], ['sages', 2], ['learned', 2], ['steady wisdom', 3], ['sthita-prajna', 3]],
};

const MIN_SCORE = 5; // a single weight-3 hit plus a supporting word, or two mid hits
const MAX_CONCEPTS = 4;

/** Fold diacritics and lowercase, so "Kṛṣṇa" and "krsna" both match. */
const fold = (s) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[ṛṝḷḹṅñṭḍṇśṣḥṁ]/g, (c) => ({ ṛ: 'r', ṝ: 'r', ḷ: 'l', ḹ: 'l', ṅ: 'n', ñ: 'n', ṭ: 't', ḍ: 'd', ṇ: 'n', ś: 's', ṣ: 's', ḥ: 'h', ṁ: 'm' })[c] ?? c);

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const compiled = Object.fromEntries(
  Object.entries(LEXICON).map(([concept, words]) => [
    concept,
    words.map(([w, weight]) => [new RegExp(`\\b${escapeRe(fold(w))}\\b`, 'g'), weight]),
  ]),
);

function score(text) {
  const t = fold(text);
  const out = [];
  for (const [concept, patterns] of Object.entries(compiled)) {
    let s = 0;
    for (const [re, weight] of patterns) {
      const hits = (t.match(re) ?? []).length;
      if (hits) s += weight * Math.min(hits, 3);
    }
    if (s >= MIN_SCORE) out.push([concept, s]);
  }
  return out.sort((a, b) => b[1] - a[1]).slice(0, MAX_CONCEPTS);
}

const label = (c) => c.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');

// ---- load inputs ----
const verseFiles = (await readdir(VERSES_DIR)).filter((f) => f.endsWith('.json')).sort();
const verses = (await Promise.all(verseFiles.map(async (f) => JSON.parse(await readFile(join(VERSES_DIR, f), 'utf8'))))).flat();

const handCurated = new Set(
  [...(await readFile(join(ROOT, 'src', 'data', 'curation.ts'), 'utf8')).matchAll(/^  '(\d+\.\d+)': \{/gm)].map((m) => m[1]),
);

const translationsRes = await fetch(TRANSLATIONS);
if (!translationsRes.ok) throw new Error(`translation.json: HTTP ${translationsRes.status}`);
const translations = await translationsRes.json();
// verse_id in the dataset is the 1-based global verse order, matching our sort.
const signalByIndex = new Map();
for (const t of translations) {
  if (!SIGNAL_AUTHORS.has(t.authorName)) continue;
  signalByIndex.set(t.verse_id, `${signalByIndex.get(t.verse_id) ?? ''} ${t.description}`);
}

// ---- generate ----
const entries = [];
const stats = { tagged: 0, untagged: 0, perConcept: {} };
verses.forEach((v, i) => {
  if (handCurated.has(v.id)) return;
  const text = `${v.wordMeanings} ${signalByIndex.get(i + 1) ?? ''}`;
  const picked = score(text);
  if (picked.length === 0) {
    stats.untagged++;
    return;
  }
  stats.tagged++;
  const concepts = picked.map(([c]) => c);
  for (const c of concepts) stats.perConcept[c] = (stats.perConcept[c] ?? 0) + 1;
  const theme = concepts.slice(0, 2).map(label).join(' & ');
  entries.push(`  '${v.id}': {\n    theme: '${theme}',\n    concepts: [${concepts.map((c) => `'${c}'`).join(', ')}],\n    reviewed: false,\n  },`);
});

await writeFile(OUT, `import type { VerseCuration } from '../types.js';

// GENERATED by scripts/generate-concepts.mjs — do not edit by hand.
//
// Machine-proposed concepts and placeholder themes for verses that have no
// entry in curation.ts. Every entry is reviewed: false. To accept one, move
// it into curation.ts (which always wins), give it a real theme, and drop
// the flag; to correct it, do the same with the corrected concepts. Rerunning
// the script regenerates only what curation.ts does not cover.
export const generatedCuration: Record<string, VerseCuration> = {
${entries.join('\n')}
};
`, 'utf8');

console.log(`hand-curated (skipped): ${handCurated.size}`);
console.log(`generated: ${stats.tagged}   left untagged: ${stats.untagged}`);
console.log('\nper concept:');
for (const [c, n] of Object.entries(stats.perConcept).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(4)}  ${c}`);
}
const unused = Object.keys(LEXICON).filter((c) => !stats.perConcept[c]);
if (unused.length) console.log('\nconcepts never assigned:', unused.join(', '));
