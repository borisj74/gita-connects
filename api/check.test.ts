/**
 * api/check.ts with Supabase and TypeSafe stubbed: who may call it, the daily
 * limit, and what a TypeSafe failure turns into.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const systemOne = vi.fn();
vi.mock('@typesafe-ai/sdk', () => {
  class TypeSafeError extends Error {}
  class AuthenticationError extends TypeSafeError {}
  class RateLimitError extends TypeSafeError {}
  return {
    TypeSafeClient: class {
      systemOne = systemOne;
    },
    AuthenticationError,
    RateLimitError,
  };
});

const { POST, DAILY_LIMIT } = await import('./check.js');

const body = {
  verses: ['2.47', '3.9'],
  links: [{ id: 'a', from: '2.47', to: '3.9', type: 'progression' }],
};

function call(token: string | null, payload: unknown = body) {
  return POST(
    new Request('http://local/api/check', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(payload),
    }),
  );
}

let used = 0;
const inserted: unknown[] = [];

beforeEach(() => {
  used = 0;
  inserted.length = 0;
  vi.stubEnv('SUPABASE_URL', 'https://db.example');
  vi.stubEnv('SUPABASE_ANON_KEY', 'anon');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service');
  vi.stubEnv('TYPESAFE_API_KEY', 'ts-key');
  systemOne.mockReset().mockResolvedValue({
    model: 'jev',
    usage: { input_tokens: 1, output_tokens: 1 },
    answers: {
      link_0_holds: { type: 'score', score: 2.7, confidence: 0.9 },
      link_0_type: { type: 'choice', choice: 'progression', confidence: 0.9 },
      reflect: { type: 'choice', choice: 'thread', confidence: 0.5 },
    },
  });
  vi.stubGlobal('fetch', vi.fn(async (url: URL | string, init?: RequestInit) => {
    const u = new URL(String(url));
    if (u.pathname === '/auth/v1/user') {
      const auth = new Headers(init?.headers).get('authorization');
      return auth === 'Bearer good'
        ? Response.json({ id: '00000000-0000-0000-0000-000000000001' })
        : new Response('{}', { status: 401 });
    }
    if (u.pathname === '/rest/v1/ai_checks' && (init?.method ?? 'GET') === 'GET') {
      return new Response('[]', { headers: { 'content-range': `0-0/${used}` } });
    }
    if (u.pathname === '/rest/v1/ai_checks') {
      inserted.push(JSON.parse(String(init?.body)));
      return new Response(null, { status: 201 });
    }
    return new Response('not stubbed', { status: 500 });
  }));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('POST /api/check', () => {
  it('refuses readers who are not signed in', async () => {
    expect((await call(null)).status).toBe(401);
    expect((await call('forged')).status).toBe(401);
    expect(systemOne).not.toHaveBeenCalled();
  });

  it('checks a signed-in reader\'s links and counts the check', async () => {
    const res = await call('good');
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.links).toEqual([{ id: 'a', holds: 2.7, verdict: 'strong' }]);
    expect(json.remaining).toBe(DAILY_LIMIT - 1);
    expect(inserted).toEqual([{ user_id: '00000000-0000-0000-0000-000000000001', links: 1 }]);
  });

  it('stops at the daily limit without calling the AI', async () => {
    used = DAILY_LIMIT;
    const res = await call('good');
    expect(res.status).toBe(429);
    expect(systemOne).not.toHaveBeenCalled();
  });

  it('rejects a malformed body', async () => {
    expect((await call('good', { verses: ['2.47'], links: [] })).status).toBe(400);
  });

  it('reports an AI failure without leaking details, and does not count it', async () => {
    systemOne.mockRejectedValue(new Error('upstream exploded'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await call('good');
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'The AI check failed. Try again.' });
    expect(inserted).toEqual([]);
  });

  it('says so when accounts or the AI key are not configured', async () => {
    vi.stubEnv('TYPESAFE_API_KEY', '');
    vi.stubEnv('CLAUDE_CODE_REMOTE', '');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await call('good')).status).toBe(503);
    vi.stubEnv('SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_URL', '');
    expect((await call('good')).status).toBe(503);
  });
});
