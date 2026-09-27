/**
 * A Postgres client for the scripts that write to Supabase (migrate.ts,
 * upload-bbt.ts), with the server's certificate verified.
 *
 * Supabase signs its database certificates with its own root, which Node does
 * not ship, so it is pinned here: supabase/prod-ca-2021.crt is the public
 * "Supabase Root 2021 CA" (valid to 2031; SHA-256 80:70:25:AD:…:CA:FA), the
 * same file as Project Settings → Database → SSL Configuration → Download
 * certificate. Set PG_CA_FILE to use a different one. Verification is never
 * turned off: a connection that cannot prove it reached Supabase fails,
 * rather than handing the database password to whoever answered.
 */
import { existsSync, readFileSync } from 'node:fs';
import { Client } from 'pg';

/** A variable from the environment, or from .env.local (written by `vercel env pull`, never committed). */
export function env(key: string): string {
  if (process.env[key]) return process.env[key]!;
  const line = existsSync('.env.local') && readFileSync('.env.local', 'utf8').match(new RegExp(`^${key}="?([^"\\n]+)"?$`, 'm'));
  if (!line) throw new Error(`${key} missing from .env.local — run: vercel env pull`);
  return line[1];
}

export function pgClient(connectionString: string): Client {
  const url = new URL(connectionString);
  // sslmode in the URL would override the ssl option below.
  url.searchParams.delete('sslmode');
  const local = ['localhost', '127.0.0.1', '::1', ''].includes(url.hostname);
  const ca = readFileSync(process.env.PG_CA_FILE ?? new URL('../supabase/prod-ca-2021.crt', import.meta.url), 'utf8');
  return new Client({ connectionString: url.toString(), ssl: local ? false : { ca, rejectUnauthorized: true } });
}

/** Connect, explaining a certificate failure instead of printing a bare TLS error. */
export async function connect(connectionString: string): Promise<Client> {
  const client = pgClient(connectionString);
  try {
    await client.connect();
  } catch (err) {
    const code = (err as { code?: string }).code ?? '';
    if (/CERT|SELF_SIGNED|UNABLE_TO|ERR_TLS/.test(code)) {
      throw new Error(
        `The database's certificate could not be verified (${code}), so nothing was sent.\n` +
          'If this really is your Supabase project, download its certificate (Project Settings → Database → SSL Configuration)\n' +
          'and run again with PG_CA_FILE=/path/to/that.crt.',
        { cause: err },
      );
    }
    throw err;
  }
  return client;
}
