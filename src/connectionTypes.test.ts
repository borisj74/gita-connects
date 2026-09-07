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
  it('round-trips a filter set', () => {
    saveActiveFilters(new Set(['thematic', 'devotional']));
    expect(loadActiveFilters([])).toEqual(new Set(['thematic', 'devotional']));
  });

  it('falls back to the supplied defaults when nothing is stored', () => {
    expect(loadActiveFilters(['thematic'])).toEqual(new Set(['thematic']));
  });

  it('falls back to the defaults on malformed JSON', () => {
    localStorage.setItem(FILTERS_KEY, 'nope');
    expect(loadActiveFilters(['conceptual'])).toEqual(new Set(['conceptual']));
  });

  it('distinguishes an empty stored set from an absent one', () => {
    saveActiveFilters(new Set());
    expect(loadActiveFilters(['thematic'])).toEqual(new Set());
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
