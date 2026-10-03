/**
 * "Check with AI" for signed-in readers: asks TypeSafe whether each
 * connection the reader drew holds, which type fits it best, what the
 * network is mostly about, and which reflection question suits it.
 *
 * - Signed-in only. The browser sends the reader's Supabase access token;
 *   it is verified with Supabase before anything else happens.
 * - The TypeSafe key is a server-only environment variable (TYPESAFE_API_KEY,
 *   never VITE_-prefixed), so it never reaches the bundle.
 * - Each reader gets DAILY_LIMIT checks a day, counted in ai_checks
 *   (supabase/migrations/0005_ai_checks.sql) with the service-role key.
 * - Only the app's own scholarship is sent (see src/aiCheck.ts), never the
 *   Bhaktivedanta Book Trust's text.
 */
import { TypeSafeClient, AuthenticationError, RateLimitError } from '@typesafe-ai/sdk';
import { buildCheckRequest, parseCheckInput, readCheckAnswers } from '../src/aiCheck.js';
import { verseCuration } from '../src/data/curation.js';
import { generatedCuration } from '../src/data/curation.generated.js';
import { PREDEFINED_CONNECTION_TYPES } from '../src/connectionTypes.js';
import type { Verse } from '../src/types.js';

export const DAILY_LIMIT = 20;

/**
 * What the check needs to know about a verse: our theme, summary and
 * concepts. Read from the curation modules rather than src/data/index.ts,
 * whose JSON imports Node will not load in a server function.
 */
function verseForCheck(id: string): Verse | undefined {
  const [chapter, verse] = id.split('.').map(Number);
  if (!chapter || !verse) return undefined;
  const c = verseCuration[id] ?? generatedCuration[id];
  return {
    id,
    chapter,
    verse,
    sanskrit: '',
    transliteration: '',
    theme: c?.theme,
    summary: c?.summary,
    concepts: c?.concepts ?? [],
    curated: c !== undefined,
    reviewed: c !== undefined && c.reviewed !== false,
  };
}
const DAY_MS = 24 * 60 * 60 * 1000;

const supabaseUrl = () => process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const anonKey = () => process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;

/** The signed-in reader's id, or null when the token is missing or invalid. */
async function readerId(request: Request): Promise<string | null | 'unconfigured'> {
  const base = supabaseUrl();
  const key = anonKey();
  if (!base || !key) return 'unconfigured';
  const token = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;
  try {
    const res = await fetch(new URL('/auth/v1/user', base), {
      headers: { apikey: key, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const user = (await res.json()) as { id?: unknown };
    return typeof user.id === 'string' ? user.id : null;
  } catch {
    return null;
  }
}

function serviceHeaders(): Record<string, string> | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  // Legacy keys are JWTs and go in both headers; sb_secret_ keys in apikey alone.
  const headers: Record<string, string> = { apikey: key };
  if (!key.startsWith('sb_')) headers.Authorization = `Bearer ${key}`;
  return headers;
}

/**
 * Checks this reader has used in the last day, or null when the count is
 * unavailable (not configured, table missing). Unavailable fails open: the
 * feature is signed-in only, and a missing migration should not take it down.
 */
async function usedToday(userId: string): Promise<number | null> {
  const base = supabaseUrl();
  const headers = serviceHeaders();
  if (!base || !headers) {
    console.error('[api/check] Daily limit off: SUPABASE_SERVICE_ROLE_KEY is not set');
    return null;
  }
  const url = new URL('/rest/v1/ai_checks', base);
  url.searchParams.set('user_id', `eq.${userId}`);
  url.searchParams.set('created_at', `gte.${new Date(Date.now() - DAY_MS).toISOString()}`);
  url.searchParams.set('select', 'id');
  try {
    const res = await fetch(url, {
      headers: { ...headers, Prefer: 'count=exact', Range: '0-0' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.error(`[api/check] Daily limit off: ai_checks answered ${res.status} (run npm run db:migrate)`);
      return null;
    }
    const total = Number(res.headers.get('content-range')?.split('/')[1]);
    return Number.isFinite(total) ? total : null;
  } catch {
    return null;
  }
}

async function recordCheck(userId: string, links: number): Promise<void> {
  const base = supabaseUrl();
  const headers = serviceHeaders();
  if (!base || !headers) return;
  try {
    await fetch(new URL('/rest/v1/ai_checks', base), {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ user_id: userId, links }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // A missed count only errs in the reader's favour.
  }
}

function typesafe(): TypeSafeClient | null {
  // In a Claude Code cloud session the egress proxy injects the credential,
  // so the SDK only needs a placeholder (as in scripts/generate-concepts-jev.ts).
  const apiKey =
    process.env.TYPESAFE_API_KEY?.trim() ||
    (process.env.CLAUDE_CODE_REMOTE === 'true' ? 'injected-by-proxy' : undefined);
  if (!apiKey) {
    console.error('[api/check] TYPESAFE_API_KEY is not set');
    return null;
  }
  return new TypeSafeClient({ apiKey, timeout: 45_000 });
}

export async function POST(request: Request): Promise<Response> {
  const reader = await readerId(request);
  if (reader === 'unconfigured') {
    return Response.json({ error: 'Accounts are not set up on this site.' }, { status: 503 });
  }
  if (!reader) {
    return Response.json({ error: 'Sign in to check your connections.' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Expected a JSON body' }, { status: 400 });
  }
  const input = parseCheckInput(body);
  if (typeof input === 'string') return Response.json({ error: input }, { status: 400 });

  const used = await usedToday(reader);
  if (used !== null && used >= DAILY_LIMIT) {
    return Response.json(
      { error: `You've used today's ${DAILY_LIMIT} checks. Try again tomorrow.`, remaining: 0 },
      { status: 429 },
    );
  }

  const client = typesafe();
  if (!client) {
    return Response.json({ error: 'The AI check is not set up on this site yet.' }, { status: 503 });
  }

  try {
    const { state, questions } = buildCheckRequest(input, verseForCheck, PREDEFINED_CONNECTION_TYPES);
    const res = await client.systemOne({ state, questions });
    const result = readCheckAnswers(res.answers as Record<string, unknown>, input);
    await recordCheck(reader, result.checked);
    return Response.json(
      { ...result, remaining: used === null ? undefined : Math.max(0, DAILY_LIMIT - used - 1) },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    if (error instanceof RateLimitError) {
      return Response.json({ error: 'The AI is busy. Try again in a minute.' }, { status: 503 });
    }
    if (error instanceof AuthenticationError) {
      console.error('[api/check] TypeSafe rejected the API key');
      return Response.json({ error: 'The AI check is not set up on this site yet.' }, { status: 503 });
    }
    console.error(`[api/check] TypeSafe failed: ${String(error)}`);
    return Response.json({ error: 'The AI check failed. Try again.' }, { status: 502 });
  }
}
