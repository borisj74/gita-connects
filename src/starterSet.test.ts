import { describe, it, expect } from 'vitest';
import { pickStarterSet, STARTER_NEIGHBORS } from './starterSet.js';
import { connections } from './data/index.js';

const linked = (a: string, b: string) =>
  connections.some((c) => (c.from === a && c.to === b) || (c.from === b && c.to === a));

describe('pickStarterSet', () => {
  it('returns a hub and its linked verses, all different', () => {
    const set = pickStarterSet(connections);
    expect(set).toHaveLength(1 + STARTER_NEIGHBORS);
    expect(new Set(set).size).toBe(set.length);
    const [hub, ...rest] = set;
    for (const id of rest) expect(linked(hub, id)).toBe(true);
  });

  it('picks a different set as the random draw changes', () => {
    const sets = new Set([0, 0.25, 0.5, 0.75, 0.99].map((r) => pickStarterSet(connections, () => r).join()));
    expect(sets.size).toBeGreaterThan(1);
  });

  it('falls back to the best-connected verse when no hub has enough links', () => {
    const small = [
      { from: '1.1', to: '1.2' },
      { from: '1.1', to: '1.3' },
      { from: '1.4', to: '1.5' },
    ];
    const [hub, ...rest] = pickStarterSet(small, () => 0.9);
    expect(hub).toBe('1.1');
    expect(rest.sort()).toEqual(['1.2', '1.3']);
    expect(pickStarterSet([])).toEqual([]);
  });
});
