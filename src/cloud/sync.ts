/**
 * Keeping one reader's work in step across their devices.
 *
 * The app stays local-first: every read comes from localStorage, so it works
 * offline and with no account at all. Signing in adds a mirror. On sign-in we
 * pull what the cloud has, merge it with what this device has (union, newer
 * edit wins — nothing is ever dropped on a first sync), write the result back
 * to both sides, and then keep pushing local edits as they happen.
 *
 * Deletions need care: an id missing from the local list means "the reader
 * deleted it" only if we know the list once contained it. So deletes are
 * computed against a snapshot taken at the end of the last successful sync,
 * never against the cloud's list.
 */
import { useSyncExternalStore } from 'react';
import { supabase } from './supabase.js';
import { mergeNewest, changesSince } from './merge.js';
import {
  networkToRow, rowToNetwork, noteToRow, rowsToNotes,
  notesToEntries, entriesToNotes,
  typeToRow, rowToType, prefsToRow, rowToPrefs,
  type NetworkRow, type NoteRow, type NoteEntry,
  type LinkTypeRow, type PreferencesRow, type TypeEntry,
} from './rows.js';
import { getNetworks, setNetworks, subscribeNetworks } from '../networksStore.js';
import { getNotes, replaceNotes, subscribeNotes } from '../notes.js';
import {
  readPreferences, readCustomTypes, applyRemoteSettings, subscribeSettings,
  type Preferences, type StoredType,
} from '../settingsStore.js';
import type { SavedNetwork } from '../components/SavedNetworksDialog.js';

export type SyncStatus = 'off' | 'syncing' | 'synced' | 'error';

interface State {
  status: SyncStatus;
  /** Present only when status is 'error'. */
  message: string | null;
  /** When the last successful sync finished. */
  at: number | null;
}

let state: State = { status: 'off', message: null, at: null };
const listeners = new Set<() => void>();

function setState(next: Partial<State>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

const getState = () => state;

/** Sync status, for the account dialog and the toolbar. */
export const useSyncStatus = (): State => useSyncExternalStore(subscribe, getState, getState);

// --- engine ---------------------------------------------------------------

let userId: string | null = null;
let unsubscribers: (() => void)[] = [];
let pushTimer: ReturnType<typeof setTimeout> | null = null;

/** What the cloud held at the end of the last successful sync. */
let syncedNetworks: SavedNetwork[] = [];
let syncedNotes: NoteEntry[] = [];
let syncedTypes: TypeEntry[] = [];
let syncedPrefsAt = 0;

const sameNetwork = (a: SavedNetwork, b: SavedNetwork) =>
  a.timestamp === b.timestamp && a.name === b.name;
const sameNote = (a: NoteEntry, b: NoteEntry) => a.updatedAt === b.updatedAt && a.text === b.text;
const sameType = (a: TypeEntry, b: TypeEntry) =>
  a.updatedAt === b.updatedAt && a.label === b.label && a.color === b.color && a.directional === b.directional;

/** Custom link types as the merger wants them, from what is on this device. */
const localTypeEntries = (): TypeEntry[] =>
  readCustomTypes().map((t) => ({
    typeId: t.id,
    label: t.label,
    color: t.color,
    directional: t.directional ?? false,
    updatedAt: t.updatedAt ?? 0,
  }));

const entriesToStoredTypes = (entries: readonly TypeEntry[]): StoredType[] =>
  entries.map((t) => ({
    id: t.typeId,
    label: t.label,
    color: t.color,
    directional: t.directional,
    isCustom: true,
    updatedAt: t.updatedAt,
  }));

/** Pull, merge, write both sides, and remember the result as the baseline. */
async function fullSync(): Promise<void> {
  if (!supabase || !userId) return;
  const id = userId;
  setState({ status: 'syncing', message: null });

  const [networkRes, noteRes, typeRes, prefRes] = await Promise.all([
    supabase.from('networks').select('*'),
    supabase.from('notes').select('*'),
    supabase.from('link_types').select('*'),
    supabase.from('preferences').select('*').maybeSingle(),
  ]);
  if (networkRes.error) throw networkRes.error;
  if (noteRes.error) throw noteRes.error;
  if (typeRes.error) throw typeRes.error;
  if (prefRes.error) throw prefRes.error;

  const remoteNetworks = (networkRes.data as NetworkRow[]).map(rowToNetwork);
  const remoteNotes = notesToEntries(rowsToNotes(noteRes.data as NoteRow[]));

  // A SavedNetwork's timestamp is its updated-at, which is what merging needs.
  const localNetworks = getNetworks().map((n) => ({ ...n, updatedAt: n.timestamp }));
  const mergedNetworks = mergeNewest(
    localNetworks,
    remoteNetworks.map((n) => ({ ...n, updatedAt: n.timestamp })),
    (n) => n.id,
  ).map(({ updatedAt: _drop, ...n }) => n as SavedNetwork);

  const mergedNotes = mergeNewest(notesToEntries(getNotes()), remoteNotes, (n) => n.verseId);

  const remoteTypes = (typeRes.data as LinkTypeRow[]).map(rowToType);
  const mergedTypes = mergeNewest(localTypeEntries(), remoteTypes, (t) => t.typeId);

  // Preferences are a single row, so the whole bundle wins or loses together.
  const localPrefs = readPreferences();
  const remotePrefs = prefRes.data ? rowToPrefs(prefRes.data as PreferencesRow) : null;
  const mergedPrefs: Preferences =
    remotePrefs && remotePrefs.updatedAt > localPrefs.updatedAt ? remotePrefs : localPrefs;

  setNetworks(mergedNetworks);
  replaceNotes(entriesToNotes(mergedNotes));
  applyRemoteSettings(mergedPrefs, entriesToStoredTypes(mergedTypes));

  // Push the merge back so the other device converges too. Upserting the whole
  // set is fine at this size and makes a re-sync idempotent.
  if (mergedNetworks.length > 0) {
    const { error } = await supabase
      .from('networks')
      .upsert(mergedNetworks.map((n) => networkToRow(n, id)));
    if (error) throw error;
  }
  if (mergedNotes.length > 0) {
    const { error } = await supabase
      .from('notes')
      .upsert(mergedNotes.map((n) => noteToRow(n.verseId, { text: n.text, updatedAt: n.updatedAt }, id)));
    if (error) throw error;
  }

  if (mergedTypes.length > 0) {
    const { error } = await supabase.from('link_types').upsert(mergedTypes.map((t) => typeToRow(t, id)));
    if (error) throw error;
  }
  if (mergedPrefs.updatedAt > 0) {
    const { error } = await supabase.from('preferences').upsert(prefsToRow(mergedPrefs, id));
    if (error) throw error;
  }

  syncedNetworks = mergedNetworks;
  syncedNotes = mergedNotes;
  syncedTypes = mergedTypes;
  syncedPrefsAt = mergedPrefs.updatedAt;
  setState({ status: 'synced', at: Date.now(), message: null });
}

/** Send only what changed since the baseline. */
async function pushChanges(): Promise<void> {
  if (!supabase || !userId) return;
  const localNetworks = getNetworks();
  const localNotes = notesToEntries(getNotes());

  const localTypes = localTypeEntries();
  const localPrefs = readPreferences();

  const netChanges = changesSince(syncedNetworks, localNetworks, (n) => n.id, sameNetwork);
  const noteChanges = changesSince(syncedNotes, localNotes, (n) => n.verseId, sameNote);
  const typeChanges = changesSince(syncedTypes, localTypes, (t) => t.typeId, sameType);
  const prefsChanged = localPrefs.updatedAt > syncedPrefsAt;
  if (
    netChanges.upserts.length + netChanges.deletes.length +
    noteChanges.upserts.length + noteChanges.deletes.length +
    typeChanges.upserts.length + typeChanges.deletes.length === 0 && !prefsChanged
  ) {
    return;
  }

  setState({ status: 'syncing', message: null });

  if (netChanges.upserts.length) {
    const { error } = await supabase
      .from('networks')
      .upsert(netChanges.upserts.map((n) => networkToRow(n, userId!)));
    if (error) throw error;
  }
  if (netChanges.deletes.length) {
    const { error } = await supabase.from('networks').delete().in('id', netChanges.deletes);
    if (error) throw error;
  }
  if (noteChanges.upserts.length) {
    const { error } = await supabase
      .from('notes')
      .upsert(noteChanges.upserts.map((n) => noteToRow(n.verseId, { text: n.text, updatedAt: n.updatedAt }, userId!)));
    if (error) throw error;
  }
  if (noteChanges.deletes.length) {
    const { error } = await supabase.from('notes').delete().in('verse_id', noteChanges.deletes);
    if (error) throw error;
  }
  if (typeChanges.upserts.length) {
    const { error } = await supabase
      .from('link_types')
      .upsert(typeChanges.upserts.map((t) => typeToRow(t, userId!)));
    if (error) throw error;
  }
  if (typeChanges.deletes.length) {
    const { error } = await supabase.from('link_types').delete().in('type_id', typeChanges.deletes);
    if (error) throw error;
  }
  if (prefsChanged) {
    const { error } = await supabase.from('preferences').upsert(prefsToRow(localPrefs, userId));
    if (error) throw error;
  }

  syncedNetworks = localNetworks;
  syncedNotes = localNotes;
  syncedTypes = localTypes;
  syncedPrefsAt = localPrefs.updatedAt;
  setState({ status: 'synced', at: Date.now(), message: null });
}

function fail(error: unknown) {
  setState({
    status: 'error',
    message: error instanceof Error ? error.message : 'Could not sync right now.',
  });
}

/** Coalesce bursts of edits — typing a note fires on every keystroke's save. */
function schedulePush() {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    pushChanges().catch(fail);
  }, 1200);
}

/**
 * Begin mirroring this device's work to the given account. Safe to call again
 * for the same user; it restarts cleanly.
 */
export async function startSync(id: string): Promise<void> {
  stopSync();
  if (!supabase) return;
  userId = id;

  try {
    await fullSync();
  } catch (error) {
    fail(error);
    return;
  }

  // React to local edits from anywhere in the app.
  unsubscribers = [
    subscribeNetworks(schedulePush),
    subscribeNotes(schedulePush),
    subscribeSettings(schedulePush),
  ];
}

/** Stop mirroring. The local copy is left exactly as it is. */
export function stopSync(): void {
  unsubscribers.forEach((u) => u());
  unsubscribers = [];
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  userId = null;
  syncedNetworks = [];
  syncedNotes = [];
  syncedTypes = [];
  syncedPrefsAt = 0;
  setState({ status: 'off', message: null, at: null });
}
