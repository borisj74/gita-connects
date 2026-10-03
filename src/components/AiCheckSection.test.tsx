import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Edge } from 'reactflow';
import AiCheckSection from './AiCheckSection.js';
import { PREDEFINED_CONNECTION_TYPES } from '../connectionTypes.js';

const verses = new Set(['2.47', '3.9', '18.66']);
const edges: Edge[] = [
  // The reader's own link…
  { id: '2.47-3.9-thematic-user-abc', source: '2.47', target: '3.9', data: { typeId: 'thematic', description: 'User-created connection' } },
  // …and a scholarly one from the dataset, which is never sent.
  { id: '3.9-18.66-goal', source: '3.9', target: '18.66', data: { typeId: 'goal', description: 'Authored' } },
];

function setup(props: Partial<Parameters<typeof AiCheckSection>[0]> = {}) {
  const onSignIn = vi.fn();
  const onRetype = vi.fn();
  render(
    <AiCheckSection
      networkVerses={verses}
      networkEdges={edges}
      connectionTypes={PREDEFINED_CONNECTION_TYPES}
      cloudEnabled
      accessToken="token-123"
      onSignIn={onSignIn}
      onRetype={onRetype}
      {...props}
    />,
  );
  return { onSignIn, onRetype };
}

afterEach(() => vi.unstubAllGlobals());

describe('AiCheckSection', () => {
  it('is hidden on builds without accounts', () => {
    setup({ cloudEnabled: false });
    expect(screen.queryByText('Check with AI')).toBeNull();
  });

  it('asks signed-out readers to sign in', async () => {
    const { onSignIn } = setup({ accessToken: null });
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(onSignIn).toHaveBeenCalled();
  });

  it('waits for a connection of the reader\'s own', () => {
    setup({ networkEdges: [edges[1]] });
    expect(screen.getByText(/Draw a connection of your own/)).toBeTruthy();
  });

  it('sends only the reader\'s links with their token, shows verdicts, and applies a suggested type', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        links: [{ id: '2.47-3.9-thematic-user-abc', holds: 1.1, verdict: 'weak', suggestedType: 'progression' }],
        theme: { concept: 'duty', confidence: 0.7 },
        question: 'How does this path move from the problem to its resolution?',
        checked: 1,
        total: 1,
        remaining: 19,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { onRetype } = setup();

    await userEvent.click(screen.getByRole('button', { name: 'Check my connections (1)' }));
    await waitFor(() => expect(screen.getByText('Weak link')).toBeTruthy());

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer token-123');
    const sent = JSON.parse(String(init.body));
    expect(sent.links).toEqual([{ id: '2.47-3.9-thematic-user-abc', from: '2.47', to: '3.9', type: 'thematic' }]);

    expect(screen.getByText('duty')).toBeTruthy();
    expect(screen.getByText(/19 checks left today/)).toBeTruthy();
    expect(screen.getByText(/problem to its resolution/)).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'Change' }));
    expect(onRetype).toHaveBeenCalledWith('2.47-3.9-thematic-user-abc', 'progression');
    expect(screen.getByText(/Changed to Progression/)).toBeTruthy();
  });

  it('shows the server\'s message when the check fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: "You've used today's 20 checks." }, { status: 429 })));
    setup();
    await userEvent.click(screen.getByRole('button', { name: /Check my connections/ }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/today's 20 checks/));
  });
});
