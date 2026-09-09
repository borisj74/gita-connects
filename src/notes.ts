/**
 * Personal notes, one per verse, kept on this device only.
 *
 * A tiny store with subscribers so the verse cards (badge) and the detail
 * panel (editor) read the same data without prop-drilling through the
 * canvas. Everything is persisted to localStorage on every write; the
 * payload is small (a few hundred notes at most) so no debouncing.
 */
import { useSyncExternalStore } from 'react';

export interface Note {
  text: string;
  /** Epoch ms of the last save. */
  updatedAt: number;
}

export type Notes = Readonly<Record<string, Note>>;

export const NOTES_KEY = 'gita-connects-notes';

let notes: Notes = load();
const listeners = new Set<() => void>();

function load(): Notes {
  try {
    const raw = localStorage.getItem(NOTES_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Record<string, Note> = {};
    for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!value || typeof value !== 'object') continue;
      const { text, updatedAt } = value as Partial<Note>;
      if (typeof text !== 'string' || typeof updatedAt !== 'number') continue;
      if (text.trim() === '') continue;
      out[id] = { text, updatedAt };
    }
    return out;
  } catch {
    return {};
  }
}

function persist(next: Notes) {
  notes = next;
  try {
    if (Object.keys(next).length === 0) localStorage.removeItem(NOTES_KEY);
    else localStorage.setItem(NOTES_KEY, JSON.stringify(next));
  } catch {
    // Quota or private mode: the note still lives for this session.
  }
  listeners.forEach((l) => l());
}

export const getNotes = (): Notes => notes;

/**
 * Replace every note at once. Used by cloud sync after merging this device's
 * notes with another device's; ordinary editing goes through saveNote.
 */
export function replaceNotes(next: Notes): void {
  persist(next);
}
export const getNote = (verseId: string): Note | undefined => notes[verseId];

/** Save a note; an empty (whitespace-only) text deletes it. */
export function saveNote(verseId: string, text: string, now = Date.now()): void {
  const trimmed = text.trim();
  if (trimmed === '') {
    deleteNote(verseId);
    return;
  }
  persist({ ...notes, [verseId]: { text: trimmed, updatedAt: now } });
}

export function deleteNote(verseId: string): void {
  if (!(verseId in notes)) return;
  const next = { ...notes };
  delete next[verseId];
  persist(next);
}

export function subscribeNotes(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** All notes, re-rendering the caller whenever any note changes. */
export const useNotes = (): Notes => useSyncExternalStore(subscribeNotes, getNotes, getNotes);

/** One verse's note, or undefined. */
export const useNote = (verseId: string | null): Note | undefined =>
  useSyncExternalStore(subscribeNotes, () => (verseId ? notes[verseId] : undefined), () => undefined);

/** "today", "yesterday", "12 Mar", or "12 Mar 2024" for another year. */
export function editedLabel(updatedAt: number, now = Date.now()): string {
  const d = new Date(updatedAt);
  const n = new Date(now);
  const sameDay = d.toDateString() === n.toDateString();
  if (sameDay) return 'today';
  const yesterday = new Date(n);
  yesterday.setDate(n.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'yesterday';
  const opts: Intl.DateTimeFormatOptions =
    d.getFullYear() === n.getFullYear() ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' };
  return d.toLocaleDateString('en-GB', opts);
}

/** Test hook: reload from storage (after tests write to localStorage directly). */
export function _reloadNotesForTests(): void {
  persist(load());
}
