/**
 * Upload the local copy of Bhagavad-gita As It Is (private/bbt/bg.json, made
 * by `npm run import:bbt`) to the bbt_verses table, which api/verse.ts reads
 * on the deployed site. Run `npm run db:migrate` first so the table exists.
 *
 * Connects like scripts/migrate.ts, with POSTGRES_URL_NON_POOLING from
 * .env.local (written by `vercel env pull`, never committed). Upserts every
 * section in one transaction and deletes any the book no longer has, so it is
 * safe to rerun after re-importing.
 *
 *   npm run bbt:upload
 */
import { existsSync, readFileSync } from 'node:fs';
import { Client } from 'pg';

const SOURCE = 'private/bbt/bg.json';

function env(key: string): string {
  if (process.env[key]) return process.env[key]!;
  const line = existsSync('.env.local') && readFileSync('.env.local', 'utf8').match(new RegExp(`^${key}="?([^"\\n]+)"?$`, 'm'));
  if (!line) throw new Error(`${key} missing from .env.local — run: vercel env pull`);
  return line[1];
}

if (!existsSync(SOURCE)) {
  console.error(`No ${SOURCE}. Import the book first: npm run import:bbt -- <path to the EPUB>`);
  process.exit(1);
}
type Section = { sanskrit: string; transliteration: string; synonyms: string; translation: string; purport: string[] };
const { pages } = JSON.parse(readFileSync(SOURCE, 'utf8')) as { pages: Record<string, Section> };
const rows = Object.entries(pages);

// Supabase's pooler presents a chain Node does not ship a root for; the
// sslmode in the URL would otherwise override the setting below.
const url = new URL(env('POSTGRES_URL_NON_POOLING'));
url.searchParams.delete('sslmode');
const local = ['localhost', '127.0.0.1', ''].includes(url.hostname);
const client = new Client({ connectionString: url.toString(), ssl: local ? false : { rejectUnauthorized: false } });
await client.connect();
try {
  await client.query('begin');
  // One statement for the whole book: the rows go in as a JSON array.
  await client.query(
    `insert into public.bbt_verses (page, sanskrit, transliteration, synonyms, translation, purport, updated_at)
     select r->>'page', r->>'sanskrit', r->>'transliteration', r->>'synonyms', r->>'translation', r->'purport', now()
     from jsonb_array_elements($1::jsonb) as r
     on conflict (page) do update set
       sanskrit = excluded.sanskrit, transliteration = excluded.transliteration, synonyms = excluded.synonyms,
       translation = excluded.translation, purport = excluded.purport, updated_at = excluded.updated_at`,
    [JSON.stringify(rows.map(([page, s]) => ({ page, ...s })))],
  );
  const removed = await client.query('delete from public.bbt_verses where page <> all($1::text[])', [rows.map(([page]) => page)]);
  await client.query('commit');
  const { rows: [{ count }] } = await client.query('select count(*)::int as count from public.bbt_verses');
  console.log(`Uploaded ${rows.length} sections of the book${removed.rowCount ? `, removed ${removed.rowCount} stale` : ''}; the table now holds ${count}.`);
} catch (err) {
  await client.query('rollback');
  throw err;
} finally {
  await client.end();
}
