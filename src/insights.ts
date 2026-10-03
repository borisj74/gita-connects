import type { Concept } from './concepts.js';
import { CLUSTERS, type ClusterId } from './clusters.js';
import type { Verse } from './types.js';

/** One link on the canvas, reduced to what the analysis needs. */
export interface InsightEdge {
  source: string;
  target: string;
  typeId: string;
}

export interface NetworkInsights {
  verseCount: number;
  linkCount: number;
  /** Concepts held by two or more verses, most shared first. */
  sharedConcepts: { concept: Concept; count: number }[];
  /** The verse linked to the most others, when one stands out (2+ links). */
  hub: { id: string; theme?: string; links: number } | null;
  /** Theme clusters the network touches, most verses first. */
  coveredClusters: { id: ClusterId; label: string; count: number }[];
  missingClusters: { id: ClusterId; label: string }[];
  /** Links by type, most used first. */
  linkMix: { typeId: string; count: number }[];
  /** One line on what kind of network this is, from its dominant link type. */
  character: string | null;
  /** Verses on the canvas with no link yet. */
  looseEnds: string[];
}

const SHARED_CONCEPT_LIMIT = 5;
// A type sets the network's character once it carries this share of links.
const DOMINANT_SHARE = 0.4;

// What a network made mostly of one kind of link is doing, in plain words.
const CHARACTER: Record<string, string> = {
  sequential: "You're following the text as it unfolds.",
  progression: "You're tracing how a teaching develops.",
  thematic: "You're mapping a web of shared ideas.",
  contrast: "You're studying tensions: the material against the transcendent.",
  goal: 'Everything here converges on one aim.',
  dependency: "You're building an argument from its premises.",
  'question-answer': "You're following a dialogue: Arjuna's questions and Kṛṣṇa's answers.",
  definition: "You're pinning down what the key terms mean.",
  illustration: "You're pairing principles with their examples.",
  parallel: "You're hearing one teaching echoed across chapters.",
};

/**
 * What a network of verses says, computed from the verses' own concepts and
 * clusters and the links between them. Pure and synchronous, so the panel
 * can re-run it on every change.
 */
export function analyzeNetwork(
  verseIds: Iterable<string>,
  edges: InsightEdge[],
  verseById: (id: string) => Verse | undefined,
  typeLabel: (typeId: string) => string,
): NetworkInsights {
  const verses = [...verseIds].map(verseById).filter((v): v is Verse => !!v);
  const onCanvas = new Set(verses.map((v) => v.id));
  const links = edges.filter((e) => onCanvas.has(e.source) && onCanvas.has(e.target));

  const conceptCounts = new Map<Concept, number>();
  verses.forEach((v) => {
    new Set(v.concepts).forEach((c) => conceptCounts.set(c, (conceptCounts.get(c) ?? 0) + 1));
  });
  const sharedConcepts = [...conceptCounts]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, SHARED_CONCEPT_LIMIT)
    .map(([concept, count]) => ({ concept, count }));

  // Degree counts distinct neighbours: two types between the same pair are
  // one relationship on the canvas.
  const neighbours = new Map<string, Set<string>>();
  links.forEach((e) => {
    if (!neighbours.has(e.source)) neighbours.set(e.source, new Set());
    if (!neighbours.has(e.target)) neighbours.set(e.target, new Set());
    neighbours.get(e.source)!.add(e.target);
    neighbours.get(e.target)!.add(e.source);
  });
  let hub: NetworkInsights['hub'] = null;
  verses.forEach((v) => {
    const degree = neighbours.get(v.id)?.size ?? 0;
    if (degree >= 2 && (!hub || degree > hub.links)) {
      hub = { id: v.id, theme: v.theme, links: degree };
    }
  });

  const clusterCounts = new Map<ClusterId, number>();
  verses.forEach((v) => {
    if (v.cluster) clusterCounts.set(v.cluster, (clusterCounts.get(v.cluster) ?? 0) + 1);
  });
  const coveredClusters = CLUSTERS.filter((c) => clusterCounts.has(c.id))
    .map((c) => ({ id: c.id, label: c.label, count: clusterCounts.get(c.id)! }))
    .sort((a, b) => b.count - a.count);
  const missingClusters = CLUSTERS.filter((c) => !clusterCounts.has(c.id)).map((c) => ({
    id: c.id,
    label: c.label,
  }));

  const typeCounts = new Map<string, number>();
  links.forEach((e) => typeCounts.set(e.typeId, (typeCounts.get(e.typeId) ?? 0) + 1));
  const linkMix = [...typeCounts]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([typeId, count]) => ({ typeId, count }));

  let character: string | null = null;
  if (links.length > 0) {
    const top = linkMix[0];
    if (top.count / links.length >= DOMINANT_SHARE) {
      character = CHARACTER[top.typeId] ?? `Mostly ${typeLabel(top.typeId)} links.`;
    } else {
      character = `A mix of ${linkMix.length} kinds of link, no single thread yet.`;
    }
  }

  const looseEnds = verses.filter((v) => !neighbours.has(v.id)).map((v) => v.id);

  return {
    verseCount: verses.length,
    linkCount: links.length,
    sharedConcepts,
    hub,
    coveredClusters,
    missingClusters,
    linkMix,
    character,
    looseEnds,
  };
}
