/**
 * Saved networks, kept in localStorage with subscribers.
 *
 * This used to live inside SaveLoadControls as component state. It moved out
 * so two things can read and write the same list: the Networks menu, and the
 * cloud sync engine, which needs to merge in what other devices saved without
 * going through the UI.
 */
import { useSyncExternalStore } from 'react';
import type { SavedNetwork } from './components/SavedNetworksDialog.js';

export const NETWORKS_KEY = 'gita-connects-saved-networks';

let networks: SavedNetwork[] = load();
const listeners = new Set<() => void>();

function load(): SavedNetwork[] {
  try {
    const raw = localStorage.getItem(NETWORKS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as SavedNetwork[]) : [];
  } catch {
    return [];
  }
}

export const getNetworks = (): SavedNetwork[] => networks;

/**
 * Replace the whole list. Returns false when the write failed — a full quota
 * is the realistic case, and the caller shows that rather than pretending the
 * save worked.
 */
export function setNetworks(next: SavedNetwork[]): boolean {
  let ok = true;
  try {
    localStorage.setItem(NETWORKS_KEY, JSON.stringify(next));
  } catch {
    ok = false;
  }
  networks = next;
  listeners.forEach((l) => l());
  return ok;
}

export function subscribeNetworks(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const useNetworks = (): SavedNetwork[] =>
  useSyncExternalStore(subscribeNetworks, getNetworks, getNetworks);

/** A fresh id for a new network. Shared with the cloud, so it must be unique. */
export const newNetworkId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}`;

/**
 * Test hook: re-read storage into memory and notify, without writing back.
 * Writing back would create the key that a test is asserting is absent.
 */
export function _reloadNetworksForTests(): void {
  networks = load();
  listeners.forEach((l) => l());
}
