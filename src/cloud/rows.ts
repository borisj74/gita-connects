/**
 * Translating between what the app holds and what Postgres stores.
 *
 * Local shapes grew from localStorage and use camelCase and epoch
 * milliseconds; the database uses snake_case and timestamptz. Keeping the
 * conversion in one small, pure module means the sync engine never has to
 * think about it, and it can be tested without a network.
 */
import type { SavedNetwork } from '../components/SavedNetworksDialog.js';
import type { Note, Notes } from '../notes.js';
import type { Preferences } from '../settingsStore.js';

export interface NetworkRow {
  id: string;
  user_id: string;
  name: string;
  nodes: unknown;
  edges: unknown;
  selected_verse_id: string | null;
  updated_at: string;
}

export interface NoteRow {
  user_id: string;
  verse_id: string;
  body: string;
  updated_at: string;
}

const iso = (ms: number) => new Date(ms).toISOString();
const ms = (value: string) => new Date(value).getTime();

export const networkToRow = (n: SavedNetwork, userId: string): NetworkRow => ({
  id: n.id,
  user_id: userId,
  name: n.name,
  nodes: n.nodes,
  edges: n.edges,
  selected_verse_id: n.selectedVerseId ?? null,
  updated_at: iso(n.timestamp),
});

export const rowToNetwork = (r: NetworkRow): SavedNetwork => ({
  id: r.id,
  name: r.name,
  timestamp: ms(r.updated_at),
  nodes: (r.nodes ?? []) as SavedNetwork['nodes'],
  edges: (r.edges ?? []) as SavedNetwork['edges'],
  selectedVerseId: r.selected_verse_id,
});

export const noteToRow = (verseId: string, note: Note, userId: string): NoteRow => ({
  user_id: userId,
  verse_id: verseId,
  body: note.text,
  updated_at: iso(note.updatedAt),
});

export const rowsToNotes = (rows: readonly NoteRow[]): Notes =>
  Object.fromEntries(rows.map((r) => [r.verse_id, { text: r.body, updatedAt: ms(r.updated_at) }]));

/** Notes as a list, so the same merge helper works for them as for networks. */
export interface NoteEntry {
  verseId: string;
  text: string;
  updatedAt: number;
}

export const notesToEntries = (notes: Notes): NoteEntry[] =>
  Object.entries(notes).map(([verseId, n]) => ({ verseId, text: n.text, updatedAt: n.updatedAt }));

export const entriesToNotes = (entries: readonly NoteEntry[]): Notes =>
  Object.fromEntries(entries.map((e) => [e.verseId, { text: e.text, updatedAt: e.updatedAt }]));

export interface LinkTypeRow {
  user_id: string;
  type_id: string;
  label: string;
  color: string;
  directional: boolean;
  updated_at: string;
}

export interface PreferencesRow {
  user_id: string;
  theme: string | null;
  hidden_filters: unknown;
  detail_sections: unknown;
  updated_at: string;
}

/** A custom link type in the shape the merger wants: an id plus updatedAt. */
export interface TypeEntry {
  typeId: string;
  label: string;
  color: string;
  directional: boolean;
  updatedAt: number;
}

export const typeToRow = (t: TypeEntry, userId: string): LinkTypeRow => ({
  user_id: userId,
  type_id: t.typeId,
  label: t.label,
  color: t.color,
  directional: t.directional,
  updated_at: iso(t.updatedAt),
});

export const rowToType = (r: LinkTypeRow): TypeEntry => ({
  typeId: r.type_id,
  label: r.label,
  color: r.color,
  directional: r.directional,
  updatedAt: ms(r.updated_at),
});

export const prefsToRow = (p: Preferences, userId: string): PreferencesRow => ({
  user_id: userId,
  theme: p.theme,
  hidden_filters: p.hiddenFilters,
  detail_sections: p.detailSections,
  updated_at: iso(p.updatedAt),
});

export const rowToPrefs = (r: PreferencesRow): Preferences => ({
  theme: r.theme === 'dark' ? 'dark' : 'light',
  hiddenFilters: Array.isArray(r.hidden_filters) ? (r.hidden_filters as string[]) : [],
  detailSections:
    r.detail_sections && typeof r.detail_sections === 'object'
      ? (r.detail_sections as Record<string, boolean>)
      : {},
  updatedAt: ms(r.updated_at),
});
