import type { Verse, VerseText } from '../types.js';
import { verseCuration, connections } from './curation.js';
import { generatedCuration } from './curation.generated.js';
import { chapters } from './chapters.js';
import { clusterOf } from '../clusters.js';

import ch01 from './verses/ch-01.json';
import ch02 from './verses/ch-02.json';
import ch03 from './verses/ch-03.json';
import ch04 from './verses/ch-04.json';
import ch05 from './verses/ch-05.json';
import ch06 from './verses/ch-06.json';
import ch07 from './verses/ch-07.json';
import ch08 from './verses/ch-08.json';
import ch09 from './verses/ch-09.json';
import ch10 from './verses/ch-10.json';
import ch11 from './verses/ch-11.json';
import ch12 from './verses/ch-12.json';
import ch13 from './verses/ch-13.json';
import ch14 from './verses/ch-14.json';
import ch15 from './verses/ch-15.json';
import ch16 from './verses/ch-16.json';
import ch17 from './verses/ch-17.json';
import ch18 from './verses/ch-18.json';

const verseTexts: VerseText[] = [
  ch01, ch02, ch03, ch04, ch05, ch06, ch07, ch08, ch09,
  ch10, ch11, ch12, ch13, ch14, ch15, ch16, ch17, ch18,
].flat();

/**
 * All 701 verses, each merged with its curation when one exists. Ordered by
 * chapter then verse, so callers can rely on scripture order without sorting.
 */
export const verses: Verse[] = verseTexts.map((text) => {
  // Hand-written curation always wins over the generated proposal.
  const curation = verseCuration[text.id] ?? generatedCuration[text.id];
  return {
    ...text,
    theme: curation?.theme,
    concepts: curation?.concepts ?? [],
    summary: curation?.summary,
    curated: curation !== undefined,
    reviewed: curation !== undefined && curation.reviewed !== false,
    cluster: clusterOf(curation?.concepts ?? []),
  };
});

const byId = new Map(verses.map((v) => [v.id, v]));

export const getVerse = (id: string): Verse | undefined => byId.get(id);

/** Verses that have a theme and concepts attached, reviewed or not. */
export const curatedVerses = verses.filter((v) => v.curated);

/** Verses whose curation a person has checked. */
export const reviewedVerses = verses.filter((v) => v.reviewed);

/**
 * Prabhupada's translation and purport for a verse, on the Bhaktivedanta Book
 * Trust's own site. The app links here rather than reproducing that text.
 */
export const vedabaseUrl = (verse: { chapter: number; verse: number }): string =>
  `https://vedabase.io/en/library/bg/${verse.chapter}/${verse.verse}/`;

export { chapters, connections };
