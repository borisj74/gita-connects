import { describe, it, expect } from 'vitest';
import { analyzeNetwork, type InsightEdge } from './insights.js';
import { CLUSTERS } from './clusters.js';
import type { Verse } from './types.js';
import type { Concept } from './concepts.js';

function verse(id: string, concepts: Concept[], cluster?: Verse['cluster'], theme?: string): Verse {
  const [chapter, n] = id.split('.').map(Number);
  return {
    id, chapter, verse: n, sanskrit: '', transliteration: '',
    concepts, cluster, theme, curated: true, reviewed: true,
  };
}

const V: Verse[] = [
  verse('2.47', ['duty', 'detachment'], 'duty-and-action', 'Right to action'),
  verse('3.9', ['sacrifice', 'duty'], 'duty-and-action', 'Work as sacrifice'),
  verse('9.22', ['devotion', 'surrender'], 'devotion-and-surrender', 'Divine Care'),
  verse('18.66', ['surrender', 'devotion'], 'devotion-and-surrender', 'Complete Surrender'),
  verse('2.20', ['soul'], 'soul-and-self', 'The eternal soul'),
];
const byId = (id: string) => V.find((v) => v.id === id);
const label = (id: string) => id.charAt(0).toUpperCase() + id.slice(1);
const run = (ids: string[], edges: InsightEdge[]) => analyzeNetwork(ids, edges, byId, label);
const all = V.map((v) => v.id);

describe('analyzeNetwork', () => {
  it('counts verses and links, ignoring links to verses not on the canvas', () => {
    const r = run(['2.47', '3.9'], [
      { source: '2.47', target: '3.9', typeId: 'progression' },
      { source: '2.47', target: '18.66', typeId: 'goal' },
    ]);
    expect(r.verseCount).toBe(2);
    expect(r.linkCount).toBe(1);
  });

  it('lists concepts held by two or more verses, most shared first', () => {
    const r = run(all, []);
    expect(r.sharedConcepts).toEqual([
      { concept: 'devotion', count: 2 },
      { concept: 'duty', count: 2 },
      { concept: 'surrender', count: 2 },
    ]);
  });

  it('names the verse linked to the most distinct others as the hub', () => {
    const r = run(all, [
      { source: '9.22', target: '18.66', typeId: 'goal' },
      { source: '9.22', target: '18.66', typeId: 'thematic' },
      { source: '2.47', target: '9.22', typeId: 'progression' },
      { source: '9.22', target: '3.9', typeId: 'thematic' },
    ]);
    expect(r.hub).toEqual({ id: '9.22', theme: 'Divine Care', links: 3 });
  });

  it('has no hub until some verse has two links', () => {
    expect(run(all, [{ source: '2.47', target: '3.9', typeId: 'thematic' }]).hub).toBeNull();
  });

  it('splits the eleven clusters into covered and missing', () => {
    const r = run(all, []);
    expect(r.coveredClusters.map((c) => [c.id, c.count])).toEqual([
      ['duty-and-action', 2],
      ['devotion-and-surrender', 2],
      ['soul-and-self', 1],
    ]);
    expect(r.missingClusters).toHaveLength(CLUSTERS.length - 3);
  });

  it('reads the character from a dominant link type', () => {
    const r = run(all, [
      { source: '2.47', target: '3.9', typeId: 'progression' },
      { source: '3.9', target: '9.22', typeId: 'progression' },
      { source: '9.22', target: '18.66', typeId: 'goal' },
    ]);
    expect(r.linkMix).toEqual([
      { typeId: 'progression', count: 2 },
      { typeId: 'goal', count: 1 },
    ]);
    expect(r.character).toMatch(/develops/);
  });

  it('calls a network with no dominant type a mix', () => {
    const r = run(all, [
      { source: '2.47', target: '3.9', typeId: 'progression' },
      { source: '3.9', target: '9.22', typeId: 'goal' },
      { source: '9.22', target: '18.66', typeId: 'thematic' },
    ]);
    expect(r.character).toMatch(/mix of 3/);
  });

  it('names a dominant custom type by its label', () => {
    const r = run(['2.47', '3.9'], [{ source: '2.47', target: '3.9', typeId: 'symbolic' }]);
    expect(r.character).toBe('Mostly Symbolic links.');
  });

  it('has no character without links, and lists unlinked verses as loose ends', () => {
    const r = run(all, [{ source: '2.47', target: '3.9', typeId: 'thematic' }]);
    expect(r.looseEnds).toEqual(['9.22', '18.66', '2.20']);
    expect(run(all, []).character).toBeNull();
  });
});
