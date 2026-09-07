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
 * The five relation types from the project's verse-relationship model.
 * Three are directional: the connection's `from` is the earlier, more basic,
 * or material verse and `to` is the later, developed, or resolving one.
 */
export const PREDEFINED_CONNECTION_TYPES: ConnectionTypeDef[] = [
  { id: 'sequential', label: 'Sequential', color: '#9b6a8b', description: 'The next verse supports or expands the previous one', directional: true },
  { id: 'thematic', label: 'Thematic', color: '#ca7558', description: 'Both verses share a concept — soul, action, devotion, renunciation' },
  { id: 'progression', label: 'Progression', color: '#5a7a96', description: 'A concept introduced here is developed more fully there', directional: true },
  { id: 'contrast', label: 'Contrast', color: '#b5533c', description: 'One verse presents the material condition, the other its transcendence' },
  { id: 'goal', label: 'Goal', color: '#c8a04a', description: 'Both point toward the same ultimate aim, especially surrender to Kṛṣṇa', directional: true },
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

const ACTIVE_FILTERS_STORAGE_KEY = 'gita-connects-active-filters';

export function loadActiveFilters(fallback: string[]): Set<string> {
  try {
    const raw = localStorage.getItem(ACTIVE_FILTERS_STORAGE_KEY);
    if (!raw) return new Set(fallback);
    const parsed = JSON.parse(raw) as string[];
    if (!Array.isArray(parsed)) return new Set(fallback);
    // Old ids map forward; anything unknown is dropped. A stored set that
    // maps to nothing would hide every connection, so fall back instead.
    const known = new Set(fallback);
    const mapped = parsed.map(normalizeTypeId).filter((id) => known.has(id) || id.startsWith('custom-'));
    return mapped.length > 0 ? new Set(mapped) : new Set(fallback);
  } catch {
    return new Set(fallback);
  }
}

export function saveActiveFilters(filters: Set<string>): void {
  localStorage.setItem(ACTIVE_FILTERS_STORAGE_KEY, JSON.stringify([...filters]));
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
