import { describe, it, expect } from 'vitest';
import { CONCEPTS, isConcept } from './concepts.js';
import { verseCuration } from './data/curation.js';
import { verses } from './data/index.js';

describe('CONCEPTS vocabulary', () => {
  it('is sorted, so additions land in an obvious place', () => {
    expect([...CONCEPTS]).toEqual([...CONCEPTS].sort());
  });

  it('has no duplicates', () => {
    expect(new Set(CONCEPTS).size).toBe(CONCEPTS.length);
  });

  it('uses lowercase kebab-case throughout', () => {
    for (const concept of CONCEPTS) {
      expect(concept, concept).toMatch(/^[a-z]+(-[a-z]+)*$/);
    }
  });
});

describe('isConcept', () => {
  it('accepts every vocabulary term', () => {
    for (const concept of CONCEPTS) {
      expect(isConcept(concept), concept).toBe(true);
    }
  });

  it('rejects terms retired in the vocabulary migration', () => {
    // These were live in the free-text era and must not creep back.
    for (const retired of ['self', 'self-knowledge', 'realization', 'maya', 'yoga', 'divine']) {
      expect(isConcept(retired), retired).toBe(false);
    }
  });

  it('rejects the empty string', () => {
    expect(isConcept('')).toBe(false);
  });
});

describe('curation against the vocabulary', () => {
  const tags = Object.values(verseCuration).flatMap((c) => c.concepts);

  it('tags every curated verse only with vocabulary terms', () => {
    for (const [id, curation] of Object.entries(verseCuration)) {
      for (const concept of curation.concepts) {
        expect(isConcept(concept), `${id} uses "${concept}"`).toBe(true);
      }
    }
  });

  it('repeats no concept within a single verse', () => {
    for (const [id, curation] of Object.entries(verseCuration)) {
      expect(new Set(curation.concepts).size, id).toBe(curation.concepts.length);
    }
  });

  // A term nothing uses is dead weight that makes the vocabulary look richer
  // than it is; a term only one verse uses can never match anything, which is
  // the exact failure the vocabulary exists to prevent.
  it('leaves no vocabulary term unused', () => {
    const unused = CONCEPTS.filter((c) => !tags.includes(c));
    expect(unused).toEqual([]);
  });

  it('keeps the vocabulary small enough to actually match', () => {
    const distinct = new Set(tags).size;
    expect(distinct).toBeLessThanOrEqual(60);
    expect(distinct / tags.length).toBeLessThan(0.5);
  });

  it('gives most concepts more than one verse to match against', () => {
    const counts = new Map<string, number>();
    for (const tag of tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    const singletons = [...counts.values()].filter((n) => n === 1).length;
    expect(singletons / counts.size).toBeLessThan(0.5);
  });
});

describe('uncurated verses', () => {
  it('carry no concepts at all', () => {
    for (const verse of verses.filter((v) => !v.curated)) {
      expect(verse.concepts, verse.id).toEqual([]);
    }
  });
});
