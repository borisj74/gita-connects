import { describe, it, expect } from 'vitest';
import { rankForReview, WEIGHTS } from './rank.js';
import { verses } from '../data/index.js';
import { FAMOUS_VERSES } from './famous.js';

describe('rankForReview', () => {
  const ranked = rankForReview();

  it('covers every unreviewed verse exactly once and nothing else', () => {
    const unreviewed = verses.filter((v) => v.curated && !v.reviewed).map((v) => v.id).sort();
    expect(ranked.map((r) => r.id).sort()).toEqual(unreviewed);
  });

  it('scales every signal to 0–1 and scores within the weight budget', () => {
    const budget = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
    ranked.forEach((r) => {
      Object.values(r.signals).forEach((s) => {
        expect(s).toBeGreaterThanOrEqual(0);
        expect(s).toBeLessThanOrEqual(1);
      });
      expect(r.score).toBeLessThanOrEqual(budget + 1e-9);
    });
  });

  it('puts well-known verses ahead of the pack', () => {
    const famousRanks = ranked.map((r, i) => (FAMOUS_VERSES.has(r.id) ? i : -1)).filter((i) => i >= 0);
    const median = famousRanks.sort((a, b) => a - b)[Math.floor(famousRanks.length / 2)];
    expect(median).toBeLessThan(ranked.length / 4);
    expect(ranked[0].reasons).toContain('well-known verse');
  });

  it('every candidate carries at least one reason', () => {
    ranked.forEach((r) => expect(r.reasons.length).toBeGreaterThan(0));
  });

  it('filters by chapter and concept', () => {
    rankForReview({ chapter: 12 }).forEach((r) => expect(r.chapter).toBe(12));
    rankForReview({ concept: 'faith' }).forEach((r) => expect(r.concepts).toContain('faith'));
  });

  it('lifts a verse the reader has shown interest in', () => {
    const last = ranked[ranked.length - 1].id;
    const boosted = rankForReview({ demand: new Map([[last, 5]]) });
    const before = ranked.findIndex((r) => r.id === last);
    const after = boosted.findIndex((r) => r.id === last);
    expect(after).toBeLessThan(before);
    expect(boosted[after].reasons.some((r) => r.startsWith('in your networks'))).toBe(true);
  });

  it('is deterministic', () => {
    expect(rankForReview().map((r) => r.id)).toEqual(ranked.map((r) => r.id));
  });
});
