import { Mail, Check, ArrowLeft, Cloud, NotebookPen, Share2 } from 'lucide-react';
import { cloudEnabled } from '../cloud/supabase.js';
import { useMagicLink } from '../cloud/useMagicLink.js';
import './SignInPage.css';

/**
 * A sign-in page at its own address, so an account can be offered in a link
 * or an email rather than only behind a button in the toolbar.
 *
 * It is a door, not a gate: the app works fully without an account, so the
 * way back in is a first-class action here rather than fine print.
 */
export default function SignInPage() {
  const { email, setEmail, status, error, valid, send } = useMagicLink();

  return (
    <main className="signin-page">
      <div className="signin-card">
        <a className="signin-back" href="/">
          <ArrowLeft size={15} />
          Back to the canvas
        </a>

        <h1 className="signin-title">Keep your work</h1>
        <p className="signin-lede">
          An account carries your networks, notes and link types to any device you read on.
          Everything already on this one stays exactly where it is.
        </p>

        {status === 'sent' ? (
          <p className="signin-sent" role="status">
            <Check size={18} />
            <span>
              Check <strong>{email}</strong> for a link. Open it on this device to finish signing
              in.
            </span>
          </p>
        ) : (
          <form
            className="signin-form"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <label className="signin-label" htmlFor="signin-email">
              Email address
            </label>
            <input
              id="signin-email"
              type="email"
              className="signin-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              autoFocus
              disabled={status === 'sending' || !cloudEnabled}
            />
            {error && (
              <p className="signin-error" role="alert">
                {error}
              </p>
            )}
            {!cloudEnabled && (
              <p className="signin-error" role="alert">
                Accounts are unavailable in this build. Your work is still saved on this device.
              </p>
            )}
            <button
              type="submit"
              className="signin-submit"
              disabled={status === 'sending' || !valid || !cloudEnabled}
            >
              <Mail size={16} />
              {status === 'sending' ? 'Sending…' : 'Email me a link'}
            </button>
            <p className="signin-note">
              No password to choose or reset. We store your email address and the work you make,
              nothing else.
            </p>
          </form>
        )}

        <ul className="signin-perks">
          <li>
            <Cloud size={16} aria-hidden="true" />
            <span>Saved networks on every device</span>
          </li>
          <li>
            <NotebookPen size={16} aria-hidden="true" />
            <span>Your notes travel with the verses</span>
          </li>
          <li>
            <Share2 size={16} aria-hidden="true" />
            <span>Custom link types stay yours</span>
          </li>
        </ul>
      </div>

      <p className="signin-optout">
        Rather not?{' '}
        <a href="/">Keep reading without an account</a> — nothing here is locked.
      </p>
    </main>
  );
}
