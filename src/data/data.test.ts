import { describe, it, expect } from 'vitest';
import { chapters, verses, connections, vedabaseUrl } from './index.js';
import { verseCuration } from './curation.js';
import { PREDEFINED_CONNECTION_TYPES } from '../connectionTypes.js';

const verseIds = new Set(verses.map((v) => v.id));
const chapterNumbers = new Set(chapters.map((c) => c.number));
const typeIds = new Set(PREDEFINED_CONNECTION_TYPES.map((t) => t.id));

describe('chapters', () => {
  it('covers all 18 chapters exactly once', () => {
    expect(chapters).toHaveLength(18);
    expect([...chapterNumbers].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 18 }, (_, i) => i + 1),
    );
  });

  it('gives every chapter a title, Sanskrit title, theme, and positive verse count', () => {
    for (const chapter of chapters) {
      expect(chapter.title.trim()).not.toBe('');
      expect(chapter.titleSanskrit.trim()).not.toBe('');
      expect(chapter.theme.trim()).not.toBe('');
      expect(chapter.verses).toBeGreaterThan(0);
    }
  });
});

describe('verses', () => {
  it('has unique ids', () => {
    expect(verseIds.size).toBe(verses.length);
  });

  it('formats every id as "<chapter>.<verse>" matching its own fields', () => {
    for (const verse of verses) {
      expect(verse.id).toBe(`${verse.chapter}.${verse.verse}`);
    }
  });

  it('references a real chapter', () => {
    for (const verse of verses) {
      expect(chapterNumbers).toContain(verse.chapter);
    }
  });

  it('never exceeds the declared verse count of its chapter', () => {
    const countByChapter = new Map(chapters.map((c) => [c.number, c.verses]));
    for (const verse of verses) {
      expect(verse.verse).toBeGreaterThan(0);
      expect(verse.verse).toBeLessThanOrEqual(countByChapter.get(verse.chapter)!);
    }
  });

  it('fills in sanskrit, transliteration, and word meanings for every verse', () => {
    for (const verse of verses) {
      expect(verse.sanskrit.trim(), verse.id).not.toBe('');
      expect(verse.transliteration.trim(), verse.id).not.toBe('');
      expect(verse.wordMeanings.trim(), verse.id).not.toBe('');
    }
  });

  it('carries no English translation, which would be BBT copyright', () => {
    for (const verse of verses) {
      expect(verse, verse.id).not.toHaveProperty('translation');
    }
  });

  it('links every verse to its Vedabase page', () => {
    for (const verse of verses) {
      expect(vedabaseUrl(verse)).toBe(
        `https://vedabase.io/en/library/bg/${verse.chapter}/${verse.verse}/`,
      );
    }
  });

  it('gives every curated verse a theme and at least one concept', () => {
    for (const verse of verses.filter((v) => v.curated)) {
      expect(verse.theme?.trim(), verse.id).not.toBe('');
      expect(verse.concepts.length, verse.id).toBeGreaterThan(0);
      expect(verse.concepts.every((c) => c.trim() !== ''), verse.id).toBe(true);
      expect(new Set(verse.concepts).size, verse.id).toBe(verse.concepts.length);
    }
  });

  it('leaves uncurated verses without a theme or concepts', () => {
    for (const verse of verses.filter((v) => !v.curated)) {
      expect(verse.theme, verse.id).toBeUndefined();
      expect(verse.concepts, verse.id).toEqual([]);
    }
  });

  it('holds all 701 verses, with hand curation a subset of all curation', () => {
    expect(verses).toHaveLength(701);
    const curated = verses.filter((v) => v.curated).length;
    expect(curated).toBeGreaterThanOrEqual(Object.keys(verseCuration).length);
    expect(verses.filter((v) => v.reviewed).length).toBe(Object.keys(verseCuration).length);
  });
});

describe('primary and secondary concepts', () => {
  it('gives every curated verse a primary and a secondary concept', () => {
    for (const v of verses.filter((x) => x.curated)) {
      expect(v.primaryConcept, v.id).toBe(v.concepts[0]);
      expect(v.secondaryConcept, v.id).toBe(v.concepts[1]);
      expect(v.secondaryConcept, v.id).toBeDefined();
    }
  });

  it('leaves both undefined for uncurated verses', () => {
    for (const v of verses.filter((x) => !x.curated)) {
      expect(v.primaryConcept, v.id).toBeUndefined();
      expect(v.secondaryConcept, v.id).toBeUndefined();
    }
  });
});

describe('connections', () => {
  it('references only verses that exist', () => {
    for (const c of connections) {
      expect(verseIds, `${c.from} -> ${c.to}`).toContain(c.from);
      expect(verseIds, `${c.from} -> ${c.to}`).toContain(c.to);
    }
  });

  it('uses only known connection types', () => {
    for (const c of connections) {
      expect(typeIds, `${c.from} -> ${c.to}`).toContain(c.type);
    }
  });

  it('keeps strength within 1-10', () => {
    for (const c of connections) {
      expect(c.strength, `${c.from} -> ${c.to}`).toBeGreaterThanOrEqual(1);
      expect(c.strength, `${c.from} -> ${c.to}`).toBeLessThanOrEqual(10);
    }
  });

  it('describes every connection', () => {
    for (const c of connections) {
      expect(c.description.trim(), `${c.from} -> ${c.to}`).not.toBe('');
    }
  });

  it('never links a verse to itself', () => {
    for (const c of connections) {
      expect(c.from).not.toBe(c.to);
    }
  });

  // NOTE: the dataset deliberately contains reciprocal links — the same verse
  // pair related in both directions, usually under different connection types
  // and always with a description written from that side. So uniqueness is
  // asserted on the full (from, to, type) triple, not on the unordered pair.
  // See the "reciprocal links" test below for what is intentionally allowed.
  it('has no duplicate from/to/type triples', () => {
    const seen = new Set<string>();
    for (const c of connections) {
      const key = `${c.from}|${c.to}|${c.type}`;
      expect(seen, `duplicate connection ${key}`).not.toContain(key);
      seen.add(key);
    }
  });

  it('gives each reciprocal link its own description', () => {
    const byPair = new Map<string, string[]>();
    for (const c of connections) {
      const key = [c.from, c.to].sort().join('|');
      byPair.set(key, [...(byPair.get(key) ?? []), c.description]);
    }
    for (const [pair, descriptions] of byPair) {
      if (descriptions.length > 1) {
        expect(new Set(descriptions).size, `identical descriptions on ${pair}`).toBe(
          descriptions.length,
        );
      }
    }
  });

  // Uncurated verses are expected to have no connections yet; curated ones
  // exist precisely because someone linked them, so those must not be orphans.
  it('leaves no verse unlinked', () => {
    const connected = new Set(connections.flatMap((c) => [c.from, c.to]));
    const orphans = verses.filter((v) => !connected.has(v.id)).map((v) => v.id);
    expect(orphans).toEqual([]);
  });

  it('leaves no reviewed verse orphaned', () => {
    const connected = new Set(connections.flatMap((c) => [c.from, c.to]));
    const orphans = verses.filter((v) => v.reviewed && !connected.has(v.id)).map((v) => v.id);
    expect(orphans).toEqual([]);
  });

  // Authored connections may join any verse — a link is itself a piece of
  // review, even when the verse's concepts are still machine-proposed.
  it('connects only verses that exist', () => {
    const ids = new Set(verses.map((v) => v.id));
    for (const c of connections) {
      expect(ids, `${c.from} -> ${c.to}`).toContain(c.from);
      expect(ids, `${c.from} -> ${c.to}`).toContain(c.to);
    }
  });
});
