/**
 * Apply supabase/migrations/*.sql in name order.
 *
 * Every migration is written to be re-runnable, so this simply plays them all
 * each time rather than keeping a ledger. Connects with POSTGRES_URL_NON_POOLING
 * from .env.local (written by `vercel env pull`), which is never committed.
 *
 *   npm run db:migrate
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { connect, env } from './pg-connect.js';

const dir = 'supabase/migrations';
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

// Verifies the server's certificate against Supabase's root (pg-connect.ts).
const client = await connect(env('POSTGRES_URL_NON_POOLING'));
for (const file of files) {
  process.stdout.write(`${file} … `);
  await client.query(readFileSync(join(dir, file), 'utf8'));
  console.log('ok');
}
await client.end();
console.log(`\n${files.length} migration${files.length === 1 ? '' : 's'} applied.`);
