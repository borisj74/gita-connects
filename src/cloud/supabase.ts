/**
 * The Supabase client, or null when the app is built without cloud keys.
 *
 * Signing in is optional: everything works from localStorage alone, so a
 * build with no keys (a fork, an offline copy) must still run. Every caller
 * therefore treats `supabase` as possibly absent rather than assuming it.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** Whether this build can talk to a cloud account at all. */
export const cloudEnabled = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = cloudEnabled
  ? createClient(url as string, anonKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

/** Human-readable message for a Supabase error, safe to show in the UI. */
export function friendlyError(error: unknown): string {
  if (!error) return 'Something went wrong.';
  const message = error instanceof Error ? error.message : String(error);
  if (/rate limit|too many/i.test(message)) return 'Too many attempts. Try again in a few minutes.';
  if (/invalid|not found/i.test(message)) return 'That did not work. Check the address and try again.';
  if (/network|fetch/i.test(message)) return 'No connection. Check your network and try again.';
  return message;
}
