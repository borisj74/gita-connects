/**
 * "Check with AI": what is asked of TypeSafe about a reader's network, and
 * how its answers are read back. Shared by the server function
 * (api/check.ts), which sends the questions, and the panel, which shows the
 * result. Pure: no network, no SDK runtime, so it is cheap to test.
 *
 * TypeSafe answers typed questions (scores, choices) rather than writing
 * prose, so the AI judges and the app words the result.
 *
 * Only the app's own scholarship goes into the request: verse ids, themes,
 * our summaries and concepts, link types and the reader's own notes. Never
 * Prabhupada's translation or purport (see NOTICE).
 */
import type { Questions, JsonValue } from '@typesafe-ai/sdk';
import type { ConnectionTypeDef } from './connectionTypes.js';
import type { Verse } from './types.js';

/** A connection the reader drew (or accepted), as sent for checking. */
export interface CheckLink {
  id: string;
  from: string;
  to: string;
  type: string;
  note?: string;
}

export interface CheckInput {
  verses: string[];
  links: CheckLink[];
}

export type Verdict = 'strong' | 'sound' | 'weak' | 'stretch';

export interface LinkVerdict {
  id: string;
  /** Expected rubric score, 0 (a stretch) to 3 (strong). */
  holds: number;
  verdict: Verdict;
  /** A predefined type that fits the pair better than the one drawn. */
  suggestedType?: string;
}

export interface CheckResult {
  links: LinkVerdict[];
  /** The concept the network is most about, when the AI is fairly sure. */
  theme?: { concept: string; confidence: number };
  /** A hand-written reflection question the AI picked for this network. */
  question?: string;
  /** How many of the reader's links were checked, of how many sent. */
  checked: number;
  total: number;
  /** Checks left today for this reader, when the server counts them. */
  remaining?: number;
}

/** Links checked per request; the rest wait for a smaller network. */
export const MAX_LINKS = 12;
const MAX_VERSES = 40;
const MAX_LINKS_SENT = 200;
const MAX_NOTE = 400;
// Below this, a different type is not worth suggesting.
const SUGGEST_CONFIDENCE = 0.5;
const THEME_CONFIDENCE = 0.35;

/** Written by hand: the AI only chooses among them. */
export const REFLECTION_QUESTIONS: Record<string, string> = {
  choice: 'Which of these verses speaks most directly to a choice you face right now?',
  tension: 'Where do these verses agree, and where do they pull in different directions?',
  centre: 'What would change in your day if you lived the verse at the centre of this network?',
  hardest: 'Which verse here is hardest for you to accept, and why?',
  resolution: 'How does this path move from the problem to its resolution?',
  practice: 'What practice do these verses point to, beyond understanding them?',
  thread: 'How would you explain the thread of these verses to a friend in one sentence?',
  doer: 'What do these verses say about who is really acting when you act?',
};

const HOLDS_RUBRIC = [
  'A stretch: these two verses do not stand in this relationship.',
  'Weak: only a loose or surface resemblance.',
  'Sound: the relationship is real, though partial.',
  'Strong: a clear, central instance of this relationship.',
] as const;

const VERDICTS: [number, Verdict][] = [
  [2.4, 'strong'],
  [1.6, 'sound'],
  [0.8, 'weak'],
  [-Infinity, 'stretch'],
];

export function verdictFor(score: number): Verdict {
  return VERDICTS.find(([min]) => score >= min)![1];
}

const isId = (v: unknown): v is string => typeof v === 'string' && /^\d{1,2}\.\d{1,3}$/.test(v);

/** Parse and bound a request body. Returns an error message when it is unusable. */
export function parseCheckInput(body: unknown): CheckInput | string {
  if (!body || typeof body !== 'object') return 'Expected a JSON body';
  const { verses, links } = body as { verses?: unknown; links?: unknown };
  if (!Array.isArray(verses) || !verses.every(isId)) return 'verses must be verse ids like "2.47"';
  if (verses.length > MAX_VERSES) return `At most ${MAX_VERSES} verses can be checked`;
  if (!Array.isArray(links) || links.length === 0) return 'Draw a connection first';
  if (links.length > MAX_LINKS_SENT) return 'Too many connections';
  const parsed: CheckLink[] = [];
  for (const l of links as unknown[]) {
    const { id, from, to, type, note } = (l ?? {}) as Record<string, unknown>;
    if (typeof id !== 'string' || !isId(from) || !isId(to) || typeof type !== 'string') {
      return 'Each connection needs id, from, to and type';
    }
    parsed.push({
      id: id.slice(0, 120),
      from,
      to,
      type: type.slice(0, 60),
      note: typeof note === 'string' && note.trim() ? note.trim().slice(0, MAX_NOTE) : undefined,
    });
  }
  return { verses: verses.slice(), links: parsed };
}

const linkKey = (i: number, q: 'holds' | 'type') => `link_${i}_${q}`;

/** The TypeSafe request: one shared state and named questions. */
export function buildCheckRequest(
  input: CheckInput,
  verseById: (id: string) => Verse | undefined,
  types: ConnectionTypeDef[],
): { state: { [key: string]: JsonValue }; questions: Questions } {
  const typeDef = (id: string) => types.find((t) => t.id === id);
  const links = input.links.slice(0, MAX_LINKS);
  const verses = input.verses.map(verseById).filter((v): v is Verse => !!v);

  const state: { [key: string]: JsonValue } = {
    work: 'Bhagavad Gita, a reader\'s network of connected verses',
    verses: verses.map((v) => ({
      id: v.id,
      theme: v.theme ?? null,
      summary: v.summary ?? null,
      concepts: v.concepts,
    })),
    connections: links.map((l) => ({
      from: l.from,
      to: l.to,
      type: typeDef(l.type)?.label ?? l.type,
      meaning: typeDef(l.type)?.description ?? null,
      readerNote: l.note ?? null,
    })),
  };

  const predefined = types.filter((t) => !t.isCustom);
  const questions: Questions = {};
  links.forEach((l, i) => {
    const t = typeDef(l.type);
    questions[linkKey(i, 'holds')] = {
      type: 'score',
      instructions: {
        question: `How well does the connection from ${l.from} to ${l.to} hold, as a "${t?.label ?? l.type}" link?`,
        meaning: t?.description ?? null,
      },
      criteria: HOLDS_RUBRIC,
    };
    questions[linkKey(i, 'type')] = {
      type: 'choice',
      instructions: `Which kind of relationship best describes how ${l.from} relates to ${l.to}?`,
      criteria: Object.fromEntries(predefined.map((p) => [p.id, p.description ?? p.label])),
    };
  });

  const concepts = [...new Set(verses.flatMap((v) => v.concepts))];
  if (concepts.length >= 2) {
    questions.theme = {
      type: 'choice',
      instructions: 'Which one idea is this network of verses most about, taken as a whole?',
      criteria: Object.fromEntries(concepts.map((c) => [c, null])),
    };
  }
  questions.reflect = {
    type: 'choice',
    instructions: 'Which question would best guide a reader reflecting on this network of verses?',
    criteria: REFLECTION_QUESTIONS,
  };

  return { state, questions };
}

type AnyAnswer = { type?: string; score?: number; choice?: string; confidence?: number };

/** Turn TypeSafe's answers into what the panel shows. */
export function readCheckAnswers(answers: Record<string, unknown>, input: CheckInput): CheckResult {
  const get = (k: string) => answers[k] as AnyAnswer | undefined;
  const links = input.links.slice(0, MAX_LINKS);

  const verdicts: LinkVerdict[] = links.flatMap((l, i) => {
    const holds = get(linkKey(i, 'holds'));
    if (holds?.type !== 'score' || typeof holds.score !== 'number') return [];
    const typed = get(linkKey(i, 'type'));
    const better =
      typed?.type === 'choice' &&
      typed.choice &&
      typed.choice !== l.type &&
      (typed.confidence ?? 0) >= SUGGEST_CONFIDENCE
        ? typed.choice
        : undefined;
    return [{ id: l.id, holds: holds.score, verdict: verdictFor(holds.score), suggestedType: better }];
  });

  const theme = get('theme');
  const reflect = get('reflect');
  return {
    links: verdicts,
    theme:
      theme?.type === 'choice' && theme.choice && (theme.confidence ?? 0) >= THEME_CONFIDENCE
        ? { concept: theme.choice, confidence: theme.confidence ?? 0 }
        : undefined,
    question:
      reflect?.type === 'choice' && reflect.choice ? REFLECTION_QUESTIONS[reflect.choice] : undefined,
    checked: links.length,
    total: input.links.length,
  };
}
