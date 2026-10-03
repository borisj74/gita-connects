import { describe, it, expect } from 'vitest';
import {
  buildCheckRequest,
  parseCheckInput,
  readCheckAnswers,
  verdictFor,
  MAX_LINKS,
  REFLECTION_QUESTIONS,
  type CheckInput,
} from './aiCheck.js';
import { PREDEFINED_CONNECTION_TYPES } from './connectionTypes.js';
import { getVerse } from './data/index.js';

const input: CheckInput = {
  verses: ['2.47', '3.9', '18.66'],
  links: [
    { id: 'a', from: '2.47', to: '3.9', type: 'progression', note: 'right to act, then act as sacrifice' },
    { id: 'b', from: '3.9', to: '18.66', type: 'thematic' },
  ],
};

describe('parseCheckInput', () => {
  it('accepts a well-formed body and trims notes', () => {
    const r = parseCheckInput({ verses: ['2.47'], links: [{ id: 'x', from: '2.47', to: '3.9', type: 'goal', note: '  hi ' }] });
    expect(r).toEqual({ verses: ['2.47'], links: [{ id: 'x', from: '2.47', to: '3.9', type: 'goal', note: 'hi' }] });
  });

  it('rejects bodies it cannot use', () => {
    expect(parseCheckInput(null)).toBeTypeOf('string');
    expect(parseCheckInput({ verses: ['2.47'], links: [] })).toBe('Draw a connection first');
    expect(parseCheckInput({ verses: ['abc'], links: [] })).toBeTypeOf('string');
    expect(parseCheckInput({ verses: [], links: [{ id: 'x', from: 'nope', to: '3.9', type: 'goal' }] })).toBeTypeOf('string');
  });
});

describe('buildCheckRequest', () => {
  const { state, questions } = buildCheckRequest(input, getVerse, PREDEFINED_CONNECTION_TYPES);

  it('asks whether each link holds and which type fits, plus theme and reflection', () => {
    expect(Object.keys(questions).sort()).toEqual(
      ['link_0_holds', 'link_0_type', 'link_1_holds', 'link_1_type', 'reflect', 'theme'].sort(),
    );
    expect(questions.link_0_holds.type).toBe('score');
    expect(questions.link_1_type.type).toBe('choice');
  });

  it('offers only predefined types as the better fit', () => {
    const q = questions.link_0_type as { criteria: Record<string, unknown> };
    expect(Object.keys(q.criteria).sort()).toEqual(PREDEFINED_CONNECTION_TYPES.map((t) => t.id).sort());
  });

  it('sends our own scholarship and the reader note, never a translation', () => {
    const json = JSON.stringify(state);
    expect(json).toContain('right to act, then act as sacrifice');
    expect(json).not.toMatch(/translation|purport|synonyms/i);
    const verses = state.verses as { id: string; concepts: string[] }[];
    expect(verses.map((v) => v.id)).toEqual(['2.47', '3.9', '18.66']);
    expect(verses[0].concepts.length).toBeGreaterThan(0);
  });

  it(`checks at most ${MAX_LINKS} links per request`, () => {
    const many: CheckInput = {
      verses: ['2.47', '3.9'],
      links: Array.from({ length: MAX_LINKS + 5 }, (_, i) => ({ id: `l${i}`, from: '2.47', to: '3.9', type: 'goal' })),
    };
    const q = buildCheckRequest(many, getVerse, PREDEFINED_CONNECTION_TYPES).questions;
    expect(Object.keys(q).filter((k) => k.endsWith('_holds'))).toHaveLength(MAX_LINKS);
  });
});

describe('readCheckAnswers', () => {
  it('turns scores and choices into verdicts, a suggestion, a theme and a question', () => {
    const r = readCheckAnswers(
      {
        link_0_holds: { type: 'score', score: 2.8, confidence: 0.9 },
        link_0_type: { type: 'choice', choice: 'progression', confidence: 0.8 },
        link_1_holds: { type: 'score', score: 1.1, confidence: 0.7 },
        link_1_type: { type: 'choice', choice: 'goal', confidence: 0.7 },
        theme: { type: 'choice', choice: 'duty', confidence: 0.6 },
        reflect: { type: 'choice', choice: 'practice', confidence: 0.4 },
      },
      input,
    );
    expect(r.links).toEqual([
      { id: 'a', holds: 2.8, verdict: 'strong', suggestedType: undefined },
      { id: 'b', holds: 1.1, verdict: 'weak', suggestedType: 'goal' },
    ]);
    expect(r.theme).toEqual({ concept: 'duty', confidence: 0.6 });
    expect(r.question).toBe(REFLECTION_QUESTIONS.practice);
    expect([r.checked, r.total]).toEqual([2, 2]);
  });

  it('does not suggest a type the AI is unsure of, or show an unsure theme', () => {
    const r = readCheckAnswers(
      {
        link_0_holds: { type: 'score', score: 2, confidence: 0.5 },
        link_0_type: { type: 'choice', choice: 'goal', confidence: 0.3 },
        theme: { type: 'choice', choice: 'duty', confidence: 0.2 },
      },
      input,
    );
    expect(r.links[0].suggestedType).toBeUndefined();
    expect(r.theme).toBeUndefined();
  });

  it('maps scores to verdicts', () => {
    expect([0.2, 1, 2, 2.9].map(verdictFor)).toEqual(['stretch', 'weak', 'sound', 'strong']);
  });
});
