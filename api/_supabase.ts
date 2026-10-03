/**
 * Supabase access shared by the server functions. The leading underscore
 * keeps Vercel from deploying this file as a function of its own.
 */

export const supabaseUrl = () => process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;

// The browser's own key comes first: it is the one sign-in is known to work
// with. The Supabase integration's variables are locked in Vercel and can lag
// behind a key rotation, so its newer publishable key is tried before the
// legacy anon key.
export const anonKey = () =>
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY;

/** The newer sb_secret_ key when the integration provides it, else the legacy service-role key. */
export const secretKey = () => process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

/** The signed-in reader's id, or null when the token is missing or invalid. */
export async function readerId(request: Request): Promise<string | null | 'unconfigured'> {
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

/** Headers for the secret key, or null when it is not configured. */
export function serviceHeaders(): Record<string, string> | null {
  const key = secretKey();
  if (!key) return null;
  // Legacy keys are JWTs and go in both headers; sb_secret_ keys in apikey alone.
  const headers: Record<string, string> = { apikey: key };
  if (!key.startsWith('sb_')) headers.Authorization = `Bearer ${key}`;
  return headers;
}
