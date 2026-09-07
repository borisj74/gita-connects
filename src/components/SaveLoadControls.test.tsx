import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Node, Edge } from 'reactflow';
import SaveLoadControls from './SaveLoadControls.js';

const STORAGE_KEY = 'gita-connects-saved-networks';

const nodes = [{ id: '2.47', position: { x: 0, y: 0 }, data: {} }] as unknown as Node[];
const edges = [{ id: 'e1', source: '2.47', target: '3.30' }] as unknown as Edge[];

function setup(state: { nodes: Node[]; edges: Edge[] } = { nodes, edges }) {
  const onLoadNetwork = vi.fn();
  const user = userEvent.setup();
  render(
    <SaveLoadControls
      getNetworkState={() => state}
      selectedVerseId="2.47"
      onLoadNetwork={onLoadNetwork}
    />,
  );
  return { onLoadNetwork, user };
}

const stored = () => JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');

describe('SaveLoadControls — saving', () => {
  it('writes the network to localStorage under the given name', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Save network' }));
    await user.type(screen.getByPlaceholderText('e.g., Karma Yoga Study'), 'Karma study');
    await user.click(screen.getByRole('button', { name: 'Save Network' }));

    const saved = stored();
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      name: 'Karma study',
      selectedVerseId: '2.47',
    });
    expect(saved[0].nodes).toHaveLength(1);
    expect(saved[0].edges).toHaveLength(1);
  });

  it('trims whitespace from the name', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Save network' }));
    await user.type(screen.getByPlaceholderText('e.g., Karma Yoga Study'), '   Padded   ');
    await user.click(screen.getByRole('button', { name: 'Save Network' }));
    expect(stored()[0].name).toBe('Padded');
  });

  it('confirms the save to the user', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Save network' }));
    await user.type(screen.getByPlaceholderText('e.g., Karma Yoga Study'), 'Mine');
    await user.click(screen.getByRole('button', { name: 'Save Network' }));
    expect(screen.getByText('Network "Mine" saved!')).toBeInTheDocument();
  });

  it('disables the save button until a name is typed', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Save network' }));
    expect(screen.getByRole('button', { name: 'Save Network' })).toBeDisabled();

    await user.type(screen.getByPlaceholderText('e.g., Karma Yoga Study'), 'X');
    expect(screen.getByRole('button', { name: 'Save Network' })).toBeEnabled();
  });

  it('refuses to save an empty network', async () => {
    const { user } = setup({ nodes: [], edges: [] });
    await user.click(screen.getByRole('button', { name: 'Save network' }));
    expect(screen.getByText('No verses in network')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('e.g., Karma Yoga Study')).not.toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('saves on Enter', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Save network' }));
    await user.type(screen.getByPlaceholderText('e.g., Karma Yoga Study'), 'Enter save{Enter}');
    expect(stored()[0].name).toBe('Enter save');
  });

  it('surfaces a helpful error when storage is full', async () => {
    const { user } = setup();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });

    await user.click(screen.getByRole('button', { name: 'Save network' }));
    await user.type(screen.getByPlaceholderText('e.g., Karma Yoga Study'), 'Too big');
    await user.click(screen.getByRole('button', { name: 'Save Network' }));

    expect(
      screen.getByText(/browser storage is full/i),
    ).toBeInTheDocument();
  });

  it('shows the node and edge counts being saved', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Save network' }));
    expect(screen.getByText('1 verses')).toBeInTheDocument();
    expect(screen.getByText('1 connections')).toBeInTheDocument();
  });
});

describe('SaveLoadControls — loading', () => {
  const seed = (over: Record<string, unknown> = {}) =>
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          id: '1',
          name: 'Saved one',
          timestamp: 1_700_000_000_000,
          nodes,
          edges,
          selectedVerseId: '2.47',
          ...over,
        },
      ]),
    );

  it('shows an empty state when nothing is saved', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Load network' }));
    expect(screen.getByText('No saved networks yet')).toBeInTheDocument();
  });

  it('lists saved networks', async () => {
    seed();
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Load network' }));
    expect(screen.getByText('Saved one')).toBeInTheDocument();
  });

  it('hands the saved nodes, edges, and selection back on click', async () => {
    seed();
    const { user, onLoadNetwork } = setup();
    await user.click(screen.getByRole('button', { name: 'Load network' }));
    await user.click(screen.getByText('Saved one'));

    expect(onLoadNetwork).toHaveBeenCalledOnce();
    const [loadedNodes, loadedEdges, loadedSelection] = onLoadNetwork.mock.calls[0];
    expect(loadedNodes).toHaveLength(1);
    expect(loadedEdges).toHaveLength(1);
    expect(loadedSelection).toBe('2.47');
  });

  it('survives a corrupt storage payload', async () => {
    localStorage.setItem(STORAGE_KEY, '{not json');
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Load network' }));
    expect(screen.getByText('No saved networks yet')).toBeInTheDocument();
  });

  it('survives a non-array storage payload', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ id: 'nope' }));
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Load network' }));
    expect(screen.getByText('No saved networks yet')).toBeInTheDocument();
  });
});

describe('SaveLoadControls — deleting', () => {
  const seed = () =>
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { id: '1', name: 'Doomed', timestamp: 1, nodes, edges, selectedVerseId: null },
      ]),
    );

  it('asks for confirmation before deleting', async () => {
    seed();
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Load network' }));
    await user.click(screen.getByRole('button', { name: 'Delete network' }));

    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByText(/cannot be undone/i)).toBeInTheDocument();
    expect(stored()).toHaveLength(1);
  });

  it('keeps the network when the delete is cancelled', async () => {
    seed();
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Load network' }));
    await user.click(screen.getByRole('button', { name: 'Delete network' }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel' }));

    expect(stored()).toHaveLength(1);
    expect(screen.getByText('Doomed')).toBeInTheDocument();
  });

  it('removes the network from storage once confirmed', async () => {
    seed();
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Load network' }));
    await user.click(screen.getByRole('button', { name: 'Delete network' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(stored()).toEqual([]);
    expect(screen.getByText('No saved networks yet')).toBeInTheDocument();
  });

  it('does not load the network when its delete button is clicked', async () => {
    seed();
    const { user, onLoadNetwork } = setup();
    await user.click(screen.getByRole('button', { name: 'Load network' }));
    await user.click(screen.getByRole('button', { name: 'Delete network' }));
    expect(onLoadNetwork).not.toHaveBeenCalled();
  });
});
