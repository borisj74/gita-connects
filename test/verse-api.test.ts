/**
 * api/verse.ts picks the first source that has a verse: the local copy of the
 * book, then the private Supabase table, then vedabase.io. Here outside src/
 * (whose tsconfig has browser types only) and outside api/ (where every file
 * deploys as a function).
 */
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const section = { sanskrit: 'S', transliteration: 'T', synonyms: 'Y', translation: 'X', purport: ['P'] };
const cwd = process.cwd();

/** Load api/verse.ts fresh (it caches the local copy) from a clean directory. */
async function reader(withLocalCopy = false) {
  const dir = mkdtempSync(join(tmpdir(), 'verse-api-'));
  if (withLocalCopy) {
    mkdirSync(join(dir, 'private', 'bbt'), { recursive: true });
    writeFileSync(join(dir, 'private', 'bbt', 'bg.json'), JSON.stringify({ pages: { '1/16-18': section } }));
  }
  process.chdir(dir);
  vi.resetModules();
  const { GET } = await import('../api/verse.js');
  return (chapter: number, verse: number) => GET(new Request(`http://x/api/verse?chapter=${chapter}&verse=${verse}`));
}

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  process.chdir(cwd);
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('api/verse sources', () => {
  it('serves the local copy without any network request', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://project.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'eyJ.service.jwt');
    const get = await reader(true);
    const res = await get(1, 17);
    expect(await res.json()).toMatchObject({ id: '1.17', translation: 'X', purport: ['P'] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reads the Supabase table with the server key when there is no local copy', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://project.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'eyJ.service.jwt');
    fetchMock.mockResolvedValue(Response.json([section]));
    const get = await reader();
    const res = await get(1, 17);

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: '1.17', translation: 'X', source: 'https://vedabase.io/en/library/bg/1/16-18/' });
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.origin + url.pathname).toBe('https://project.supabase.co/rest/v1/bbt_verses');
    expect(url.searchParams.get('page')).toBe('eq.1/16-18');
    expect(init.headers).toEqual({ apikey: 'eyJ.service.jwt', Authorization: 'Bearer eyJ.service.jwt' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('sends an sb_secret_ key in apikey only', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://project.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'sb_secret_abc');
    fetchMock.mockResolvedValue(Response.json([section]));
    await (await reader())(2, 47);
    expect((fetchMock.mock.calls[0] as [URL, RequestInit])[1].headers).toEqual({ apikey: 'sb_secret_abc' });
  });

  it('falls back to Vedabase when the table has no row', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://project.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'eyJ.service.jwt');
    fetchMock.mockResolvedValueOnce(Response.json([])).mockResolvedValueOnce(new Response('', { status: 403 }));
    const res = await (await reader())(2, 47);
    expect(fetchMock.mock.calls[1][0]).toBe('https://vedabase.io/en/library/bg/2/47/');
    expect(res.status).toBe(502);
  });

  it('goes straight to Vedabase when Supabase is not configured', async () => {
    vi.stubEnv('SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    fetchMock.mockResolvedValue(new Response('', { status: 403 }));
    await (await reader())(2, 47);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('https://vedabase.io/en/library/bg/2/47/');
  });
});
