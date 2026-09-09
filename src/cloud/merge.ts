/**
 * Reconciling two devices' copies of the same list.
 *
 * Pure functions, no Supabase: the interesting decisions are "which edit is
 * newer" and "what changed since last time", and both are worth testing
 * without a network.
 *
 * The rule is last-write-wins per record, by the client's own timestamp. That
 * is the honest model for one person on two devices, which is what this is
 * for; it is not enough for two people editing at once, and nothing here
 * pretends otherwise.
 */

export interface Timestamped {
  updatedAt: number;
}

/**
 * Union of local and remote, keeping the newer copy of anything in both.
 *
 * Used on the first sync after signing in, where nothing may be deleted:
 * the reader may have worked on either device, and neither list is
 * authoritative yet.
 */
export function mergeNewest<T extends Timestamped>(
  local: readonly T[],
  remote: readonly T[],
  idOf: (item: T) => string,
): T[] {
  // Remote first, so a local copy claiming the same instant replaces it: the
  // device in the reader's hand is the one they were just looking at, and
  // silently overwriting what is on screen is the worse surprise.
  const byId = new Map<string, T>();
  [...remote, ...local].forEach((item) => {
    const existing = byId.get(idOf(item));
    if (!existing || item.updatedAt >= existing.updatedAt) byId.set(idOf(item), item);
  });
  return [...byId.values()];
}

export interface Changes<T> {
  upserts: T[];
  deletes: string[];
}

/**
 * What changed between a known-synced snapshot and the list as it now stands.
 *
 * Deletions can only be recognised by comparing against a snapshot: an id
 * missing from `next` means the reader removed it, whereas on a first sync
 * the same absence would just mean "this device never had it".
 */
export function changesSince<T>(
  previous: readonly T[],
  next: readonly T[],
  idOf: (item: T) => string,
  isEqual: (a: T, b: T) => boolean,
): Changes<T> {
  const before = new Map(previous.map((item) => [idOf(item), item]));
  const upserts: T[] = [];
  const seen = new Set<string>();

  next.forEach((item) => {
    const id = idOf(item);
    seen.add(id);
    const old = before.get(id);
    if (!old || !isEqual(old, item)) upserts.push(item);
  });

  const deletes = [...before.keys()].filter((id) => !seen.has(id));
  return { upserts, deletes };
}
