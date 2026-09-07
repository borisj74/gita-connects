import { describe, it, expect, vi } from 'vitest';
import {
  PREDEFINED_CONNECTION_TYPES,
  loadCustomConnectionTypes,
  saveCustomConnectionTypes,
  loadActiveFilters,
  saveActiveFilters,
  makeCustomTypeId,
  getTypeColor,
  getTypeLabel,
  isDirectionalType,
  normalizeTypeId,
  LEGACY_TYPE_MAP,
  type ConnectionTypeDef,
} from './connectionTypes.js';

const CUSTOM_KEY = 'gita-connects-custom-connection-types';
const FILTERS_KEY = 'gita-connects-active-filters';

const custom = (over: Partial<ConnectionTypeDef> = {}): ConnectionTypeDef => ({
  id: 'custom-x',
  label: 'Custom X',
  color: '#123456',
  isCustom: true,
  ...over,
});

describe('relation model', () => {
  it('has the model\'s five types first, then the five added ones', () => {
    expect(PREDEFINED_CONNECTION_TYPES.map((t) => t.id)).toEqual([
      'sequential', 'thematic', 'progression', 'contrast', 'goal',
      'dependency', 'question-answer', 'definition', 'illustration', 'parallel',
    ]);
  });

  it('marks exactly the types with a natural direction as directional', () => {
    const T = PREDEFINED_CONNECTION_TYPES;
    const directional = T.filter((t) => isDirectionalType(T, t.id)).map((t) => t.id);
    expect(directional).toEqual([
      'sequential', 'progression', 'goal',
      'dependency', 'question-answer', 'definition', 'illustration',
    ]);
    expect(isDirectionalType(T, 'nope')).toBe(false);
  });

  it('gives every type a distinct color', () => {
    const colors = PREDEFINED_CONNECTION_TYPES.map((t) => t.color.toLowerCase());
    expect(new Set(colors).size).toBe(colors.length);
  });

  it('maps every legacy id onto a current type', () => {
    const ids = new Set(PREDEFINED_CONNECTION_TYPES.map((t) => t.id));
    for (const [legacy, current] of Object.entries(LEGACY_TYPE_MAP)) {
      expect(ids, legacy).toContain(current);
      expect(ids, legacy).not.toContain(legacy);
    }
  });

  it('normalizes legacy ids and passes current and custom ids through', () => {
    expect(normalizeTypeId('conceptual')).toBe('thematic');
    expect(normalizeTypeId('practical')).toBe('progression');
    expect(normalizeTypeId('thematic')).toBe('thematic');
    expect(normalizeTypeId('custom-x-1')).toBe('custom-x-1');
  });

  it('resolves color and label for a legacy id', () => {
    expect(getTypeColor(PREDEFINED_CONNECTION_TYPES, 'devotional')).toBe('#c8a04a');
    expect(getTypeLabel(PREDEFINED_CONNECTION_TYPES, 'narrative')).toBe('Sequential');
  });
});

describe('PREDEFINED_CONNECTION_TYPES', () => {
  it('has unique ids', () => {
    const ids = PREDEFINED_CONNECTION_TYPES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every type a valid hex color', () => {
    for (const type of PREDEFINED_CONNECTION_TYPES) {
      expect(type.color).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('marks none of them as custom', () => {
    expect(PREDEFINED_CONNECTION_TYPES.every((t) => !t.isCustom)).toBe(true);
  });
});

describe('custom connection type persistence', () => {
  it('round-trips custom types through localStorage', () => {
    saveCustomConnectionTypes([custom({ id: 'custom-a', label: 'A' })]);
    expect(loadCustomConnectionTypes()).toEqual([
      { id: 'custom-a', label: 'A', color: '#123456', isCustom: true },
    ]);
  });

  it('persists only custom types, never predefined ones', () => {
    saveCustomConnectionTypes([...PREDEFINED_CONNECTION_TYPES, custom()]);
    const stored = JSON.parse(localStorage.getItem(CUSTOM_KEY)!) as ConnectionTypeDef[];
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe('custom-x');
  });

  it('returns an empty list when nothing is stored', () => {
    expect(loadCustomConnectionTypes()).toEqual([]);
  });

  it('returns an empty list on malformed JSON instead of throwing', () => {
    localStorage.setItem(CUSTOM_KEY, '{not json');
    expect(loadCustomConnectionTypes()).toEqual([]);
  });

  it('returns an empty list when the stored value is not an array', () => {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify({ id: 'a' }));
    expect(loadCustomConnectionTypes()).toEqual([]);
  });

  it('drops entries missing an id or label', () => {
    localStorage.setItem(
      CUSTOM_KEY,
      JSON.stringify([{ id: 'ok', label: 'Ok', color: '#fff' }, { id: 'no-label' }, null]),
    );
    expect(loadCustomConnectionTypes().map((t) => t.id)).toEqual(['ok']);
  });

  it('replaces a non-hex color with the grey fallback', () => {
    localStorage.setItem(
      CUSTOM_KEY,
      JSON.stringify([{ id: 'a', label: 'A', color: 'javascript:alert(1)' }]),
    );
    expect(loadCustomConnectionTypes()[0].color).toBe('#999999');
  });

  it('forces isCustom true on loaded entries', () => {
    localStorage.setItem(
      CUSTOM_KEY,
      JSON.stringify([{ id: 'a', label: 'A', color: '#abc', isCustom: false }]),
    );
    expect(loadCustomConnectionTypes()[0].isCustom).toBe(true);
  });
});

describe('active filter persistence', () => {
  const KNOWN = ['sequential', 'thematic', 'progression', 'contrast', 'goal', 'dependency', 'parallel'];
  const HIDDEN_KEY = 'gita-connects-hidden-filters';

  it('shows everything when nothing is stored', () => {
    expect(loadActiveFilters(KNOWN)).toEqual(new Set(KNOWN));
  });

  it('round-trips by persisting what was hidden', () => {
    saveActiveFilters(new Set(['thematic', 'goal']), KNOWN);
    expect(JSON.parse(localStorage.getItem(HIDDEN_KEY)!)).toEqual(
      ['sequential', 'progression', 'contrast', 'dependency', 'parallel'],
    );
    expect(loadActiveFilters(KNOWN)).toEqual(new Set(['thematic', 'goal']));
  });

  it('shows a type added after the preference was saved', () => {
    saveActiveFilters(new Set(['thematic']), ['thematic', 'goal']);
    expect(loadActiveFilters([...KNOWN, 'brand-new'])).toContain('brand-new');
    expect(loadActiveFilters([...KNOWN, 'brand-new'])).not.toContain('goal');
  });

  it('keeps a custom type visible unless it was hidden', () => {
    saveActiveFilters(new Set(['thematic', 'custom-a-1']), ['thematic', 'custom-a-1', 'custom-b-2']);
    const loaded = loadActiveFilters(['thematic', 'custom-a-1', 'custom-b-2']);
    expect(loaded).toContain('custom-a-1');
    expect(loaded).not.toContain('custom-b-2');
  });

  it('migrates a legacy active list once, defaulting newer types on', () => {
    localStorage.setItem(FILTERS_KEY, JSON.stringify(['conceptual', 'narrative']));
    const loaded = loadActiveFilters(KNOWN);
    expect(loaded).toContain('thematic');    // conceptual -> thematic
    expect(loaded).toContain('sequential');  // narrative -> sequential
    expect(loaded).not.toContain('goal');    // legacy could name it and did not
    expect(loaded).toContain('dependency');  // newer than the legacy format
    expect(loaded).toContain('parallel');
  });

  it('removes the legacy key on the next save', () => {
    localStorage.setItem(FILTERS_KEY, JSON.stringify(['thematic']));
    saveActiveFilters(new Set(['thematic']), KNOWN);
    expect(localStorage.getItem(FILTERS_KEY)).toBeNull();
    expect(localStorage.getItem(HIDDEN_KEY)).not.toBeNull();
  });

  it('shows everything on malformed JSON', () => {
    localStorage.setItem(HIDDEN_KEY, 'nope');
    expect(loadActiveFilters(KNOWN)).toEqual(new Set(KNOWN));
  });

  it('does not let a legacy set that hides everything win', () => {
    localStorage.setItem(FILTERS_KEY, JSON.stringify([]));
    expect(loadActiveFilters(KNOWN)).toEqual(new Set(KNOWN));
  });
});

describe('makeCustomTypeId', () => {
  it('slugifies the label', () => {
    expect(makeCustomTypeId('My New Type')).toMatch(/^custom-my-new-type-[a-z0-9]+$/);
  });

  it('collapses punctuation and trims stray dashes', () => {
    expect(makeCustomTypeId('  Ethics & Duty!  ')).toMatch(/^custom-ethics-duty-[a-z0-9]+$/);
  });

  it('falls back to "type" when the label has no alphanumerics', () => {
    expect(makeCustomTypeId('!!!')).toMatch(/^custom-type-[a-z0-9]+$/);
  });

  it('produces different ids for the same label at different times', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const first = makeCustomTypeId('Duty');
    vi.setSystemTime(new Date('2026-01-01T00:01:00Z'));
    const second = makeCustomTypeId('Duty');
    vi.useRealTimers();
    expect(first).not.toBe(second);
  });
});

describe('getTypeColor / getTypeLabel', () => {
  it('finds a known type', () => {
    expect(getTypeColor(PREDEFINED_CONNECTION_TYPES, 'thematic')).toBe('#ca7558');
    expect(getTypeLabel(PREDEFINED_CONNECTION_TYPES, 'thematic')).toBe('Thematic');
  });

  it('falls back to grey for an unknown color', () => {
    expect(getTypeColor(PREDEFINED_CONNECTION_TYPES, 'nope')).toBe('#999999');
  });

  it('falls back to the raw id for an unknown label', () => {
    expect(getTypeLabel(PREDEFINED_CONNECTION_TYPES, 'nope')).toBe('nope');
  });
});
