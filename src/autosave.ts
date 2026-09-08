import type { Node, Edge } from 'reactflow';

/**
 * Autosave: the canvas is written to localStorage shortly after every change
 * so a refresh never loses work. Named saves (SaveLoadControls) are separate,
 * deliberate snapshots; this is the safety net underneath them.
 */
export const AUTOSAVE_KEY = 'gita-connects-autosave';
export const AUTOSAVE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export interface Autosave {
  savedAt: number;
  nodes: Node[];
  edges: Edge[];
}

/** Strip the parts that don't survive JSON or are rebuilt on load. */
function slimNode(node: Node): Node {
  const { verse: _verse, onSelect: _s, onRemove: _r, onExpand: _e, ...data } = (node.data ?? {}) as Record<string, unknown>;
  return { id: node.id, type: node.type, position: node.position, width: node.width, height: node.height, data } as Node;
}

export function writeAutosave(nodes: Node[], edges: Edge[]): void {
  try {
    if (nodes.length === 0) {
      localStorage.removeItem(AUTOSAVE_KEY);
      return;
    }
    const payload: Autosave = { savedAt: Date.now(), nodes: nodes.map(slimNode), edges };
    // JSON.stringify drops the function props on edge data (onDelete etc).
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(payload));
  } catch {
    // Storage full or unavailable — autosave is best-effort.
  }
}

/** The pending autosave, or null if none, empty, malformed, or expired. */
export function readAutosave(): Autosave | null {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Autosave>;
    if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges) || typeof parsed.savedAt !== 'number') {
      localStorage.removeItem(AUTOSAVE_KEY);
      return null;
    }
    if (parsed.nodes.length === 0 || Date.now() - parsed.savedAt > AUTOSAVE_MAX_AGE_MS) {
      localStorage.removeItem(AUTOSAVE_KEY);
      return null;
    }
    return parsed as Autosave;
  } catch {
    return null;
  }
}

export function clearAutosave(): void {
  try {
    localStorage.removeItem(AUTOSAVE_KEY);
  } catch {
    // ignore
  }
}

export function autosavedAgo(savedAt: number): string {
  const min = Math.round((Date.now() - savedAt) / 60_000);
  if (min < 1) return 'Autosaved just now';
  if (min < 60) return `Autosaved ${min} minute${min === 1 ? '' : 's'} ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `Autosaved ${hr} hour${hr === 1 ? '' : 's'} ago`;
  const day = Math.round(hr / 24);
  return `Autosaved ${day} day${day === 1 ? '' : 's'} ago`;
}
