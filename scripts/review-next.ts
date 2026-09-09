/**
 * Print the unreviewed verses most worth a person's attention.
 *
 *   npm run review:next                  top 20
 *   npm run review:next -- --top 50
 *   npm run review:next -- --chapter 3
 *   npm run review:next -- --concept faith
 *   npm run review:next -- --demand my-export.json   (verse-id → weight)
 *   npm run review:next -- --json
 *
 * See src/review/rank.ts for what the signals mean. To act on a line, follow
 * the recipe at the top of src/data/curation.generated.ts.
 */
import { readFileSync } from 'node:fs';
import { rankForReview, type Signal } from '../src/review/rank.js';

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const has = (name: string) => args.includes(`--${name}`);

const top = Number(flag('top') ?? 20);
const chapter = flag('chapter') ? Number(flag('chapter')) : undefined;
const concept = flag('concept');
const demandPath = flag('demand');

let demand: Map<string, number> | undefined;
if (demandPath) {
  const parsed = JSON.parse(readFileSync(demandPath, 'utf8')) as Record<string, number>;
  demand = new Map(Object.entries(parsed));
}

const ranked = rankForReview({ chapter, concept, demand }).slice(0, top);

if (has('json')) {
  console.log(JSON.stringify(ranked, null, 2));
  process.exit(0);
}

const bar = (v: number) => '█'.repeat(Math.round(v * 5)).padEnd(5, '·');
const order: Signal[] = ['fame', 'bridge', 'traffic', 'gap', 'weakness'];

console.log(`Next ${ranked.length} verses to review${chapter ? ` in chapter ${chapter}` : ''}${concept ? ` tagged ${concept}` : ''}\n`);
console.log('  #  verse   score  ' + order.map((s) => s.padEnd(9)).join('') + 'theme / concepts');
ranked.forEach((r, i) => {
  const sig = order.map((s) => bar(r.signals[s]).padEnd(9)).join('');
  console.log(
    `${String(i + 1).padStart(3)}  ${r.id.padEnd(7)} ${r.score.toFixed(2).padStart(5)}  ${sig}${r.theme ?? '—'} · ${r.concepts.join(', ')}`,
  );
  console.log(`${' '.repeat(19)}${r.reasons.join(' · ')}`);
});
