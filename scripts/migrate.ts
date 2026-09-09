/**
 * Apply supabase/migrations/*.sql in name order.
 *
 * Every migration is written to be re-runnable, so this simply plays them all
 * each time rather than keeping a ledger. Connects with POSTGRES_URL from
 * .env.local (written by `vercel env pull`), which is never committed.
 *
 *   npm run db:migrate
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';

function env(key: string): string {
  const line = readFileSync('.env.local', 'utf8').match(new RegExp(`^${key}="?([^"\\n]+)"?$`, 'm'));
  if (!line) throw new Error(`${key} missing from .env.local — run: vercel env pull`);
  return line[1];
}

const dir = 'supabase/migrations';
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

// Supabase's pooler presents a chain Node does not ship a root for; the
// sslmode in the URL would otherwise override the setting below.
const url = new URL(env('POSTGRES_URL_NON_POOLING'));
url.searchParams.delete('sslmode');
const client = new Client({ connectionString: url.toString(), ssl: { rejectUnauthorized: false } });
await client.connect();
for (const file of files) {
  process.stdout.write(`${file} … `);
  await client.query(readFileSync(join(dir, file), 'utf8'));
  console.log('ok');
}
await client.end();
console.log(`\n${files.length} migration${files.length === 1 ? '' : 's'} applied.`);
