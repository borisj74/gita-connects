import { useEffect, useRef, useState } from 'react';
import { X, Mail, LogOut, Check } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { supabase, friendlyError } from '../cloud/supabase.js';
import { accountLabel } from '../cloud/useSession.js';
import { useSyncStatus } from '../cloud/sync.js';
import ScrimHint from './ScrimHint.js';
import './AccountDialog.css';

interface AccountDialogProps {
  session: Session | null;
  onClose: () => void;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Sign in, or see who is signed in and sign out.
 *
 * Sign-in is a magic link: the reader gets an email, clicks it, and comes back
 * signed in. No password to choose, store or reset. An account is optional —
 * the copy says so, because the app works fully without one.
 */
const syncWording: Record<string, string> = {
  off: 'Not syncing',
  syncing: 'Syncing…',
  synced: 'Everything is up to date',
  error: 'Could not sync',
};

export default function AccountDialog({ session, onClose }: AccountDialogProps) {
  const sync = useSyncStatus();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    firstRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled)',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      opener?.focus?.();
    };
  }, [onClose]);

  const sendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !EMAIL.test(email)) return;
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

  const signOut = async () => {
    await supabase?.auth.signOut();
    onClose();
  };

  return (
    <div className="modal-overlay saved-dialog-overlay" onClick={onClose}>
      <ScrimHint label="Click anywhere to close" />
      <div
        ref={dialogRef}
        className="saved-dialog account-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="saved-dialog-header">
          <div>
            <h2 id="account-title" className="saved-dialog-title">
              {session ? 'Your account' : 'Sign in'}
            </h2>
            <p className="saved-dialog-subtitle">
              {session
                ? 'Your networks and notes follow you to any device.'
                : 'Optional. Keep your networks and notes across devices.'}
            </p>
          </div>
          <button
            ref={session ? (firstRef as React.RefObject<HTMLButtonElement>) : undefined}
            type="button"
            className="saved-dialog-close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {session ? (
          <div className="account-body">
            <p className="account-who">
              <span className="account-avatar" aria-hidden="true">
                {accountLabel(session).slice(0, 1).toUpperCase()}
              </span>
              <span>
                <span className="account-email">{accountLabel(session)}</span>
                <span className={`account-note account-sync is-${sync.status}`}>
                  {sync.status === 'error' && sync.message ? sync.message : syncWording[sync.status]}
                </span>
              </span>
            </p>
          </div>
        ) : status === 'sent' ? (
          <div className="account-body">
            <p className="account-sent">
              <Check size={18} />
              Check <strong>{email}</strong> for a link. Open it on this device to finish signing in.
            </p>
          </div>
        ) : (
          <form className="account-body" onSubmit={sendLink}>
            <label className="account-label" htmlFor="account-email">
              Email address
            </label>
            <input
              ref={firstRef as React.RefObject<HTMLInputElement>}
              id="account-email"
              type="email"
              className="account-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              disabled={status === 'sending'}
            />
            {error && (
              <p className="account-error" role="alert">
                {error}
              </p>
            )}
            <button
              type="submit"
              className="saved-btn-primary account-submit"
              disabled={status === 'sending' || !EMAIL.test(email)}
            >
              <Mail size={16} />
              {status === 'sending' ? 'Sending…' : 'Email me a link'}
            </button>
          </form>
        )}

        <div className="saved-dialog-footer">
          <p className="saved-dialog-note">
            {session
              ? 'Signing out leaves this device’s copy in place.'
              : 'No password to remember. We store your email and your own work, nothing else.'}
          </p>
          <div className="saved-footer-actions">
            {session ? (
              <button type="button" className="saved-btn-secondary" onClick={signOut}>
                <LogOut size={15} />
                Sign out
              </button>
            ) : (
              <button type="button" className="saved-btn-secondary" onClick={onClose}>
                Not now
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
