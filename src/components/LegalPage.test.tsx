import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LegalPage from './LegalPage.js';
import { CONTACT_EMAIL } from '../legal/documents.js';

describe('LegalPage', () => {
  it.each([
    ['privacy', 'Privacy Policy'],
    ['terms', 'Terms of Use'],
    ['cookies', 'Cookie Policy'],
  ] as const)('shows the %s page with its title, links to the others, and the contact address', (slug, title) => {
    render(<LegalPage slug={slug} />);
    expect(screen.getByRole('heading', { level: 1, name: title })).toBeTruthy();
    expect(document.title).toBe(`${title} · Gita Connects`);

    const tabs = screen.getByRole('navigation', { name: 'Policies' });
    const current = tabs.querySelector('[aria-current="page"]');
    expect(current?.textContent).toBe(title);
    expect(tabs.querySelectorAll('a')).toHaveLength(3);

    expect(screen.getAllByRole('link', { name: CONTACT_EMAIL }).length).toBeGreaterThan(0);
  });

  it('names the Serbian data protection authority and how to delete an account', () => {
    render(<LegalPage slug="privacy" />);
    expect(screen.getByRole('link', { name: 'poverenik.rs' })).toBeTruthy();
    expect(screen.getAllByText(/Delete my account/).length).toBeGreaterThan(0);
  });
});
