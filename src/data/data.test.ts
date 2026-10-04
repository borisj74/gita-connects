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

  it('fills in sanskrit and transliteration for every verse', () => {
    for (const verse of verses) {
      expect(verse.sanskrit.trim(), verse.id).not.toBe('');
      expect(verse.transliteration.trim(), verse.id).not.toBe('');
    }
  });

  // The upstream transliteration ran some verses on into the next (2.42 held
  // all of 2.43). scripts/import-verses.mjs realigns it; these guard that.
  describe('transliteration holds only its own verse', () => {
    /** Letters only, with spelling variants folded, so "śhṛiṇu" and "śṛṇu" compare equal. */
    const skeleton = (s: string) =>
      s
        .normalize('NFD')
        .toLowerCase()
        .replace(/ṛi/g, 'r')
        .replace(/[̀-ͯ]/g, '')
        .replace(/w/g, 'v')
        .replace(/[^a-z]/g, '')
        .replace(/h/g, '')
        .replace(/[mn]/g, 'n');
    /** Text after a leading "arjuna uvācha" or "śhrī-bhagavān uvācha", which many verses share. */
    const body = (s: string) => s.replace(/^(\S+\s+){1,2}?uvācha\s+/, '');
    // About the first three or four words.
    const opening = (s: string) => skeleton(body(s)).slice(0, 24);

    // Lines the Gita itself repeats, so these verses really do open with
    // words found in another verse.
    const REPEATS = new Set(['3.35>18.47', '18.47>3.35', '6.15>6.28', '6.28>6.15', '9.34>18.65', '18.65>9.34', '16.18>18.53', '18.53>16.18', '18.5>18.3']);

    it("contains no other verse's opening words", () => {
      const bodies = verses.map((v) => [v.id, skeleton(body(v.transliteration))] as const);
      const found: string[] = [];
      for (const verse of verses) {
        const start = opening(verse.transliteration);
        expect(start.length, verse.id).toBe(24);
        for (const [id, text] of bodies) {
          if (id !== verse.id && text.includes(start) && !REPEATS.has(`${verse.id}>${id}`)) {
            found.push(`${verse.id} opens inside ${id}`);
          }
        }
      }
      expect(found).toEqual([]);
    });

    it('is roman script, not Devanagari', () => {
      for (const verse of verses) {
        expect(verse.transliteration, verse.id).not.toMatch(/[ऀ-ॿ]/);
      }
    });

    it('has as many syllables as its Devanagari, so it holds no more and no less', () => {
      const devanagari = (s: string) => {
        const chars = [...s];
        let n = 0;
        chars.forEach((ch, i) => {
          const c = ch.codePointAt(0)!;
          if ((c >= 0x0905 && c <= 0x0914) || c === 0x0950 || c === 0x0960 || c === 0x0961) n++;
          else if ((c >= 0x0915 && c <= 0x0939) || (c >= 0x0958 && c <= 0x095f)) {
            const next = chars[i + 1] === '़' ? chars[i + 2] : chars[i + 1];
            if (next !== '्') n++;
          }
        });
        return n;
      };
      const roman = (s: string) =>
        (s.normalize('NFD').toLowerCase().replace(/[rl]̣̄?i?/g, 'R').replace(/[̀-ͯ]/g, '').match(/ai|au|[aeiouR]/g) ?? []).length;
      for (const verse of verses) {
        // A syllable or two of slack for spelling slips in the Devanagari.
        expect(Math.abs(roman(verse.transliteration) - devanagari(verse.sanskrit)), verse.id).toBeLessThanOrEqual(3);
      }
    });
  });

  it('carries no English word glosses, which have no stated source', () => {
    for (const verse of verses) {
      expect(verse, verse.id).not.toHaveProperty('wordMeanings');
    }
  });

  it('carries no English translation, which would be BBT copyright', () => {
    for (const verse of verses) {
      expect(verse, verse.id).not.toHaveProperty('translation');
    }
  });

  it('links every verse to its Vedabase page', () => {
    for (const verse of verses) {
      expect(vedabaseUrl(verse), verse.id).toMatch(/^https:\/\/vedabase\.io\/en\/library\/bg\/\d+\/\d+(-\d+)?\/$/);
    }
    const url = (id: string) => vedabaseUrl({ chapter: Number(id.split('.')[0]), verse: Number(id.split('.')[1]) });
    expect(url('2.47')).toBe('https://vedabase.io/en/library/bg/2/47/');
    // Verses that share a page on Vedabase.
    expect(url('1.17')).toBe('https://vedabase.io/en/library/bg/1/16-18/');
    expect(url('13.10')).toBe('https://vedabase.io/en/library/bg/13/8-12/');
    // Chapter 1 runs one ahead of As It Is from 1.29.
    expect(url('1.28')).toBe('https://vedabase.io/en/library/bg/1/28/');
    expect(url('1.40')).toBe('https://vedabase.io/en/library/bg/1/39/');
    expect(url('1.47')).toBe('https://vedabase.io/en/library/bg/1/46/');
    expect(url('1.36')).toBe('https://vedabase.io/en/library/bg/1/32-35/');
  });

  it('ends 1.20, 1.26 and 1.27 where As It Is does, so the Sanskrit matches the translation', () => {
    const roman = (id: string) => verses.find((v) => v.id === id)!.transliteration;
    expect(roman('1.20')).toMatch(/idam āha mahī-pate$/);
    expect(roman('1.21')).toMatch(/^arjuna uvācha senayor ubhayor madhye/);
    expect(roman('1.26')).toMatch(/senayor ubhayor api$/);
    expect(roman('1.27')).toMatch(/^tān samīkṣhya .* viṣhīdann idam abravīt$/);
    expect(roman('1.28')).toMatch(/^arjuna uvācha dṛiṣhṭvemaṁ/);
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
