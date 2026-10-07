import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import NoteSection from './NoteSection.js';
import { getNote, saveNote, replaceNotes } from '../notes.js';

const editor = () => screen.getByRole('textbox', { name: 'Note on verse 2.47' });

function typeNote(text: string) {
  render(<NoteSection verseId="2.47" startEditing />);
  fireEvent.change(editor(), { target: { value: text } });
}

describe('My note keeps what was typed', () => {
  beforeEach(() => replaceNotes({}));

  it('saves when focus leaves the editor', () => {
    typeNote('Duty without craving');
    fireEvent.blur(editor(), { relatedTarget: document.body });
    expect(getNote('2.47')?.text).toBe('Duty without craving');
  });

  it('saves when the panel closes or moves to another verse', () => {
    const { unmount } = render(<NoteSection verseId="2.47" startEditing />);
    fireEvent.change(editor(), { target: { value: 'Half a thought' } });
    unmount();
    expect(getNote('2.47')?.text).toBe('Half a thought');
  });

  it('saves when the page is closed or hidden', () => {
    typeNote('Before the tab closes');
    window.dispatchEvent(new Event('pagehide'));
    expect(getNote('2.47')?.text).toBe('Before the tab closes');
  });

  it('still discards on Cancel and on Esc', () => {
    typeNote('Not this');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(getNote('2.47')).toBeUndefined();

    fireEvent.click(screen.getByRole('button', { name: /Add a note/ }));
    fireEvent.change(editor(), { target: { value: 'Nor this' } });
    fireEvent.keyDown(editor(), { key: 'Escape' });
    expect(getNote('2.47')).toBeUndefined();
  });

  it('does not remove a note just because it was emptied and left', () => {
    saveNote('2.47', 'Keep me');
    render(<NoteSection verseId="2.47" startEditing />);
    fireEvent.change(editor(), { target: { value: '' } });
    fireEvent.blur(editor(), { relatedTarget: document.body });
    expect(getNote('2.47')?.text).toBe('Keep me');
  });
});
