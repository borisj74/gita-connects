import type { Concept } from './concepts.js';

/**
 * Logical theme clusters — the eleven groupings the project's design uses to
 * organise the whole Gita. Concepts are fine-grained; clusters are the coarse
 * layer above them. Every concept belongs to exactly one cluster.
 *
 * Clusters do two jobs. They give generated verses a readable theme ("Cosmic
 * vision" rather than a pair of concept names), and they guarantee that
 * suggestions never come up empty: two verses in the same cluster always
 * have something in common even when their concepts do not overlap.
 */
export const CLUSTERS = [
  { id: 'arjuna-dilemma', label: "Arjuna's dilemma" },
  { id: 'soul-and-self', label: 'Soul and self' },
  { id: 'duty-and-action', label: 'Duty and action' },
  { id: 'knowledge-and-realization', label: 'Knowledge and realization' },
  { id: 'meditation-and-mind', label: 'Meditation and mind' },
  { id: 'krishna-supremacy', label: "Kṛṣṇa's supremacy" },
  { id: 'devotion-and-surrender', label: 'Devotion and surrender' },
  { id: 'cosmic-vision', label: 'Cosmic vision' },
  { id: 'modes-of-nature', label: 'Modes of nature' },
  { id: 'faith-and-character', label: 'Faith and character' },
  { id: 'final-liberation', label: 'Final liberation' },
] as const;

export type ClusterId = (typeof CLUSTERS)[number]['id'];

export const CONCEPT_CLUSTER: Record<Concept, ClusterId> = {
  grief: 'arjuna-dilemma',
  war: 'arjuna-dilemma',

  soul: 'soul-and-self',
  death: 'soul-and-self',
  impermanence: 'soul-and-self',

  duty: 'duty-and-action',
  action: 'duty-and-action',
  'karma-yoga': 'duty-and-action',
  dharma: 'duty-and-action',
  sacrifice: 'duty-and-action',
  detachment: 'duty-and-action',
  renunciation: 'duty-and-action',

  knowledge: 'knowledge-and-realization',
  wisdom: 'knowledge-and-realization',
  'self-realization': 'knowledge-and-realization',
  illusion: 'knowledge-and-realization',
  guru: 'knowledge-and-realization',

  meditation: 'meditation-and-mind',
  discipline: 'meditation-and-mind',
  equanimity: 'meditation-and-mind',
  desire: 'meditation-and-mind',
  anger: 'meditation-and-mind',
  attachment: 'meditation-and-mind',
  ego: 'meditation-and-mind',

  'supreme-person': 'krishna-supremacy',
  opulence: 'krishna-supremacy',
  unity: 'krishna-supremacy',

  devotion: 'devotion-and-surrender',
  surrender: 'devotion-and-surrender',
  grace: 'devotion-and-surrender',
  remembrance: 'devotion-and-surrender',

  'universal-form': 'cosmic-vision',

  'modes-of-nature': 'modes-of-nature',
  bondage: 'modes-of-nature',

  faith: 'faith-and-character',
  purity: 'faith-and-character',
  austerity: 'faith-and-character',
  charity: 'faith-and-character',
  compassion: 'faith-and-character',

  liberation: 'final-liberation',
  transcendence: 'final-liberation',
};

const LABEL_BY_ID = new Map<ClusterId, string>(CLUSTERS.map((c) => [c.id, c.label]));

export const clusterLabel = (id: ClusterId): string => LABEL_BY_ID.get(id) ?? id;

/**
 * The cluster a set of concepts belongs to: the most common one, first
 * concept breaking ties. Undefined for an empty list.
 */
export function clusterOf(concepts: readonly Concept[]): ClusterId | undefined {
  if (concepts.length === 0) return undefined;
  const counts = new Map<ClusterId, number>();
  for (const c of concepts) {
    const id = CONCEPT_CLUSTER[c];
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  let best: ClusterId = CONCEPT_CLUSTER[concepts[0]];
  for (const [id, n] of counts) {
    if (n > (counts.get(best) ?? 0)) best = id;
  }
  return best;
}
