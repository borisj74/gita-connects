import { useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { LEGAL_DOCUMENTS, LEGAL_UPDATED, CONTACT_EMAIL, type LegalSlug } from '../legal/documents.js';
import './LegalPage.css';

const ORDER: LegalSlug[] = ['privacy', 'terms', 'cookies'];

/**
 * The privacy policy, terms and cookie policy, each at its own address
 * (/privacy, /terms, /cookies) so they can be linked from emails and the
 * sign-in form. Plain reading pages: no canvas, no account needed.
 */
export default function LegalPage({ slug }: { slug: LegalSlug }) {
  const doc = LEGAL_DOCUMENTS[slug];

  useEffect(() => {
    document.title = `${doc.title} · Gita Connects`;
  }, [doc.title]);

  return (
    <main className="legal-page">
      <div className="legal-column">
        <a className="legal-back" href="/">
          <ArrowLeft size={15} aria-hidden="true" />
          Back to the canvas
        </a>

        <nav className="legal-tabs" aria-label="Policies">
          {ORDER.map((s) => (
            <a
              key={s}
              href={`/${s}`}
              className={`legal-tab ${s === slug ? 'is-current' : ''}`}
              aria-current={s === slug ? 'page' : undefined}
            >
              {LEGAL_DOCUMENTS[s].title}
            </a>
          ))}
        </nav>

        <article className="legal-doc">
          <h1 className="legal-title">{doc.title}</h1>
          <p className="legal-updated">Last updated {LEGAL_UPDATED}</p>
          <p className="legal-summary">{doc.summary}</p>
          {doc.body}
        </article>

        <footer className="legal-footer">
          Questions about this page? Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </footer>
      </div>
    </main>
  );
}
