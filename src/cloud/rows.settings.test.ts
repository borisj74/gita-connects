import { describe, it, expect } from 'vitest';
import { typeToRow, rowToType, prefsToRow, rowToPrefs } from './rows.js';

const type = { typeId: 'custom-mentorship-1', label: 'Mentorship', color: '#5e9b8e', directional: true, updatedAt: 1_700_000_000_000 };
const prefs = {
  theme: 'dark' as const,
  hiddenFilters: ['thematic', 'goal'],
  detailSections: { sanskrit: true, commentary: false },
  updatedAt: 1_700_000_000_000,
};

describe('link type rows', () => {
  it('round-trips a custom type through the database shape', () => {
    expect(rowToType(typeToRow(type, 'u1'))).toEqual(type);
  });

  it('carries the type id, not a generated one, so a re-sync updates in place', () => {
    expect(typeToRow(type, 'u1').type_id).toBe('custom-mentorship-1');
  });
});

describe('preference rows', () => {
  it('round-trips preferences through the database shape', () => {
    expect(rowToPrefs(prefsToRow(prefs, 'u1'))).toEqual(prefs);
  });

  it('falls back to light for an unrecognised theme', () => {
    const row = { ...prefsToRow(prefs, 'u1'), theme: 'sepia' };
    expect(rowToPrefs(row).theme).toBe('light');
  });

  it('survives json columns that came back null', () => {
    const row = { ...prefsToRow(prefs, 'u1'), hidden_filters: null, detail_sections: null };
    expect(rowToPrefs(row)).toMatchObject({ hiddenFilters: [], detailSections: {} });
  });
});
