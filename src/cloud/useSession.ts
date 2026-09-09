/**
 * Who is signed in, as a React hook.
 *
 * Supabase keeps the session in localStorage and refreshes it in the
 * background; this mirrors it into React state so the UI can react to sign-in
 * and sign-out without prop-drilling. Returns null both while loading and
 * when signed out — callers that need to tell them apart use `loading`.
 */
import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase.js';

export interface SessionState {
  session: Session | null;
  loading: boolean;
}

export function useSession(): SessionState {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));

  useEffect(() => {
    if (!supabase) return;
    let alive = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, loading };
}

/** Display name for the signed-in reader: their email, or a fallback. */
export function accountLabel(session: Session | null): string {
  return session?.user.email ?? session?.user.user_metadata?.name ?? 'Signed in';
}
