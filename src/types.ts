import type { Concept } from './concepts.js';
import type { ClusterId } from './clusters.js';

/** Public-domain verse text, imported from src/data/verses/ch-NN.json. */
export interface VerseText {
  id: string; // e.g., "2.47"
  chapter: number;
  verse: number;
  sanskrit: string;
  transliteration: string;
  wordMeanings: string; // word-by-word Sanskrit-English glosses
}

/** Hand-authored scholarship layered on top of a verse. */
export interface VerseCuration {
  theme: string;
  /** Drawn from the controlled vocabulary in src/concepts.ts. */
  concepts: Concept[];
  summary?: string;
  /**
   * False for entries produced by scripts/generate-concepts.mjs that nobody
   * has checked yet. Hand-written entries omit it (treated as reviewed).
   */
  reviewed?: boolean;
}

/**
 * A verse as the app consumes it: imported text plus curation when it exists.
 *
 * `theme` and `summary` are absent and `concepts` is empty for uncurated
 * verses — most of the 701 — so treat `curated` as the flag for "has
 * scholarship attached". No English translation is carried: Prabhupada's
 * translation and purport are Bhaktivedanta Book Trust copyright, so the app
 * links out to vedabase.io via vedabaseUrl() rather than reproducing them.
 */
export interface Verse extends VerseText {
  theme?: string;
  concepts: Concept[];
  summary?: string;
  /** Has any curation at all, hand-written or generated. */
  curated: boolean;
  /** Curation has been checked by a person. Always false when !curated. */
  reviewed: boolean;
  /** Theme cluster derived from the concepts; undefined when uncurated. */
  cluster?: ClusterId;
}

export interface Connection {
  from: string; // verse id
  to: string; // verse id
  type: string; // connection type id (predefined or custom)
  description: string;
  strength: number; // 1-10
}

export interface Chapter {
  number: number;
  title: string;
  titleSanskrit: string;
  verses: number; // total verses in chapter
  theme: string;
}
