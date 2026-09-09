import { useState } from 'react';
import { supabase, friendlyError } from './supabase.js';

export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type MagicLinkStatus = 'idle' | 'sending' | 'sent';

/**
 * The magic-link half of signing in, shared by the account dialog and the
 * sign-in page so the two cannot drift apart.
 */
export function useMagicLink() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<MagicLinkStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const valid = EMAIL.test(email);

  const send = async () => {
    if (!supabase || !valid) return;
    setStatus('sending');
    setError(null);
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      // The allow-list patterns end in /**, which a bare origin does not
      // match; without the slash a preview or localhost link lands on
      // production instead of back where the reader started.
      options: { emailRedirectTo: `${window.location.origin}/` },
    });
    if (err) {
      setError(friendlyError(err));
      setStatus('idle');
    } else {
      setStatus('sent');
    }
  };

  return { email, setEmail, status, error, valid, send };
}
