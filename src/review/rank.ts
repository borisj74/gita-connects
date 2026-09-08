/**
 * Which unreviewed verses are worth a person's time next?
 *
 * 37 verses carry hand-written curation; the other 664 have machine guesses
 * (src/data/curation.generated.ts) and show an "unreviewed" badge. Reviewing
 * them in scripture order would leave the app's most-visited corners wrong
 * for months. This ranks them by where a fix pays off most:
 *
 *  fame      hand list of the verses people actually open (famous.ts)
 *  bridge    concept overlap with reviewed verses — a review here plugs into
 *            the existing graph instead of floating
 *  traffic   how often the verse is already surfaced by "Suggested" from a
 *            reviewed verse — a visible guess is a costly guess
 *  gap       chapters and concepts with the thinnest reviewed coverage
 *  weakness  how generic the machine guess looks: a theme shared by a hundred
 *            other verses, or a single concept
 *
 * Every signal is scaled 0–1 across the candidates, then weighted. Pure and
 * deterministic so it can be tested; scripts/review-next.ts prints it.
 */
import { verses, chapters } from '../data/index.js';
import { generatedCuration } from '../data/curation.generated.js';
import { suggestSimilar } from '../suggestions.js';
import type { Verse } from '../types.js';
import { FAMOUS_VERSES } from './famous.js';

export interface ReviewCandidate {
  id: string;
  chapter: number;
  theme: string | undefined;
  concepts: readonly string[];
  score: number;
  /** Each signal after scaling, 0–1. */
  signals: Record<Signal, number>;
  /** Short, human reasons for the top contributing signals. */
  reasons: string[];
}

export type Signal = 'fame' | 'bridge' | 'traffic' | 'gap' | 'weakness';

export const WEIGHTS: Record<Signal, number> = {
  fame: 3,
  bridge: 2,
  traffic: 1.5,
  gap: 1,
  weakness: 1,
};

export interface RankOptions {
  /** Restrict to one chapter. */
  chapter?: number;
  /** Restrict to verses tagged with this concept. */
  concept?: string;
  /** Verse ids a reader has shown interest in (saved networks, notes). Adds to traffic. */
  demand?: ReadonlyMap<string, number>;
  weights?: Partial<Record<Signal, number>>;
}

const scale = (values: Map<string, number>): Map<string, number> => {
  let max = 0;
  values.forEach((v) => {
    if (v > max) max = v;
  });
  const out = new Map<string, number>();
  values.forEach((v, k) => out.set(k, max === 0 ? 0 : v / max));
  return out;
};

/** Raw (unscaled) signals, computed once for the whole corpus. */
export function rawSignals() {
  const reviewed = verses.filter((v) => v.reviewed);
  const unreviewed = verses.filter((v) => v.curated && !v.reviewed);

  // bridge: total shared concepts with reviewed verses, capped per pair
  const bridge = new Map<string, number>();
  unreviewed.forEach((u) => {
    const mine = new Set(u.concepts);
    let total = 0;
    reviewed.forEach((r) => {
      const shared = r.concepts.filter((c) => mine.has(c)).length;
      total += Math.min(3, shared);
    });
    bridge.set(u.id, total);
  });

  // traffic: appearances in the Suggested list of reviewed verses
  const traffic = new Map<string, number>();
  reviewed.forEach((r) => {
    suggestSimilar(r.id, 5).forEach((s) => {
      if (!s.verse.reviewed) traffic.set(s.verse.id, (traffic.get(s.verse.id) ?? 0) + 1);
    });
  });

  // gap: thin chapters and thin concepts
  const reviewedByChapter = new Map<number, number>();
  const reviewedByConcept = new Map<string, number>();
  reviewed.forEach((r) => {
    reviewedByChapter.set(r.chapter, (reviewedByChapter.get(r.chapter) ?? 0) + 1);
    r.concepts.forEach((c) => reviewedByConcept.set(c, (reviewedByConcept.get(c) ?? 0) + 1));
  });
  const maxConceptReviewed = Math.max(1, ...reviewedByConcept.values());
  const chapterRatio = (n: number) => {
    const ch = chapters.find((c) => c.number === n);
    return ch ? (reviewedByChapter.get(n) ?? 0) / ch.verses : 0;
  };
  const maxChapterRatio = Math.max(...chapters.map((c) => chapterRatio(c.number)), 1e-9);
  const gap = new Map<string, number>();
  unreviewed.forEach((u) => {
    const chapterGap = 1 - chapterRatio(u.chapter) / maxChapterRatio;
    const conceptGap =
      u.concepts.length === 0
        ? 1
        : 1 - Math.min(...u.concepts.map((c) => (reviewedByConcept.get(c) ?? 0) / maxConceptReviewed));
    gap.set(u.id, chapterGap * 0.5 + conceptGap * 0.5);
  });

  // weakness: generic theme, thin concept set
  const themeCount = new Map<string, number>();
  Object.values(generatedCuration).forEach((c) => themeCount.set(c.theme, (themeCount.get(c.theme) ?? 0) + 1));
  const maxThemeCount = Math.max(1, ...themeCount.values());
  const weakness = new Map<string, number>();
  unreviewed.forEach((u) => {
    const generic = u.theme ? (themeCount.get(u.theme) ?? 0) / maxThemeCount : 1;
    const thin = u.concepts.length <= 1 ? 1 : u.concepts.length === 2 ? 0.4 : 0;
    weakness.set(u.id, generic * 0.6 + thin * 0.4);
  });

  const fame = new Map<string, number>();
  unreviewed.forEach((u) => fame.set(u.id, FAMOUS_VERSES.has(u.id) ? 1 : 0));

  return { unreviewed, bridge, traffic, gap, weakness, fame, themeCount, reviewedByChapter, chapterRatio };
}

function reasonsFor(u: Verse, s: Record<Signal, number>, raw: ReturnType<typeof rawSignals>, demand?: ReadonlyMap<string, number>): string[] {
  const out: string[] = [];
  if (s.fame > 0) out.push('well-known verse');
  const b = raw.bridge.get(u.id) ?? 0;
  if (s.bridge >= 0.5) out.push(`shares concepts with reviewed verses (${b} overlaps)`);
  const t = raw.traffic.get(u.id) ?? 0;
  if (t > 0) out.push(`suggested from ${t} reviewed verse${t === 1 ? '' : 's'}`);
  const d = demand?.get(u.id) ?? 0;
  if (d > 0) out.push(`in your networks or notes ×${d}`);
  const pct = Math.round(raw.chapterRatio(u.chapter) * 100);
  if (s.gap >= 0.6) out.push(`chapter ${u.chapter} is ${pct}% reviewed`);
  const themeN = u.theme ? raw.themeCount.get(u.theme) ?? 0 : 0;
  if (themeN >= 40) out.push(`placeholder theme shared by ${themeN} verses`);
  if (u.concepts.length <= 1) out.push('only one concept');
  if (out.length === 0) out.push(`chapter ${u.chapter} is ${pct}% reviewed`);
  return out;
}

export function rankForReview(opts: RankOptions = {}): ReviewCandidate[] {
  const raw = rawSignals();
  const weights = { ...WEIGHTS, ...opts.weights };

  let pool = raw.unreviewed;
  if (opts.chapter !== undefined) pool = pool.filter((v) => v.chapter === opts.chapter);
  if (opts.concept !== undefined) pool = pool.filter((v) => (v.concepts as readonly string[]).includes(opts.concept!));

  const trafficWithDemand = new Map(raw.traffic);
  opts.demand?.forEach((n, id) => trafficWithDemand.set(id, (trafficWithDemand.get(id) ?? 0) + n * 2));

  const pick = (m: Map<string, number>) => new Map(pool.map((v) => [v.id, m.get(v.id) ?? 0]));
  const scaled: Record<Signal, Map<string, number>> = {
    fame: scale(pick(raw.fame)),
    bridge: scale(pick(raw.bridge)),
    traffic: scale(pick(trafficWithDemand)),
    gap: scale(pick(raw.gap)),
    weakness: scale(pick(raw.weakness)),
  };

  return pool
    .map((v) => {
      const signals = Object.fromEntries(
        (Object.keys(scaled) as Signal[]).map((k) => [k, scaled[k].get(v.id) ?? 0]),
      ) as Record<Signal, number>;
      const score = (Object.keys(signals) as Signal[]).reduce((sum, k) => sum + signals[k] * weights[k], 0);
      return {
        id: v.id,
        chapter: v.chapter,
        theme: v.theme,
        concepts: v.concepts,
        score: Math.round(score * 1000) / 1000,
        signals,
        reasons: reasonsFor(v, signals, raw, opts.demand),
      };
    })
    .sort((a, b) => b.score - a.score || compareIds(a.id, b.id));
}

const compareIds = (a: string, b: string) => {
  const [ac, av] = a.split('.').map(Number);
  const [bc, bv] = b.split('.').map(Number);
  return ac - bc || av - bv;
};
