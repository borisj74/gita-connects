export interface ConnectionTypeDef {
  id: string;
  label: string;
  color: string;
  description?: string;
  isCustom?: boolean;
  /**
   * True when `from -> to` carries meaning (A develops into B, A leads to
   * the goal B). Undirected types describe a quality the pair shares.
   */
  directional?: boolean;
}

/**
 * Relation types. The first five are the project's verse-relationship model;
 * the rest were added for links the model's rules describe but did not name
 * (dependency, from its link-rule system) or that the Gītā's dialogue form
 * makes common (question–answer). For directional types the connection's
 * `from` is the earlier, more basic, asking, defining or illustrating verse,
 * and `to` the later, developed, answering, using or illustrated one.
 */
export const PREDEFINED_CONNECTION_TYPES: ConnectionTypeDef[] = [
  { id: 'sequential', label: 'Sequential', color: '#9b6a8b', description: 'The next verse supports or expands the previous one', directional: true },
  { id: 'thematic', label: 'Thematic', color: '#ca7558', description: 'Both verses share a concept — soul, action, devotion, renunciation' },
  { id: 'progression', label: 'Progression', color: '#5a7a96', description: 'A concept introduced here is developed more fully there', directional: true },
  { id: 'contrast', label: 'Contrast', color: '#b5533c', description: 'One verse presents the material condition, the other its transcendence' },
  { id: 'goal', label: 'Goal', color: '#c8a04a', description: 'Both point toward the same ultimate aim, especially surrender to Kṛṣṇa', directional: true },
  { id: 'dependency', label: 'Dependency', color: '#7d8a6e', description: 'This verse rests on a premise that verse explains', directional: true },
  { id: 'question-answer', label: 'Question–answer', color: '#5e9b8e', description: 'Arjuna asks here; Kṛṣṇa answers there', directional: true },
  { id: 'definition', label: 'Definition', color: '#8d7a66', description: 'This verse defines a term that verse relies on', directional: true },
  { id: 'illustration', label: 'Illustration', color: '#b08bc0', description: 'This verse gives an example or metaphor for that principle', directional: true },
  { id: 'parallel', label: 'Parallel', color: '#c9a3a3', description: 'The same teaching restated in another chapter' },
];

/**
 * Ids from the first taxonomy, still present in saved networks and saved
 * filters in readers' localStorage. Mapped, never rejected, so an old saved
 * network loads with the closest current type rather than grey edges.
 */
export const LEGACY_TYPE_MAP: Record<string, string> = {
  conceptual: 'thematic',
  metaphorical: 'thematic',
  practical: 'progression',
  philosophical: 'progression',
  narrative: 'sequential',
  devotional: 'goal',
};

export const normalizeTypeId = (id: string): string => LEGACY_TYPE_MAP[id] ?? id;

const CUSTOM_TYPES_STORAGE_KEY = 'gita-connects-custom-connection-types';

const HEX_COLOR = /^#[0-9a-f]{3,8}$/i;

export function loadCustomConnectionTypes(): ConnectionTypeDef[] {
  try {
    const raw = localStorage.getItem(CUSTOM_TYPES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ConnectionTypeDef[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((t) => t && typeof t.id === 'string' && typeof t.label === 'string')
      .map((t) => ({
        ...t,
        color: HEX_COLOR.test(t.color) ? t.color : '#999999',
        isCustom: true,
      }));
  } catch {
    return [];
  }
}

export function saveCustomConnectionTypes(types: ConnectionTypeDef[]): void {
  const customOnly = types.filter((t) => t.isCustom);
  localStorage.setItem(CUSTOM_TYPES_STORAGE_KEY, JSON.stringify(customOnly));
}

const LEGACY_ACTIVE_FILTERS_KEY = 'gita-connects-active-filters';
const HIDDEN_FILTERS_STORAGE_KEY = 'gita-connects-hidden-filters';

// The five ids the legacy active-list format could have named, after
// LEGACY_TYPE_MAP. Used once, to migrate that format.
const LEGACY_KNOWN_IDS = ['sequential', 'thematic', 'progression', 'contrast', 'goal'];

/**
 * Which connection types are visible. `known` is every type id that exists
 * right now — predefined plus the reader's custom ones.
 *
 * Persistence stores the HIDDEN set, not the active one. A type the reader
 * never touched is visible, which is what makes a newly added predefined
 * type appear for returning readers instead of arriving switched off.
 */
export function loadActiveFilters(known: string[]): Set<string> {
  const all = new Set(known);
  try {
    const raw = localStorage.getItem(HIDDEN_FILTERS_STORAGE_KEY);
    if (raw) {
      const hidden = JSON.parse(raw) as unknown;
      if (!Array.isArray(hidden)) return all;
      const hide = new Set(hidden.map((id) => normalizeTypeId(String(id))));
      return new Set(known.filter((id) => !hide.has(id)));
    }

    // One-time migration of the old format, which listed ACTIVE ids. Only
    // ids that format could have known are eligible to be hidden by it;
    // anything newer defaults on.
    const legacy = localStorage.getItem(LEGACY_ACTIVE_FILTERS_KEY);
    if (!legacy) return all;
    const active = JSON.parse(legacy) as unknown;
    if (!Array.isArray(active)) return all;
    const wasActive = new Set(active.map((id) => normalizeTypeId(String(id))));
    const eligible = new Set([...LEGACY_KNOWN_IDS, ...known.filter((id) => id.startsWith('custom-'))]);
    // A legacy set that hid every type it could name was never a real
    // preference (the app has no "hide all" control) — show everything.
    if (![...eligible].some((id) => wasActive.has(id))) return all;
    return new Set(known.filter((id) => !eligible.has(id) || wasActive.has(id)));
  } catch {
    return all;
  }
}

export function saveActiveFilters(active: Set<string>, known: string[]): void {
  const hidden = known.filter((id) => !active.has(id));
  localStorage.setItem(HIDDEN_FILTERS_STORAGE_KEY, JSON.stringify(hidden));
  localStorage.removeItem(LEGACY_ACTIVE_FILTERS_KEY);
}

export function makeCustomTypeId(label: string): string {
  const slug = label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `custom-${slug || 'type'}-${Date.now().toString(36)}`;
}

export function getTypeDef(types: ConnectionTypeDef[], id: string): ConnectionTypeDef | undefined {
  const wanted = normalizeTypeId(id);
  return types.find((t) => t.id === wanted);
}

export function getTypeColor(types: ConnectionTypeDef[], id: string): string {
  return getTypeDef(types, id)?.color ?? '#999999';
}

export function getTypeLabel(types: ConnectionTypeDef[], id: string): string {
  return getTypeDef(types, id)?.label ?? id;
}

export function isDirectionalType(types: ConnectionTypeDef[], id: string): boolean {
  return getTypeDef(types, id)?.directional === true;
}
