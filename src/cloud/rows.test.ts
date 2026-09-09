import { describe, it, expect } from 'vitest';
import {
  networkToRow, rowToNetwork, noteToRow, rowsToNotes, notesToEntries, entriesToNotes,
} from './rows.js';
import type { Node, Edge } from 'reactflow';

const nodes = [{ id: '2.47', position: { x: 0, y: 0 }, data: {} }] as unknown as Node[];
const edges = [{ id: 'e', source: '2.47', target: '3.19' }] as unknown as Edge[];
const network = { id: 'n1', name: 'Karma', timestamp: 1_700_000_000_000, nodes, edges, selectedVerseId: '2.47' };

describe('network rows', () => {
  it('round-trips a saved network through the database shape', () => {
    expect(rowToNetwork(networkToRow(network, 'u1'))).toEqual(network);
  });

  it('carries the local timestamp as the row timestamp, not the moment of upload', () => {
    expect(networkToRow(network, 'u1').updated_at).toBe(new Date(1_700_000_000_000).toISOString());
  });

  it('stores an unselected network as null rather than undefined', () => {
    expect(networkToRow({ ...network, selectedVerseId: null }, 'u1').selected_verse_id).toBeNull();
  });

  it('reads back a Postgres timestamp, which is offset-formatted rather than Z-suffixed', () => {
    const row = { ...networkToRow(network, 'u1'), updated_at: '2023-11-14T22:13:20+00:00' };
    expect(rowToNetwork(row).timestamp).toBe(1_700_000_000_000);
  });

  it('survives a row whose json columns came back empty', () => {
    const row = { ...networkToRow(network, 'u1'), nodes: null, edges: null };
    expect(rowToNetwork(row)).toMatchObject({ nodes: [], edges: [] });
  });
});

describe('note rows', () => {
  it('round-trips notes through the database shape', () => {
    const notes = { '2.47': { text: 'mine', updatedAt: 1_700_000_000_000 } };
    const rows = notesToEntries(notes).map((e) => noteToRow(e.verseId, { text: e.text, updatedAt: e.updatedAt }, 'u1'));
    expect(rowsToNotes(rows)).toEqual(notes);
  });

  it('round-trips notes through the list shape the merger needs', () => {
    const notes = { '2.47': { text: 'a', updatedAt: 1 }, '18.66': { text: 'b', updatedAt: 2 } };
    expect(entriesToNotes(notesToEntries(notes))).toEqual(notes);
  });
});
