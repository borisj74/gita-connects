/**
 * "Delete my account": removes the signed-in reader from Supabase Auth.
 *
 * Every table that holds a reader's data (networks, notes, link_types,
 * preferences, ai_checks) references auth.users with ON DELETE CASCADE, so
 * deleting the user deletes all of it in one step. Copies kept in the
 * reader's own browser are not touched; the app says so before confirming.
 *
 * The reader proves who they are with their own access token, verified with
 * Supabase; only then does the secret key, which never leaves the server,
 * delete that one user.
 */
import { readerId, serviceHeaders, supabaseUrl } from './_supabase.js';

export async function DELETE(request: Request): Promise<Response> {
  const reader = await readerId(request);
  if (reader === 'unconfigured') {
    return Response.json({ error: 'Accounts are not set up on this site.' }, { status: 503 });
  }
  if (!reader) {
    return Response.json({ error: 'Sign in again to delete your account.' }, { status: 401 });
  }

  const base = supabaseUrl();
  const headers = serviceHeaders();
  if (!base || !headers) {
    console.error('[api/account] SUPABASE_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY is not set');
    return Response.json(
      { error: "Account deletion isn't available right now. Email hello@gitaconnects.com and we'll do it for you." },
      { status: 503 },
    );
  }

  try {
    const res = await fetch(new URL(`/auth/v1/admin/users/${encodeURIComponent(reader)}`, base), {
      method: 'DELETE',
      headers,
      signal: AbortSignal.timeout(10_000),
    });
    // Already gone counts as done: a retry after a dropped response must not fail.
    if (!res.ok && res.status !== 404) {
      console.error(`[api/account] Supabase answered ${res.status} deleting a user`);
      return Response.json({ error: "We couldn't delete your account. Try again." }, { status: 502 });
    }
  } catch (error) {
    console.error(`[api/account] Delete failed: ${String(error)}`);
    return Response.json({ error: "We couldn't delete your account. Try again." }, { status: 502 });
  }

  return Response.json({ deleted: true }, { headers: { 'Cache-Control': 'no-store' } });
}
