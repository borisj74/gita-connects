/**
 * api/account.ts with Supabase stubbed: only the signed-in reader can delete,
 * and only their own account.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DELETE } from './account.js';

const READER = '00000000-0000-0000-0000-000000000001';
let adminStatus = 200;
const deleted: string[] = [];

function call(token: string | null) {
  return DELETE(
    new Request('http://local/api/account', {
      method: 'DELETE',
      headers: token ? { authorization: `Bearer ${token}` } : {},
    }),
  );
}

beforeEach(() => {
  adminStatus = 200;
  deleted.length = 0;
  vi.stubEnv('SUPABASE_URL', 'https://db.example');
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_x');
  vi.stubEnv('SUPABASE_SECRET_KEY', 'sb_secret_x');
  vi.stubGlobal('fetch', vi.fn(async (url: URL | string, init?: RequestInit) => {
    const u = new URL(String(url));
    const headers = new Headers(init?.headers);
    if (u.pathname === '/auth/v1/user') {
      return headers.get('authorization') === 'Bearer good'
        ? Response.json({ id: READER })
        : new Response('{}', { status: 401 });
    }
    if (u.pathname.startsWith('/auth/v1/admin/users/') && init?.method === 'DELETE') {
      if (headers.get('apikey') !== 'sb_secret_x') return new Response('{}', { status: 401 });
      deleted.push(decodeURIComponent(u.pathname.split('/').pop()!));
      return new Response('{}', { status: adminStatus });
    }
    return new Response('not stubbed', { status: 500 });
  }));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('DELETE /api/account', () => {
  it('refuses readers who are not signed in', async () => {
    expect((await call(null)).status).toBe(401);
    expect((await call('forged')).status).toBe(401);
    expect(deleted).toEqual([]);
  });

  it("deletes the signed-in reader's own account with the secret key", async () => {
    const res = await call('good');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deleted: true });
    expect(deleted).toEqual([READER]);
  });

  it('treats an account that is already gone as deleted', async () => {
    adminStatus = 404;
    expect((await call('good')).status).toBe(200);
  });

  it('reports a failure from Supabase', async () => {
    adminStatus = 500;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await call('good')).status).toBe(502);
  });

  it('says so when the secret key is missing', async () => {
    vi.stubEnv('SUPABASE_SECRET_KEY', '');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await call('good');
    expect(res.status).toBe(503);
    expect(deleted).toEqual([]);
  });
});
