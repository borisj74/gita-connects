import { connections } from './data/index.js';
import { suggestSimilar, suggestionConnection } from './suggestions.js';
import type { Connection } from './types.js';

export interface NeighborLink {
  id: string;
  connection: Connection;
  /** True when the link is an authored connection rather than a suggestion. */
  authored: boolean;
}

const SUGGESTED_LIMIT = 5;

/**
 * The verses a verse can expand to on the canvas, each with the connection
 * that would join them.
 *
 * Authored connections come first and, when any exist, they are all you get:
 * they are reviewed scholarship and should not be diluted. Only a verse with
 * no authored links falls back to its top suggestions, built the same way as
 * accepting a suggestion from the detail panel. That is what lets "Show N
 * connected verses" work for the 664 generated verses and not just the 37.
 */
export function neighborLinks(verseId: string): NeighborLink[] {
  // One entry per neighbour. The dataset holds reciprocal pairs (A->B and
  // B->A under different types), and the canvas draws one edge per pair, so
  // keep the strongest connection and drop the rest — otherwise the expand
  // count says 9 where the canvas will only ever add 7.
  const strongest = new Map<string, Connection>();
  for (const c of connections) {
    if (c.from !== verseId && c.to !== verseId) continue;
    const id = c.from === verseId ? c.to : c.from;
    const current = strongest.get(id);
    if (!current || c.strength > current.strength) strongest.set(id, c);
  }
  const authored = [...strongest].map(([id, connection]) => ({ id, connection, authored: true }));

  if (authored.length > 0) return authored;

  return suggestSimilar(verseId, SUGGESTED_LIMIT).map(({ verse, shared, sameTheme }) => ({
    id: verse.id,
    authored: false,
    connection: {
      from: verseId,
      to: verse.id,
      ...suggestionConnection(shared.length ? shared : sameTheme ? ['theme'] : []),
    },
  }));
}

/** Neighbours not already on the canvas — what the expand button counts. */
export function expandableNeighbors(verseId: string, onCanvas: ReadonlySet<string>): NeighborLink[] {
  return neighborLinks(verseId).filter((n) => !onCanvas.has(n.id));
}

/**
 * Connections to draw when `newIds` join a canvas already holding `onCanvas`.
 * Looks from both sides — a suggestion is directional, so B may list A even
 * when A does not list B — and returns one connection per unordered pair.
 */
export function edgesJoining(newIds: readonly string[], onCanvas: ReadonlySet<string>): Connection[] {
  const seen = new Set<string>();
  const out: Connection[] = [];
  const add = (c: Connection) => {
    const key = [c.from, c.to].sort().join('|');
    if (seen.has(key)) return;
    seen.add(key);
    out.push(c);
  };
  const added = new Set(newIds);
  const members = new Set([...onCanvas, ...newIds]);

  for (const id of newIds) {
    for (const link of neighborLinks(id)) {
      if (members.has(link.id)) add(link.connection);
    }
  }
  // Reverse direction: existing verses whose links point at a newcomer.
  for (const id of onCanvas) {
    if (added.has(id)) continue;
    for (const link of neighborLinks(id)) {
      if (added.has(link.id)) add(link.connection);
    }
  }
  return out;
}
