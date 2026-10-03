/**
 * The privacy policy, terms of use and cookie policy, written from what the
 * app actually does. When the app changes what it collects, stores or sends
 * (a new service, analytics, a new kind of saved data), these change with it
 * and LEGAL_UPDATED moves forward.
 */
import type { ReactNode } from 'react';

export const CONTACT_EMAIL = 'hello@gitaconnects.com';
export const LEGAL_UPDATED = '3 October 2026';

export type LegalSlug = 'privacy' | 'terms' | 'cookies';

export interface LegalDocument {
  slug: LegalSlug;
  title: string;
  /** One or two sentences: the whole document in brief. */
  summary: string;
  body: ReactNode;
}

const mail = <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;

const privacy: LegalDocument = {
  slug: 'privacy',
  title: 'Privacy Policy',
  summary:
    'You can use Gita Connects without an account, and then your work stays in your browser. If you sign in, we store your email address and the work you choose to sync, and nothing else about you. We do not sell data, show ads or track you.',
  body: (
    <>
      <h2>Who we are</h2>
      <p>
        Gita Connects (gitaconnects.com) is an independent project run from Serbia. We are the
        controller of the personal data described here. For anything about your data, email{' '}
        {mail}.
      </p>
      <p>
        This policy is written to meet Serbia's Law on Personal Data Protection and the EU General
        Data Protection Regulation (GDPR).
      </p>

      <h2>Using the app without an account</h2>
      <p>
        Your canvas, saved networks, notes, link types and settings are kept in your own
        browser's storage. They never leave your device and we cannot see them. Clearing your
        browser's data for this site deletes them. The <a href="/cookies">Cookie Policy</a> lists
        exactly what is stored.
      </p>
      <p>
        When you open a verse, our server fetches its text for you. That request carries the
        verse number, not anything about you.
      </p>

      <h2>What we collect, and why</h2>
      <table>
        <thead>
          <tr>
            <th>What</th>
            <th>Why</th>
            <th>Legal basis</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Your email address, if you sign in</td>
            <td>To send you sign-in links and keep your account</td>
            <td>Providing the service you asked for (contract)</td>
          </tr>
          <tr>
            <td>Your synced work: saved networks, notes, custom link types and preferences</td>
            <td>To keep your work across devices</td>
            <td>Contract</td>
          </tr>
          <tr>
            <td>A record of each Check with AI you run: when, and how many connections (no content)</td>
            <td>To hold each reader to a daily limit of 20 checks</td>
            <td>Our legitimate interest in keeping the service fair and affordable</td>
          </tr>
          <tr>
            <td>What you send with Check with AI: the verses' themes, summaries and concepts, the connections you drew, and your notes on them</td>
            <td>To judge whether your connections hold. Sent only when you press the button</td>
            <td>Contract</td>
          </tr>
          <tr>
            <td>Technical data in server logs, such as your IP address, browser type and the time of a request</td>
            <td>To run the site securely and fix problems</td>
            <td>Legitimate interest</td>
          </tr>
        </tbody>
      </table>
      <p>
        We do not use your data for advertising, we do not sell it, and we do not build profiles
        about you. The translation and purport of <em>Bhagavad-gītā As It Is</em> are never sent to
        any AI service.
      </p>

      <h2>Who processes data for us</h2>
      <p>We use a small number of service providers, each bound by a data processing agreement:</p>
      <ul>
        <li>
          <strong>Vercel</strong>: hosts the site and runs our server functions. Keeps short-lived
          request logs.
        </li>
        <li>
          <strong>Supabase</strong>: our database and sign-in system. Stores your account and
          synced work.
        </li>
        <li>
          <strong>Resend</strong>: sends sign-in emails from login@mail.gitaconnects.com.
        </li>
        <li>
          <strong>TypeSafe</strong>: the AI service behind Check with AI. Receives only what is
          described above, and only when you run a check.
        </li>
      </ul>
      <p>
        Some of these providers process data outside Serbia, including in the European Union and
        the United States. Where that happens, the transfer is protected by the safeguards the law
        requires, such as the European Commission's standard contractual clauses.
      </p>
      <p>
        The app's fonts are served from our own domain, so loading the site does not contact Google
        or any other third party.
      </p>

      <h2>How long we keep it</h2>
      <ul>
        <li>
          <strong>Account, synced work and Check with AI records</strong>: until you delete them
          or your account.
        </li>
        <li>
          <strong>Server logs</strong>: for the short period our hosting provider keeps them,
          typically days, not months.
        </li>
        <li>
          <strong>Work saved only in your browser</strong>: until you delete it. The automatic
          session save expires after 7 days.
        </li>
      </ul>

      <h2>Your rights</h2>
      <p>You have the right to:</p>
      <ul>
        <li>see the personal data we hold about you and get a copy of it</li>
        <li>have it corrected</li>
        <li>have it deleted</li>
        <li>restrict or object to how we use it</li>
        <li>take it with you in a common format (data portability)</li>
        <li>withdraw consent at any time, where we rely on consent</li>
      </ul>
      <p>
        <strong>To delete your account</strong>, open the menu, choose <em>Your account</em>, then{' '}
        <em>Delete my account</em>. This deletes your account and everything synced to it at once.
        For any other request, email {mail}. We answer within 30 days.
      </p>
      <p>
        You can also complain to the Commissioner for Information of Public Importance and Personal
        Data Protection of the Republic of Serbia (
        <a href="https://www.poverenik.rs" target="_blank" rel="noreferrer">
          poverenik.rs
        </a>
        ), or, if you live in the EU, to your local data protection authority.
      </p>

      <h2>Security</h2>
      <p>
        Data travels over encrypted connections. Each reader's synced work is protected by access
        rules in the database, so no one else can read it. Sign-in uses one-time email links, so
        there are no passwords to leak.
      </p>

      <h2>Children</h2>
      <p>
        Gita Connects is not aimed at children. If you are under 15, please ask a parent or guardian
        before creating an account.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        If we change what we collect or how we use it, for example by adding analytics, we will
        update this page and its date before the change takes effect. Anything that needs your
        consent will ask for it first.
      </p>
    </>
  ),
};

const terms: LegalDocument = {
  slug: 'terms',
  title: 'Terms of Use',
  summary:
    'Gita Connects is free to use for study and teaching. Your notes and networks are yours. Please respect the copyright of the Bhagavad-gītā text, and treat AI judgements as opinions, not authority.',
  body: (
    <>
      <h2>About these terms</h2>
      <p>
        These terms apply when you use gitaconnects.com. By using the site, or by signing in, you
        agree to them. If you don't agree, please don't use the site. Questions: {mail}.
      </p>

      <h2>The service</h2>
      <p>
        Gita Connects helps you explore connections between verses of the Bhagavad Gita. It is free
        and offered as it is. We work to keep it accurate and available, but we can't promise it
        will always be either, and we may change, pause or end features at any time.
      </p>

      <h2>Your account</h2>
      <p>
        An account is optional. If you create one, keep access to your email address secure, since
        sign-in links are sent there. You can delete your account at any time from{' '}
        <em>Your account</em> in the menu.
      </p>

      <h2>Your content</h2>
      <p>
        The networks, connections and notes you create belong to you. You give us permission to
        store and process them only as needed to run the service for you, for example to sync them
        to your other devices, or to send them to Check with AI when you ask for a check.
      </p>

      <h2>The text of the Bhagavad Gita</h2>
      <p>
        The translation and purport of <em>Bhagavad-gītā As It Is</em> by A.C. Bhaktivedanta Swami
        Prabhupada are © The Bhaktivedanta Book Trust International, Inc., and are shown here with
        its permission for reading within the app. You may not copy, scrape, republish or
        redistribute that text from this site. The Sanskrit and transliteration come from a public
        domain source. The app's own themes, summaries and connections are ours.
      </p>

      <h2>Check with AI</h2>
      <p>
        AI verdicts and suggestions are automated opinions. They can be wrong, and they are not
        spiritual or scholarly authority. Use them as prompts for your own reflection. Each
        signed-in reader can run 20 checks a day.
      </p>

      <h2>Fair use</h2>
      <p>Please don't:</p>
      <ul>
        <li>try to get around the daily limits or other protections</li>
        <li>access the site with bots or scripts to collect its content</li>
        <li>interfere with the site or other readers' use of it</li>
        <li>use the site for anything unlawful</li>
      </ul>
      <p>We may suspend accounts that do.</p>

      <h2>Liability</h2>
      <p>
        To the extent the law allows, we are not liable for indirect losses, or for loss of data
        you have not backed up, arising from your use of the site. Nothing in these terms limits
        rights you have as a consumer that cannot be limited by contract.
      </p>

      <h2>Law</h2>
      <p>
        These terms are governed by the law of the Republic of Serbia. If you live elsewhere, you
        keep the protection of the mandatory consumer laws of your country.
      </p>

      <h2>Changes</h2>
      <p>
        We may update these terms. The date at the top shows the latest version. If a change is
        significant, we will say so in the app.
      </p>
    </>
  ),
};

const cookies: LegalDocument = {
  slug: 'cookies',
  title: 'Cookie Policy',
  summary:
    'Gita Connects sets no cookies today. It uses your browser\'s storage only to keep your work, your settings and, if you sign in, your session. If we add analytics, we will ask before turning them on.',
  body: (
    <>
      <h2>Cookies and browser storage</h2>
      <p>
        Cookies are small files a website saves in your browser. Browser storage ("local storage")
        works the same way and is treated the same way by the law. Gita Connects sets{' '}
        <strong>no cookies</strong> at the moment, and it uses local storage only for things that
        are needed for the app to work or that remember choices you made. Those don't require
        consent, but we list them here so you know exactly what is kept.
      </p>
      <p>Nothing stored here is shared with anyone, and none of it is used for tracking or ads.</p>

      <h2>What we store in your browser</h2>
      <table>
        <thead>
          <tr>
            <th>What</th>
            <th>Purpose</th>
            <th>How long</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Sign-in session</td>
            <td>Keeps you signed in. Only if you sign in.</td>
            <td>Until you sign out</td>
          </tr>
          <tr>
            <td>Your work: saved networks, notes and custom link types</td>
            <td>Keeps what you create on this device</td>
            <td>Until you delete it</td>
          </tr>
          <tr>
            <td>Automatic session save</td>
            <td>Lets you pick up where you left off</td>
            <td>7 days</td>
          </tr>
          <tr>
            <td>Settings: theme, link type filters, open panel sections, panel position</td>
            <td>Remembers how you like the app</td>
            <td>Until you change or clear them</td>
          </tr>
          <tr>
            <td>Hints you've dismissed</td>
            <td>Stops showing tips you've already read</td>
            <td>Until you clear them</td>
          </tr>
        </tbody>
      </table>

      <h2>Clearing it</h2>
      <p>
        You can delete all of it in your browser's settings by clearing site data for
        gitaconnects.com. That signs you out and removes any work saved only in this browser, so
        save or sync anything you want to keep first.
      </p>

      <h2>Analytics in the future</h2>
      <p>
        We may add analytics to learn which features help readers most. If we do, we will choose a
        privacy-friendly tool, update this page and the <a href="/privacy">Privacy Policy</a>{' '}
        first, and, if the tool needs your consent, ask you before it runs. You will be able to
        change your mind at any time.
      </p>

      <h2>Questions</h2>
      <p>
        Email {mail}.
      </p>
    </>
  ),
};

export const LEGAL_DOCUMENTS: Record<LegalSlug, LegalDocument> = { privacy, terms, cookies };
