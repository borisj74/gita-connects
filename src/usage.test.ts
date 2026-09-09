import { describe, it, expect, beforeEach } from 'vitest';
import { collectUsage } from './usage.js';
import { saveNote, NOTES_KEY, _reloadNotesForTests } from './notes.js';

const node = (id: string) => ({ id, position: { x: 0, y: 0 }, data: {} });
const edge = (source: string, target: string) => ({ id: `${source}-${target}`, source, target });

describe('collectUsage', () => {
  beforeEach(() => {
    localStorage.clear();
    _reloadNotesForTests();
  });

  it('returns nothing when the device has no data', () => {
    expect(collectUsage()).toEqual({});
  });

  it('weights verses by networks, links, autosave and notes', () => {
    localStorage.setItem(
      'gita-connects-saved-networks',
      JSON.stringify([
        { id: 'a', name: 'A', timestamp: 1, nodes: [node('2.47'), node('3.19')], edges: [edge('2.47', '3.19')] },
        { id: 'b', name: 'B', timestamp: 2, nodes: [node('2.47')], edges: [] },
      ]),
    );
    localStorage.setItem(
      'gita-connects-autosave',
      JSON.stringify({ savedAt: Date.now(), nodes: [node('18.66')], edges: [] }),
    );
    saveNote('9.22', 'a note');
    expect(collectUsage()).toEqual({ '2.47': 3, '9.22': 3, '3.19': 2, '18.66': 1 });
  });

  it('ignores a corrupt networks entry', () => {
    localStorage.setItem('gita-connects-saved-networks', '{not json');
    localStorage.removeItem(NOTES_KEY);
    expect(collectUsage()).toEqual({});
  });
});
