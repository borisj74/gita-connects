/**
 * The controlled vocabulary for verse concepts.
 *
 * Concepts are the only thing suggestSimilar() has to match on, so they are
 * worth nothing unless the same idea is always spelled the same way. The
 * first pass of curation used free text and drifted badly: 92 distinct tags
 * across 37 verses, 64 of them used exactly once, with self / self-knowledge
 * / self-realization / realization all live at the same time. Nothing could
 * match anything.
 *
 * So the vocabulary is fixed here and enforced by the type system: Verse
 * concepts are typed `Concept`, and src/data/curation.ts will not compile if
 * it uses a term that is not on this list. Adding a genuinely new idea means
 * adding it here deliberately, which is the point.
 *
 * Keep this list sorted and free of duplicates — both are asserted in
 * src/concepts.test.ts.
 *
 * The first 36 terms were derived from the 37 hand-curated verses. Five were
 * added before tagging the remaining 664, for ideas those verses barely touch:
 * austerity and charity (ch. 16-17), guru (ch. 4), opulence (ch. 10) and
 * universal-form (ch. 11).
 */
export const CONCEPTS = [
  'action',
  'anger',
  'attachment',
  'austerity',
  'bondage',
  'charity',
  'compassion',
  'death',
  'desire',
  'detachment',
  'devotion',
  'dharma',
  'discipline',
  'duty',
  'ego',
  'equanimity',
  'faith',
  'grace',
  'grief',
  'guru',
  'illusion',
  'impermanence',
  'karma-yoga',
  'knowledge',
  'liberation',
  'meditation',
  'modes-of-nature',
  'opulence',
  'purity',
  'remembrance',
  'renunciation',
  'sacrifice',
  'self-realization',
  'soul',
  'supreme-person',
  'surrender',
  'transcendence',
  'unity',
  'universal-form',
  'war',
  'wisdom',
] as const;

export type Concept = (typeof CONCEPTS)[number];

const CONCEPT_SET: ReadonlySet<string> = new Set(CONCEPTS);

export const isConcept = (value: string): value is Concept => CONCEPT_SET.has(value);
