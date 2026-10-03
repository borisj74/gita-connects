import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Session } from '@supabase/supabase-js';

const signOut = vi.fn(async () => ({ error: null }));
vi.mock('../cloud/supabase.js', () => ({
  supabase: { auth: { signOut } },
  cloudEnabled: true,
  friendlyError: (e: unknown) => String(e),
}));

const { default: AccountDialog } = await import('./AccountDialog.js');

const session = {
  access_token: 'token-123',
  user: { id: 'u1', email: 'reader@example.com' },
} as unknown as Session;

afterEach(() => {
  vi.unstubAllGlobals();
  signOut.mockClear();
});

describe('AccountDialog', () => {
  it('links the terms and privacy policy when signing in', () => {
    render(<AccountDialog session={null} onClose={() => {}} />);
    expect(screen.getByRole('link', { name: 'Terms' }).getAttribute('href')).toBe('/terms');
    expect(screen.getByRole('link', { name: 'Privacy Policy' }).getAttribute('href')).toBe('/privacy');
  });

  it('asks before deleting, and keeping the account changes nothing', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<AccountDialog session={session} onClose={() => {}} />);

    await userEvent.click(screen.getByRole('button', { name: /Delete my account/ }));
    expect(screen.getByText('Delete your account?')).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Keep my account' }));

    await userEvent.click(screen.getByRole('button', { name: 'Keep my account' }));
    expect(screen.queryByText('Delete your account?')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('deletes with the reader\'s token, then signs out on this device only', async () => {
    const fetchMock = vi.fn(async () => Response.json({ deleted: true }));
    vi.stubGlobal('fetch', fetchMock);
    render(<AccountDialog session={session} onClose={() => {}} />);

    await userEvent.click(screen.getByRole('button', { name: /Delete my account/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete permanently' }));

    await waitFor(() => expect(screen.getByText('Account deleted')).toBeTruthy());
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/account');
    expect(init.method).toBe('DELETE');
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer token-123');
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('shows the server\'s message and keeps the reader signed in when deletion fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: "We couldn't delete your account. Try again." }, { status: 502 })));
    render(<AccountDialog session={session} onClose={() => {}} />);

    await userEvent.click(screen.getByRole('button', { name: /Delete my account/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete permanently' }));

    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/couldn't delete/));
    expect(signOut).not.toHaveBeenCalled();
  });
});
