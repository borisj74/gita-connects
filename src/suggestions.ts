import { verses, connections } from './data/index.js';
import type { Verse } from './types.js';

export interface Suggestion {
  verse: Verse;
  shared: string[];
  sameTheme: boolean;
  sameCluster: boolean;
  score: number;
}

// Suggest verses similar to the given one, by concept overlap (+ theme match),
// excluding the verse itself and any verse already connected to it in the
// authored dataset. Surfaces *new* links the data doesn't already encode.
export function suggestSimilar(verseId: string, limit = 5): Suggestion[] {
  const source = verses.find((v) => v.id === verseId);
  if (!source) return [];

  const alreadyConnected = new Set<string>();
  connections.forEach((c) => {
    if (c.from === verseId) alreadyConnected.add(c.to);
    if (c.to === verseId) alreadyConnected.add(c.from);
  });

  const sourceConcepts = new Set(source.concepts);

  return verses
    .filter((v) => v.id !== verseId && !alreadyConnected.has(v.id))
    .map((v) => {
      const shared = v.concepts.filter((c) => sourceConcepts.has(c));
      // Two uncurated verses both lack a theme; that is not a match.
      const sameTheme =
        source.theme !== undefined &&
        v.theme !== undefined &&
        v.theme.toLowerCase() === source.theme.toLowerCase();
      // Same cluster is worth one point: weaker than a shared concept, but
      // enough that a verse always has neighbours to suggest.
      const sameCluster =
        source.cluster !== undefined && v.cluster !== undefined && v.cluster === source.cluster;
      const score = shared.length * 2 + (sameTheme ? 1 : 0) + (sameCluster ? 1 : 0);
      return { verse: v, shared, sameTheme, sameCluster, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || b.shared.length - a.shared.length)
    .slice(0, limit);
}

// Build the connection metadata for an accepted suggestion.
export function suggestionConnection(shared: string[]) {
  return {
    type: 'thematic',
    description: shared.length
      ? `Shared concepts: ${shared.join(', ')}`
      : 'Similar theme',
    strength: Math.min(10, shared.length * 3 + 3),
  };
}
