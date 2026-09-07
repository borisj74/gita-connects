import { describe, it, expect } from 'vitest';
import { suggestSimilar, suggestionConnection } from './suggestions.js';
import { verses, connections } from './data/index.js';

describe('suggestSimilar', () => {
  const sample = verses[0];

  it('returns nothing for an unknown verse id', () => {
    expect(suggestSimilar('99.99')).toEqual([]);
  });

  it('never suggests the source verse itself', () => {
    for (const verse of verses) {
      const ids = suggestSimilar(verse.id, 50).map((s) => s.verse.id);
      expect(ids, verse.id).not.toContain(verse.id);
    }
  });

  it('never suggests a verse already connected in the dataset', () => {
    for (const verse of verses) {
      const alreadyConnected = new Set(
        connections
          .filter((c) => c.from === verse.id || c.to === verse.id)
          .map((c) => (c.from === verse.id ? c.to : c.from)),
      );
      for (const s of suggestSimilar(verse.id, 50)) {
        expect(alreadyConnected, `${verse.id} -> ${s.verse.id}`).not.toContain(s.verse.id);
      }
    }
  });

  it('honours the limit', () => {
    expect(suggestSimilar(sample.id, 2).length).toBeLessThanOrEqual(2);
  });

  it('defaults to at most 5 suggestions', () => {
    for (const verse of verses) {
      expect(suggestSimilar(verse.id).length, verse.id).toBeLessThanOrEqual(5);
    }
  });

  it('returns results sorted by descending score', () => {
    for (const verse of verses) {
      const scores = suggestSimilar(verse.id, 50).map((s) => s.score);
      expect(scores, verse.id).toEqual([...scores].sort((a, b) => b - a));
    }
  });

  it('only returns suggestions with a positive score', () => {
    for (const verse of verses) {
      for (const s of suggestSimilar(verse.id, 50)) {
        expect(s.score, `${verse.id} -> ${s.verse.id}`).toBeGreaterThan(0);
      }
    }
  });

  it('scores as sharedConcepts * 2, plus 1 for a matching theme, plus 1 for a matching cluster', () => {
    for (const verse of verses) {
      for (const s of suggestSimilar(verse.id, 50)) {
        expect(s.score).toBe(
          s.shared.length * 2 + (s.sameTheme ? 1 : 0) + (s.sameCluster ? 1 : 0),
        );
      }
    }
  });

  it('reports sameCluster only when both verses share a cluster', () => {
    for (const verse of verses) {
      for (const s of suggestSimilar(verse.id, 50)) {
        const both = verse.cluster !== undefined && s.verse.cluster !== undefined;
        expect(s.sameCluster).toBe(both && verse.cluster === s.verse.cluster);
      }
    }
  });

  // The whole point of clusters and the two-concept minimum: nobody opens a
  // verse and finds nothing to explore.
  it('offers at least one suggestion for every curated verse', () => {
    const empty = verses
      .filter((v) => v.curated && suggestSimilar(v.id, 5).length === 0)
      .map((v) => v.id);
    expect(empty).toEqual([]);
  });

  it('reports shared concepts that both verses actually have', () => {
    for (const verse of verses) {
      for (const s of suggestSimilar(verse.id, 50)) {
        for (const concept of s.shared) {
          expect(verse.concepts).toContain(concept);
          expect(s.verse.concepts).toContain(concept);
        }
      }
    }
  });

  it('matches themes case-insensitively', () => {
    for (const verse of verses) {
      for (const s of suggestSimilar(verse.id, 50)) {
        const bothThemed = s.verse.theme !== undefined && verse.theme !== undefined;
        expect(s.sameTheme).toBe(
          bothThemed && s.verse.theme!.toLowerCase() === verse.theme!.toLowerCase(),
        );
      }
    }
  });
});

describe('suggestionConnection', () => {
  it('always produces a conceptual connection', () => {
    expect(suggestionConnection(['duty']).type).toBe('conceptual');
  });

  it('lists the shared concepts in the description', () => {
    expect(suggestionConnection(['duty', 'action']).description).toBe(
      'Shared concepts: duty, action',
    );
  });

  it('falls back to a theme description when nothing is shared', () => {
    expect(suggestionConnection([]).description).toBe('Similar theme');
  });

  it('scales strength with the number of shared concepts', () => {
    expect(suggestionConnection([]).strength).toBe(3);
    expect(suggestionConnection(['a']).strength).toBe(6);
    expect(suggestionConnection(['a', 'b']).strength).toBe(9);
  });

  it('caps strength at 10', () => {
    expect(suggestionConnection(['a', 'b', 'c', 'd', 'e']).strength).toBe(10);
  });
});
