/**
 * "Export usage data": how much attention each verse has had on this device.
 *
 * Feeds the review queue (scripts/review-next.ts --demand file.json) so the
 * verses a reader actually works with get reviewed first. Counts only: no
 * note text, no network names, nothing from Vedabase.
 *
 *   saved network containing the verse   +1 each
 *   link touching the verse               +1 each (saved networks + autosave)
 *   current canvas (autosave)             +1
 *   a personal note                       +3
 */
import type { Node, Edge } from 'reactflow';
import { readAutosave } from './autosave.js';
import { getNotes } from './notes.js';

const SAVED_KEY = 'gita-connects-saved-networks';

export type UsageWeights = Record<string, number>;

interface SavedNetworkLike {
  nodes?: Node[];
  edges?: Edge[];
}

function readSavedNetworks(): SavedNetworkLike[] {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as SavedNetworkLike[]) : [];
  } catch {
    return [];
  }
}

const bump = (w: UsageWeights, id: string, by: number) => {
  w[id] = (w[id] ?? 0) + by;
};

function countNetwork(w: UsageWeights, nodes: Node[] = [], edges: Edge[] = []) {
  nodes.forEach((n) => bump(w, n.id, 1));
  edges.forEach((e) => {
    bump(w, e.source, 1);
    bump(w, e.target, 1);
  });
}

/** Verse id → weight, sorted by weight for readable JSON. */
export function collectUsage(): UsageWeights {
  const w: UsageWeights = {};
  readSavedNetworks().forEach((n) => countNetwork(w, n.nodes, n.edges));
  const auto = readAutosave();
  if (auto) countNetwork(w, auto.nodes, auto.edges);
  Object.keys(getNotes()).forEach((id) => bump(w, id, 3));
  return Object.fromEntries(Object.entries(w).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

/** Trigger a JSON download in the browser. */
export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
