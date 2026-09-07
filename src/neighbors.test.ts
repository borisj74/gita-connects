import { describe, it, expect } from 'vitest';
import { neighborLinks, expandableNeighbors, edgesJoining } from './neighbors.js';
import { verses, connections } from './data/index.js';

const hasAuthored = (id: string) => connections.some((c) => c.from === id || c.to === id);

describe('neighborLinks', () => {
  it('returns only authored links for a verse that has any', () => {
    for (const v of verses.filter((x) => hasAuthored(x.id))) {
      const links = neighborLinks(v.id);
      expect(links.length, v.id).toBeGreaterThan(0);
      expect(links.every((l) => l.authored), v.id).toBe(true);
    }
  });

  it('falls back to suggestions for a verse with no authored links', () => {
    for (const v of verses.filter((x) => x.curated && !hasAuthored(x.id))) {
      const links = neighborLinks(v.id);
      expect(links.length, v.id).toBeGreaterThan(0);
      expect(links.every((l) => !l.authored), v.id).toBe(true);
      expect(links.length).toBeLessThanOrEqual(5);
    }
  });

  it('never returns the verse itself or a duplicate neighbour', () => {
    for (const v of verses.filter((x) => x.curated)) {
      const ids = neighborLinks(v.id).map((l) => l.id);
      expect(ids, v.id).not.toContain(v.id);
      expect(new Set(ids).size, v.id).toBe(ids.length);
    }
  });

  it('points every suggested connection from the verse to the neighbour', () => {
    for (const v of verses.filter((x) => x.curated && !hasAuthored(x.id))) {
      for (const l of neighborLinks(v.id)) {
        expect(l.connection.from).toBe(v.id);
        expect(l.connection.to).toBe(l.id);
        expect(l.connection.strength).toBeGreaterThanOrEqual(1);
        expect(l.connection.strength).toBeLessThanOrEqual(10);
      }
    }
  });

  it('gives every curated verse something to expand to', () => {
    const dead = verses.filter((v) => v.curated && neighborLinks(v.id).length === 0).map((v) => v.id);
    expect(dead).toEqual([]);
  });
});

describe('expandableNeighbors', () => {
  it('excludes neighbours already on the canvas', () => {
    const all = neighborLinks('2.47');
    const onCanvas = new Set([all[0].id]);
    const left = expandableNeighbors('2.47', onCanvas);
    expect(left.map((l) => l.id)).not.toContain(all[0].id);
    expect(left.length).toBe(all.length - 1);
  });

  it('is empty once everything is on the canvas', () => {
    const onCanvas = new Set(neighborLinks('2.47').map((l) => l.id));
    expect(expandableNeighbors('2.47', onCanvas)).toEqual([]);
  });
});

describe('edgesJoining', () => {
  it('draws the authored edge between two authored neighbours', () => {
    const [first] = neighborLinks('2.47');
    const edges = edgesJoining(['2.47'], new Set([first.id]));
    expect(edges).toHaveLength(1);
    expect([edges[0].from, edges[0].to].sort()).toEqual(['2.47', first.id].sort());
  });

  it('draws nothing when the canvas is empty', () => {
    expect(edgesJoining(['2.47'], new Set())).toEqual([]);
  });

  it('draws suggested edges for a generated verse next to its suggestion', () => {
    const generated = verses.find((v) => v.curated && !hasAuthored(v.id))!;
    const [first] = neighborLinks(generated.id);
    const edges = edgesJoining([generated.id], new Set([first.id]));
    expect(edges.length).toBeGreaterThanOrEqual(1);
  });

  it('never returns the same pair twice', () => {
    const ids = verses.filter((v) => v.curated).slice(0, 40).map((v) => v.id);
    const edges = edgesJoining(ids.slice(0, 20), new Set(ids.slice(20)));
    const keys = edges.map((e) => [e.from, e.to].sort().join('|'));
    expect(new Set(keys).size).toBe(keys.length);
  });
});
