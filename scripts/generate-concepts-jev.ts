/**
 * Generates src/data/curation.generated.ts with TypeSafe's Jev model
 * (System One) instead of the keyword lexicon in scripts/generate-concepts.mjs.
 *
 * For each verse, one request asks 41 yes/no questions — "is <concept> one of
 * this verse's central ideas?", one per term in src/concepts.ts — plus one
 * choice over the eleven clusters in src/clusters.ts. A concept is kept when
 * its probability clears the threshold; the cluster choice decides how thin
 * verses are padded, so they land in the cluster Jev thinks they belong to.
 *
 * Licensing: only public-domain text is sent — the gita/gita word glosses
 * under src/data/verses/ and the Purohit Swami (1935) and Sivananda
 * translations — plus the project's own chapter themes. Prabhupada's
 * translation, purports and chapter titles (BBT copyright) are never sent.
 *
 * Everything written is reviewed: false, exactly like the keyword script, and
 * hand-written entries in src/data/curation.ts always take precedence.
 *
 * Needs TYPESAFE_API_KEY in the environment, or in a Claude Code cloud session
 * a Bearer credential for api.typesafe.ai (never commit the key). Responses are
 * cached under node_modules/.cache/gita-jev, so rerunning with a different
 * threshold costs nothing.
 *
 *   npm run concepts:jev -- --validate          score against the hand-curated verses, pick a threshold
 *   npm run concepts:jev -- --explain 4.34 3.3  per-concept probabilities, no write
 *   npm run concepts:jev -- --limit 20          tag the first 20 unreviewed verses, print, no write
 *   npm run concepts:jev                        tag every unreviewed verse and write the file
 *
 *   options: --threshold 0.6  --fill 0.3  --concurrency 4  --model jev-latest  --no-cache
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  APIConnectionError,
  AuthenticationError,
  choice,
  noul,
  TypeSafeClient,
  TypeSafeError,
  type JsonValue,
  type Question,
} from '@typesafe-ai/sdk';
import { CONCEPTS, type Concept } from '../src/concepts.js';
import { CLUSTERS, CONCEPT_CLUSTER, clusterLabel, clusterOf, type ClusterId } from '../src/clusters.js';
import { chapters } from '../src/data/chapters.js';
import { verseCuration } from '../src/data/curation.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const VERSES_DIR = join(ROOT, 'src', 'data', 'verses');
const OUT = join(ROOT, 'src', 'data', 'curation.generated.ts');
const CACHE_DIR = join(ROOT, 'node_modules', '.cache', 'gita-jev');
const TRANSLATIONS = 'https://raw.githubusercontent.com/gita/gita/main/data/translation.json';

// Public-domain translators whose text is sent as context. Never add
// A.C. Bhaktivedanta Swami Prabhupada here.
const SIGNAL_AUTHORS = ['Shri Purohit Swami', 'Swami Sivananda'] as const;

// Chosen from --validate against the hand-curated verses (jev-1.13.0). F1 is
// flat from 0.10 to 0.65 (0.59–0.61), so this favours precision: 63% vs 59%
// at the best-F1 cut of 0.25, since a wrong concept makes wrong connections
// while a missing one is easy to add in review.
const DEFAULT_THRESHOLD = 0.6;
// A verse with fewer than FILL_TO concepts above the threshold is topped up
// with concepts Jev nearly chose (at least DEFAULT_FILL) before any blind
// padding, so a verse whose third idea scored 0.5 keeps it. --fill 1 turns this off.
// On the hand-curated verses at 0.6, a fill of 0.3 lifts recall from 57% to
// 62% with precision unchanged at 63% (F1 0.60 -> 0.63), the best of any setting.
const DEFAULT_FILL = 0.3;
const FILL_TO = 3;
const MIN_CONCEPTS = 2; // every verse needs at least two, so suggestions have something to match
const MAX_CONCEPTS = 4; // hand-curated verses carry three or four

// ---- arguments ----
const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const has = (name: string) => args.includes(`--${name}`);

const threshold = Number(flag('threshold') ?? DEFAULT_THRESHOLD);
const fill = Number(flag('fill') ?? DEFAULT_FILL);
const concurrency = Number(flag('concurrency') ?? 4);
const limit = flag('limit') ? Number(flag('limit')) : undefined;
const useCache = !has('no-cache');

// ---- the questions ----

/** What each concept means in this project, so Jev and a reviewer read it the same way. */
const GLOSS: Record<Concept, string> = {
  action: 'Action or work in general: acting, performing deeds, the nature of action and inaction.',
  anger: 'Anger or wrath (krodha) as a force in the mind.',
  attachment: 'Attachment or clinging (sanga) to sense objects, people or outcomes.',
  austerity: 'Austerity or penance (tapas) of body, speech or mind.',
  bondage: 'Bondage: how action, desire or the modes of nature bind the embodied self to rebirth.',
  charity: 'Charity or gift-giving (dana), including its kinds.',
  compassion: 'Compassion, kindness, non-violence and friendliness toward all beings.',
  death: 'Death: dying, killing, the moment of death and what follows it.',
  desire: 'Desire, lust, craving (kama) or greed.',
  detachment: 'Non-attachment: acting without clinging to results, indifference to the fruits of action.',
  devotion: 'Devotion (bhakti): loving worship of the Lord, and the devotee.',
  dharma: 'Dharma: righteousness, moral and cosmic order, religious law and its decline.',
  discipline: 'Self-discipline: control of the senses and mind, restraint, steady practice.',
  duty: "One's own prescribed duty (svadharma): the obligation to act according to one's role.",
  ego: 'Ego (ahankara): false identification as the doer, pride, arrogance, vanity.',
  equanimity: 'Equanimity: evenness of mind in pleasure and pain, success and failure; calm, peace, seeing all alike.',
  faith: 'Faith (shraddha), belief, and doubt as its opposite.',
  grace: 'Divine grace: the Lord protecting, delivering or caring for those who rely on Him.',
  grief: "Grief, sorrow, lament, despondency, fear or distress — Arjuna's above all.",
  guru: 'The teacher: disciple and instruction, the line of succession, approaching the wise with inquiry.',
  illusion: 'Illusion or delusion (maya, moha): ignorance and bewilderment about what is real.',
  impermanence: 'Impermanence: the temporary, transient nature of the body, the world and sensations.',
  'karma-yoga': 'Karma-yoga: the discipline of selfless action, done as yoga without desire for its fruits.',
  knowledge: 'Knowledge (jnana): knowing reality, spiritual understanding, the field and its knower.',
  liberation: 'Liberation (moksha): freedom from rebirth, attaining the supreme abode, Brahman or nirvana.',
  meditation: "Meditation (dhyana): yogic concentration, the yogi's practice, fixing the mind.",
  'modes-of-nature': 'The three modes (gunas) of material nature — goodness, passion, ignorance — and how they condition beings.',
  opulence: "Divine opulence (vibhuti): the Lord's glories and manifestations as the best of each kind.",
  purity: 'Purity of body, mind, food and conduct; divine as opposed to demonic qualities.',
  remembrance: 'Remembering the Lord, especially at the time of death; constant thought of Him.',
  renunciation: 'Renunciation (sannyasa, tyaga): giving up, abandoning, relinquishing.',
  sacrifice: 'Sacrifice (yajna): offerings, oblations, action performed as an offering.',
  'self-realization': 'Self-realization: perfection, realizing the Self, the state of the perfected sage.',
  soul: 'The eternal soul or self (atman): unborn, indestructible, embodied yet distinct from the body.',
  'supreme-person': 'Krishna as the Supreme Person: source and controller of all, Brahman, the Supersoul.',
  surrender: 'Surrender: taking refuge in the Lord.',
  transcendence: 'Transcendence: rising beyond the modes of nature and the dualities.',
  unity: 'Unity: the Lord pervading all beings, seeing all in the Self and the Self in all.',
  'universal-form': "Krishna's universal or cosmic form (vishvarupa), as revealed to Arjuna.",
  war: 'War: the battle at Kurukshetra, the armies, warriors, weapons and fighting.',
  wisdom: 'Wisdom: discernment (buddhi), steady intelligence, the sage of steady wisdom.',
};

/** Question keys are plain identifiers; map them back to concepts. */
const keyOf = (c: Concept) => `concept_${c.replace(/-/g, '_')}`;

const QUESTIONS: Record<string, Question> = {
  ...Object.fromEntries(
    CONCEPTS.map((c) => [
      keyOf(c),
      noul(
        `Is "${c}" one of this Bhagavad Gita verse's central ideas? ${GLOSS[c]}`,
        {
          true: 'The verse itself teaches, describes or enacts this idea.',
          false: 'The idea is absent, or only touched on in passing by a word or name.',
        },
      ),
    ]),
  ),
  cluster: choice(
    'Which one of these themes does this Bhagavad Gita verse belong to most?',
    Object.fromEntries(
      CLUSTERS.map((cl) => [
        cl.id,
        `${cl.label}: ${CONCEPTS.filter((c) => CONCEPT_CLUSTER[c] === cl.id).join(', ')}`,
      ]),
    ),
  ),
};

// ---- inputs ----
interface VerseText {
  id: string;
  chapter: number;
  verse: number;
  wordMeanings: string;
}

const tidy = (s: string) => s.replace(/\s+/g, ' ').trim();

const verseFiles = (await readdir(VERSES_DIR)).filter((f) => f.endsWith('.json')).sort();
const verses: VerseText[] = (
  await Promise.all(verseFiles.map(async (f) => JSON.parse(await readFile(join(VERSES_DIR, f), 'utf8')) as VerseText[]))
).flat();

const handCurated = new Set(Object.keys(verseCuration));

const translationsRes = await fetch(TRANSLATIONS);
if (!translationsRes.ok) throw new Error(`translation.json: HTTP ${translationsRes.status}`);
const translations = (await translationsRes.json()) as { verse_id: number; authorName: string; description: string }[];
// verse_id in the dataset is the 1-based global verse order, matching our sort.
const translationsByIndex = new Map<number, Record<string, string>>();
for (const t of translations) {
  if (!(SIGNAL_AUTHORS as readonly string[]).includes(t.authorName)) continue;
  const byAuthor = translationsByIndex.get(t.verse_id) ?? {};
  byAuthor[t.authorName] = tidy(t.description);
  translationsByIndex.set(t.verse_id, byAuthor);
}

/** Everything Jev sees about a verse. Public-domain text and our own chapter themes only. */
function stateOf(v: VerseText): { [key: string]: JsonValue } {
  const ch = chapters.find((c) => c.number === v.chapter);
  return {
    reference: `Bhagavad Gita ${v.id}`,
    chapter: { number: v.chapter, name: ch?.titleSanskrit ?? null, subject: ch?.theme ?? null },
    wordByWordGlosses: v.wordMeanings,
    translations: translationsByIndex.get(verses.indexOf(v) + 1) ?? {},
  };
}

// ---- calling Jev ----
interface Tagging {
  probs: Record<Concept, number>;
  cluster: ClusterId;
  clusterConfidence: number;
  model: string;
  tokens: number;
}

// In a Claude Code cloud session the key is stored as an environment
// credential, which the egress proxy injects as the Authorization header on
// requests to api.typesafe.ai, so it never appears in the process. The SDK
// still insists on a key, so give it a placeholder the proxy overwrites.
const apiKey = process.env.TYPESAFE_API_KEY?.trim() || (process.env.CLAUDE_CODE_REMOTE === 'true' ? 'injected-by-proxy' : undefined);

let client: TypeSafeClient;
try {
  client = new TypeSafeClient({ apiKey, defaultModel: flag('model'), timeout: 60_000 });
} catch (err) {
  if (err instanceof TypeSafeError) {
    console.error(`${err.message}\nSet TYPESAFE_API_KEY, or in a cloud session add a Bearer credential for api.typesafe.ai.`);
    process.exit(1);
  }
  throw err;
}
await mkdir(CACHE_DIR, { recursive: true });

const usage = { requests: 0, cached: 0, tokens: 0 };

async function tag(v: VerseText): Promise<Tagging> {
  const request = { state: stateOf(v), questions: QUESTIONS, model: client.defaultModel };
  const file = join(CACHE_DIR, `${createHash('sha256').update(JSON.stringify(request)).digest('hex').slice(0, 24)}.json`);
  if (useCache) {
    try {
      const hit = JSON.parse(await readFile(file, 'utf8')) as Tagging;
      usage.cached++;
      return hit;
    } catch {
      // not cached yet
    }
  }

  const res = await client.systemOne(request);
  const probs = {} as Record<Concept, number>;
  for (const c of CONCEPTS) {
    const a = res.answers[keyOf(c)];
    if (a?.type !== 'noul') throw new Error(`${v.id}: no answer for ${c}`);
    probs[c] = a.noul;
  }
  const cl = res.answers.cluster;
  if (cl?.type !== 'choice') throw new Error(`${v.id}: no cluster answer`);
  const tagging: Tagging = {
    probs,
    cluster: cl.choice as ClusterId,
    clusterConfidence: cl.confidence,
    model: res.model,
    tokens: res.usage.input_tokens + res.usage.output_tokens,
  };
  usage.requests++;
  usage.tokens += tagging.tokens;
  await writeFile(file, JSON.stringify(tagging), 'utf8');
  return tagging;
}

async function tagAll(list: VerseText[]): Promise<Tagging[]> {
  const out = new Array<Tagging>(list.length);
  let next = 0;
  let done = 0;
  const worker = async () => {
    while (next < list.length) {
      const i = next++;
      out[i] = await tag(list[i]);
      if (++done % 25 === 0 || done === list.length) process.stderr.write(`  tagged ${done}/${list.length}\r`);
    }
  };
  try {
    await Promise.all(Array.from({ length: Math.min(concurrency, list.length) }, worker));
  } catch (err) {
    if (err instanceof AuthenticationError) {
      console.error('\nTypeSafe rejected the API key (401). Check TYPESAFE_API_KEY, or in the cloud the environment credential for api.typesafe.ai.');
    }
    else if (err instanceof APIConnectionError) {
      console.error(`\nCould not reach ${client.baseURL}: ${err.message}\nIn a Claude Code cloud session, the environment's network access must allow api.typesafe.ai.`);
    } else throw err;
    process.exit(1);
  }
  process.stderr.write('\n');
  return out;
}

// ---- picking concepts ----

/**
 * Concepts above the threshold, strongest first, capped at MAX_CONCEPTS. A
 * verse with fewer than FILL_TO is topped up with concepts above the lower
 * fill bar. One still under MIN_CONCEPTS is padded with its likeliest
 * remaining concepts, taken first from the cluster Jev chose, so a thin verse
 * still lands in the right cluster. Returns how many came from padding.
 */
function pick(t: Tagging, cut: number, fillCut = fill): { concepts: Concept[]; padded: number } {
  const ranked = [...CONCEPTS].sort((a, b) => t.probs[b] - t.probs[a]);
  const concepts = ranked.filter((c) => t.probs[c] >= cut).slice(0, MAX_CONCEPTS);
  for (const c of ranked) {
    if (concepts.length >= FILL_TO || t.probs[c] < fillCut) break;
    if (!concepts.includes(c)) concepts.push(c);
  }
  let padded = 0;
  const padOrder = [...ranked.filter((c) => CONCEPT_CLUSTER[c] === t.cluster), ...ranked];
  for (const c of padOrder) {
    if (concepts.length >= MIN_CONCEPTS) break;
    if (concepts.includes(c)) continue;
    concepts.push(c);
    padded++;
  }
  return { concepts, padded };
}

const pct = (n: number) => `${(n * 100).toFixed(0)}%`.padStart(4);

function printUsage(model: string | undefined) {
  console.log(`\nmodel: ${model ?? client.defaultModel}  requests: ${usage.requests}  cached: ${usage.cached}  tokens: ${usage.tokens}`);
}

// ---- explain: show the probabilities for specific verses ----
if (has('explain')) {
  const ids = args.filter((a) => /^\d+\.\d+$/.test(a));
  const list = ids.map((id) => verses.find((v) => v.id === id)).filter((v): v is VerseText => !!v);
  const results = await tagAll(list);
  list.forEach((v, i) => {
    const t = results[i];
    const hand = verseCuration[v.id]?.concepts;
    const { concepts, padded } = pick(t, threshold);
    console.log(`\n=== ${v.id} ===  cluster: ${t.cluster} (${pct(t.clusterConfidence)})`);
    console.log(`picked: ${concepts.join(', ')}  (padded ${padded})`);
    if (hand) console.log(`hand:   ${hand.join(', ')}`);
    for (const c of [...CONCEPTS].sort((a, b) => t.probs[b] - t.probs[a]).slice(0, 8)) {
      console.log(`  ${pct(t.probs[c])}  ${c}${hand?.includes(c) ? '  ✓ hand' : ''}`);
    }
  });
  printUsage(results[0]?.model);
  process.exit(0);
}

// ---- validate: compare against the hand-curated verses ----
if (has('validate')) {
  const list = verses.filter((v) => handCurated.has(v.id));
  const results = await tagAll(list);
  const hand = list.map((v) => verseCuration[v.id].concepts);

  console.log(`\n${list.length} hand-curated verses. Concepts, micro-averaged, with the ${MIN_CONCEPTS}–${MAX_CONCEPTS} per-verse rule applied:\n`);
  const score = (cut: number, fillCut: number) => {
    let tp = 0;
    let fp = 0;
    let fn = 0;
    let n = 0;
    results.forEach((t, i) => {
      const got = pick(t, cut, fillCut).concepts;
      n += got.length;
      tp += got.filter((c) => hand[i].includes(c)).length;
      fp += got.filter((c) => !hand[i].includes(c)).length;
      fn += hand[i].filter((c) => !got.includes(c)).length;
    });
    const p = tp / (tp + fp || 1);
    const r = tp / (tp + fn || 1);
    const f1 = (2 * p * r) / (p + r || 1);
    return { p, r, f1, avg: n / list.length };
  };
  const row = (x: number, s: ReturnType<typeof score>) =>
    `  ${x.toFixed(2)}     ${pct(s.p)}     ${pct(s.r)}   ${s.f1.toFixed(2)}    ${s.avg.toFixed(1)}`;

  console.log(`  cut   precision  recall   F1   avg/verse     (fill ${fill >= 1 ? 'off' : fill})`);
  let best = { cut: DEFAULT_THRESHOLD, f1: -1 };
  for (let cut = 0.1; cut <= 0.901; cut += 0.05) {
    const s = score(cut, fill);
    if (s.f1 > best.f1) best = { cut: Math.round(cut * 100) / 100, f1: s.f1 };
    console.log(row(cut, s));
  }

  console.log(`\nTopping thin verses up to ${FILL_TO} at --threshold ${threshold}:\n`);
  console.log('  fill  precision  recall   F1   avg/verse');
  console.log(row(1, score(threshold, 1)).replace('1.00', ' off'));
  for (let f = 0.3; f < threshold - 0.001; f += 0.05) console.log(row(f, score(threshold, f)));

  const clusterHits = results.filter((t, i) => t.cluster === clusterOf(hand[i])).length;
  const derivedHits = results.filter((t, i) => clusterOf(pick(t, threshold).concepts) === clusterOf(hand[i])).length;
  console.log(`\nbest single-threshold F1 ${best.f1.toFixed(2)} at --threshold ${best.cut}; in use: --threshold ${threshold} --fill ${fill}`);
  console.log(`cluster: Jev's choice matches the hand concepts' cluster in ${clusterHits}/${list.length};`);
  console.log(`         cluster derived from picked concepts matches in ${derivedHits}/${list.length}`);

  console.log(`\nper verse at --threshold ${threshold} --fill ${fill} (+ extra, − missed):`);
  const missed = new Map<Concept, number>();
  const extra = new Map<Concept, number>();
  results.forEach((t, i) => {
    const got = pick(t, threshold).concepts;
    const plus = got.filter((c) => !hand[i].includes(c));
    const minus = hand[i].filter((c) => !got.includes(c));
    plus.forEach((c) => extra.set(c, (extra.get(c) ?? 0) + 1));
    minus.forEach((c) => missed.set(c, (missed.get(c) ?? 0) + 1));
    if (plus.length || minus.length) {
      console.log(`  ${list[i].id.padEnd(6)} ${[...plus.map((c) => `+${c}`), ...minus.map((c) => `−${c}`)].join(' ')}`);
    }
  });
  const top = (m: Map<Concept, number>) => [...m].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([c, n]) => `${c}×${n}`).join(', ');
  console.log(`\nmost often missed: ${top(missed) || '—'}`);
  console.log(`most often extra:  ${top(extra) || '—'}`);
  console.log('\nTo change what a plain run uses, set DEFAULT_THRESHOLD and DEFAULT_FILL in this script.');
  printUsage(results[0]?.model);
  process.exit(0);
}

// ---- generate ----
const todo = verses.filter((v) => !handCurated.has(v.id)).slice(0, limit);
const results = await tagAll(todo);
const model = results[0]?.model ?? client.defaultModel;

const entries: string[] = [];
const stats = { confident: 0, paddedSome: 0, paddedAll: 0, clusterAgrees: 0 };
const perConcept = new Map<Concept, number>();
const perCluster = new Map<ClusterId, number>();
todo.forEach((v, i) => {
  const t = results[i];
  const { concepts, padded } = pick(t, threshold);
  if (padded === 0) stats.confident++;
  else if (padded < concepts.length) stats.paddedSome++;
  else stats.paddedAll++;
  concepts.forEach((c) => perConcept.set(c, (perConcept.get(c) ?? 0) + 1));
  // The app derives the cluster from the concepts (src/data/index.ts), so the
  // theme does too — otherwise the label and the suggestions would disagree.
  const cluster = clusterOf(concepts)!;
  if (cluster === t.cluster) stats.clusterAgrees++;
  perCluster.set(cluster, (perCluster.get(cluster) ?? 0) + 1);
  const theme = clusterLabel(cluster).replace(/'/g, "\\'");
  entries.push(`  '${v.id}': {\n    theme: '${theme}',\n    concepts: [${concepts.map((c) => `'${c}'`).join(', ')}],\n    reviewed: false,\n  },`);
  if (limit !== undefined) console.log(`${v.id.padEnd(6)} ${clusterLabel(cluster).padEnd(26)} ${concepts.join(', ')}${padded ? `  (padded ${padded})` : ''}`);
});

if (limit === undefined) {
  await writeFile(OUT, `import type { VerseCuration } from '../types.js';

// GENERATED by scripts/generate-concepts-jev.ts (TypeSafe ${model}, threshold ${threshold}) — do not edit by hand.
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
  console.log(`wrote ${OUT}`);
} else {
  console.log(`\n--limit given: ${OUT} not written.`);
}

console.log(`\nhand-curated (skipped): ${handCurated.size}`);
console.log(`generated: ${todo.length}  (confident ${stats.confident}, partly padded ${stats.paddedSome}, fully padded ${stats.paddedAll})`);
console.log(`Jev's cluster choice agrees with the concepts' cluster: ${stats.clusterAgrees}/${todo.length}`);
console.log('\nper cluster:');
for (const [c, n] of [...perCluster].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${c}`);
console.log('\nper concept:');
for (const [c, n] of [...perConcept].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${c}`);
const unused = CONCEPTS.filter((c) => !perConcept.has(c));
if (unused.length) console.log('\nconcepts never assigned:', unused.join(', '));
printUsage(model);
