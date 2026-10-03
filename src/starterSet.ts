/** How many linked verses join the hub in a starter set. */
export const STARTER_NEIGHBORS = 5;

/**
 * A starter set: a random well-connected verse plus a random handful of the
 * verses it links to, so each visit opens on a different corner of the Gita.
 * Hubs are drawn from verses with at least STARTER_NEIGHBORS links, so the
 * set always comes out full; if none qualify, the best-connected verse is used.
 */
export function pickStarterSet(
  connections: { from: string; to: string }[],
  random: () => number = Math.random,
): string[] {
  const neighbors = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    if (a === b) return;
    let set = neighbors.get(a);
    if (!set) neighbors.set(a, (set = new Set()));
    set.add(b);
  };
  for (const c of connections) {
    link(c.from, c.to);
    link(c.to, c.from);
  }
  if (neighbors.size === 0) return [];

  const ranked = [...neighbors].sort((a, b) => b[1].size - a[1].size);
  const pool = ranked.filter(([, set]) => set.size >= STARTER_NEIGHBORS);
  const candidates = pool.length > 0 ? pool : ranked.slice(0, 1);
  const [hub, linked] = candidates[Math.floor(random() * candidates.length)];

  return [hub, ...shuffle([...linked], random).slice(0, STARTER_NEIGHBORS)];
}

function shuffle<T>(items: T[], random: () => number): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}
