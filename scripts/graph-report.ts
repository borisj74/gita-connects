/**
 * Static health report for the curated verse graph: where the hubs are,
 * what is unreachable, which link types dominate, and how thin each chapter
 * and concept is. Read-only; run it before and after a review session.
 *
 *   npm run graph:report
 */
import { verses, connections, chapters } from '../src/data/index.js';
import { CONCEPTS } from '../src/concepts.js';

const reviewed = verses.filter((v) => v.reviewed);
const curated = verses.filter((v) => v.curated);

// Degree per verse, one edge per verse pair (the canvas collapses parallel links too)
const pairs = new Set<string>();
const degree = new Map<string, number>();
const linkTypes = new Map<string, number>();
let sameChapter = 0;
connections.forEach((c) => {
  const key = [c.from, c.to].sort().join('|');
  linkTypes.set(c.type, (linkTypes.get(c.type) ?? 0) + 1);
  if (pairs.has(key)) return;
  pairs.add(key);
  degree.set(c.from, (degree.get(c.from) ?? 0) + 1);
  degree.set(c.to, (degree.get(c.to) ?? 0) + 1);
  if (c.from.split('.')[0] === c.to.split('.')[0]) sameChapter += 1;
});

// Connected components (union–find over linked verses)
const parent = new Map<string, string>();
const find = (x: string): string => {
  const p = parent.get(x) ?? x;
  if (p === x) return x;
  const root = find(p);
  parent.set(x, root);
  return root;
};
pairs.forEach((key) => {
  const [a, b] = key.split('|');
  parent.set(find(a), find(b));
});
const components = new Map<string, string[]>();
degree.forEach((_, id) => {
  const root = find(id);
  components.set(root, [...(components.get(root) ?? []), id]);
});
const componentSizes = [...components.values()].map((c) => c.length).sort((a, b) => b - a);

const pct = (n: number, d: number) => `${Math.round((n / Math.max(1, d)) * 100)}%`;
const line = (label: string, value: string | number) => console.log(`${label.padEnd(34)}${value}`);

console.log('Verse graph report\n');
line('verses', verses.length);
line('curated (any theme/concepts)', `${curated.length} (${pct(curated.length, verses.length)})`);
line('reviewed by a person', `${reviewed.length} (${pct(reviewed.length, verses.length)})`);
line('connections (authored)', connections.length);
line('distinct verse pairs', pairs.size);
line('verses with ≥1 link', degree.size);
line('same-chapter pairs', `${sameChapter} (${pct(sameChapter, pairs.size)})`);
line('components', `${componentSizes.length}  sizes: ${componentSizes.join(', ')}`);
const orphans = reviewed.filter((v) => !degree.has(v.id)).map((v) => v.id);
line('reviewed but unlinked', orphans.length ? orphans.join(', ') : 'none');

console.log('\nHubs (most linked verses)');
[...degree.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
  .forEach(([id, d]) => {
    const v = verses.find((x) => x.id === id);
    console.log(`  ${id.padEnd(7)} ${String(d).padStart(3)}  ${v?.theme ?? '—'}${v && !v.reviewed ? '  (unreviewed)' : ''}`);
  });

console.log('\nLink types');
[...linkTypes.entries()]
  .sort((a, b) => b[1] - a[1])
  .forEach(([t, n]) => console.log(`  ${t.padEnd(14)} ${String(n).padStart(4)}  ${pct(n, connections.length)}`));

console.log('\nChapters: reviewed / verses, links touching the chapter');
chapters.forEach((ch) => {
  const r = reviewed.filter((v) => v.chapter === ch.number).length;
  const links = connections.filter((c) => c.from.startsWith(`${ch.number}.`) || c.to.startsWith(`${ch.number}.`)).length;
  const meter = '█'.repeat(Math.round((r / ch.verses) * 20)).padEnd(20, '·');
  console.log(`  ${String(ch.number).padStart(2)}  ${meter} ${String(r).padStart(2)}/${String(ch.verses).padEnd(3)} ${String(links).padStart(4)} links  ${ch.title}`);
});

console.log('\nConcepts: reviewed verses carrying each (thinnest first)');
const byConcept = CONCEPTS.map((c) => ({
  concept: c,
  reviewed: reviewed.filter((v) => (v.concepts as readonly string[]).includes(c)).length,
  total: curated.filter((v) => (v.concepts as readonly string[]).includes(c)).length,
})).sort((a, b) => a.reviewed - b.reviewed || b.total - a.total);
byConcept.forEach(({ concept, reviewed: r, total }) =>
  console.log(`  ${concept.padEnd(18)} ${String(r).padStart(3)} reviewed of ${String(total).padStart(4)} tagged`),
);
