export interface ConnectionTypeDef {
  id: string;
  label: string;
  color: string;
  description?: string;
  isCustom?: boolean;
}

export const PREDEFINED_CONNECTION_TYPES: ConnectionTypeDef[] = [
  { id: 'thematic', label: 'Thematic', color: '#ca7558', description: 'Shared overarching theme' },
  { id: 'conceptual', label: 'Conceptual', color: '#7d8a6e', description: 'Shared concept or idea' },
  { id: 'practical', label: 'Practical', color: '#8d7a66', description: 'Practical or applied relationship' },
  { id: 'devotional', label: 'Devotional', color: '#c8a04a', description: 'Devotion, surrender, grace' },
  { id: 'philosophical', label: 'Philosophical', color: '#5a7a96', description: 'Metaphysical or doctrinal link' },
  { id: 'narrative', label: 'Narrative', color: '#9b6a8b', description: 'Story / dialogue continuation' },
  { id: 'metaphorical', label: 'Metaphorical', color: '#5e9b8e', description: 'Shared imagery or metaphor' },
];

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
    return new Set(parsed);
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

export function getTypeColor(types: ConnectionTypeDef[], id: string): string {
  return types.find((t) => t.id === id)?.color ?? '#999999';
}

export function getTypeLabel(types: ConnectionTypeDef[], id: string): string {
  return types.find((t) => t.id === id)?.label ?? id;
}
