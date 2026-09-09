import { describe, it, expect } from 'vitest';
import { mergeNewest, changesSince } from './merge.js';

const item = (id: string, updatedAt: number, body = '') => ({ id, updatedAt, body });
const idOf = (i: { id: string }) => i.id;
const same = (a: { body: string; updatedAt: number }, b: { body: string; updatedAt: number }) =>
  a.body === b.body && a.updatedAt === b.updatedAt;

describe('mergeNewest', () => {
  it('keeps the newer copy of anything held on both sides', () => {
    const merged = mergeNewest(
      [item('a', 200, 'local'), item('b', 100, 'local-only')],
      [item('a', 300, 'remote'), item('c', 100, 'remote-only')],
      idOf,
    );
    expect(merged.find((i) => i.id === 'a')?.body).toBe('remote');
    expect(merged.map((i) => i.id).sort()).toEqual(['a', 'b', 'c']);
  });

  it('never drops a record that only one side has', () => {
    expect(mergeNewest([item('a', 1)], [], idOf)).toHaveLength(1);
    expect(mergeNewest([], [item('b', 1)], idOf)).toHaveLength(1);
  });

  it('prefers local when the two copies claim the same instant', () => {
    const merged = mergeNewest([item('a', 5, 'local')], [item('a', 5, 'remote')], idOf);
    expect(merged[0].body).toBe('local');
  });
});

describe('changesSince', () => {
  it('reports additions, edits and removals against the snapshot', () => {
    const before = [item('a', 1, 'one'), item('b', 1, 'two'), item('c', 1, 'three')];
    const after = [item('a', 1, 'one'), item('b', 2, 'edited'), item('d', 1, 'new')];
    const { upserts, deletes } = changesSince(before, after, idOf, same);
    expect(upserts.map(idOf).sort()).toEqual(['b', 'd']);
    expect(deletes).toEqual(['c']);
  });

  it('reports nothing when the list is untouched', () => {
    const list = [item('a', 1, 'one')];
    expect(changesSince(list, list, idOf, same)).toEqual({ upserts: [], deletes: [] });
  });

  it('treats an empty snapshot as everything being new', () => {
    const { upserts, deletes } = changesSince([], [item('a', 1)], idOf, same);
    expect(upserts).toHaveLength(1);
    expect(deletes).toEqual([]);
  });
});
