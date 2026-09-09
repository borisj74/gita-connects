import { describe, it, expect, beforeEach } from 'vitest';
import { saveNote, deleteNote, getNote, getNotes, editedLabel, NOTES_KEY, _reloadNotesForTests } from './notes.js';

describe('notes store', () => {
  beforeEach(() => {
    localStorage.removeItem(NOTES_KEY);
    _reloadNotesForTests();
  });

  it('saves a trimmed note with a timestamp and persists it', () => {
    saveNote('2.47', '  The right is to the action.  ', 1000);
    expect(getNote('2.47')).toEqual({ text: 'The right is to the action.', updatedAt: 1000 });
    expect(JSON.parse(localStorage.getItem(NOTES_KEY) ?? '{}')['2.47'].text).toBe('The right is to the action.');
  });

  it('treats an empty save as a delete and clears storage when nothing is left', () => {
    saveNote('2.47', 'something');
    saveNote('2.47', '   ');
    expect(getNote('2.47')).toBeUndefined();
    expect(localStorage.getItem(NOTES_KEY)).toBeNull();
  });

  it('drops malformed entries when loading', () => {
    localStorage.setItem(
      NOTES_KEY,
      JSON.stringify({ '2.47': { text: 'ok', updatedAt: 5 }, '3.1': { text: '', updatedAt: 5 }, '4.7': 'nope' }),
    );
    _reloadNotesForTests();
    expect(Object.keys(getNotes())).toEqual(['2.47']);
    deleteNote('2.47');
    expect(getNotes()).toEqual({});
  });

  it('labels edit times relative to today', () => {
    const now = new Date(2026, 8, 8, 12).getTime();
    expect(editedLabel(now - 60_000, now)).toBe('today');
    expect(editedLabel(now - 24 * 3600_000, now)).toBe('yesterday');
    expect(editedLabel(new Date(2026, 2, 12).getTime(), now)).toBe('12 Mar');
    expect(editedLabel(new Date(2024, 2, 12).getTime(), now)).toBe('12 Mar 2024');
  });
});
