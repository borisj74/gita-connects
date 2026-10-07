import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactFlowProvider } from 'reactflow';
import VerseNode from './VerseNode.js';
import type { Verse } from '../types.js';

const verse: Verse = {
  chapter: 2,
  verse: 47,
  id: '2.47',
  sanskrit: 'कर्मण्येवाधिकारस्ते',
  transliteration: 'karmany evadhikaras te',
  theme: 'Selfless action',
  concepts: ['duty', 'detachment'],
  summary: 'You have a right to action alone, never to its fruits.',
  curated: true,
  reviewed: true,
};

function renderNode(data: Partial<Parameters<typeof VerseNode>[0]['data']> = {}) {
  const onSelect = vi.fn();
  const onRemove = vi.fn();
  const onExpand = vi.fn();
  render(
    <ReactFlowProvider>
      <VerseNode
        data={{ verse, onSelect, onRemove, onExpand, isSelected: false, ...data }}
      />
    </ReactFlowProvider>,
  );
  return { onSelect, onRemove, onExpand };
}

// Placeholder text: the book's real translation is never committed.
const TRANSLATION = 'Translation text for this verse.';

describe('VerseNode', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ translation: TRANSLATION }))));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('renders the verse id, theme, translation, and concepts', async () => {
    renderNode();
    expect(screen.getByText('2.47')).toBeInTheDocument();
    expect(screen.getByText('Selfless action')).toBeInTheDocument();
    expect(await screen.findByText(TRANSLATION)).toBeInTheDocument();
    expect(screen.getByText('duty')).toBeInTheDocument();
    expect(screen.getByText('detachment')).toBeInTheDocument();
  });

  it('leads with the translation even when the verse has a summary', async () => {
    renderNode({ verse: { ...verse, id: '2.48' } });
    expect(await screen.findByText(TRANSLATION)).toBeInTheDocument();
    expect(screen.queryByText(verse.summary!)).not.toBeInTheDocument();
  });

  it('calls onSelect when the node body is clicked', async () => {
    const { onSelect } = renderNode();
    await userEvent.click(await screen.findByText(TRANSLATION));
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it('calls onRemove without also selecting', async () => {
    const { onSelect, onRemove } = renderNode();
    await userEvent.click(screen.getByRole('button', { name: 'Remove verse' }));
    expect(onRemove).toHaveBeenCalledOnce();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('says all linked verses are shown instead of the expand button', () => {
    renderNode({ connectedCount: 0 });
    expect(screen.queryByRole('button', { name: 'Expand network' })).not.toBeInTheDocument();
    expect(screen.getByText('All linked verses shown')).toBeInTheDocument();
  });

  it('shows a singular label for one connected verse', () => {
    renderNode({ connectedCount: 1 });
    expect(screen.getByText('Show 1 connected verse')).toBeInTheDocument();
  });

  it('shows a plural label for several connected verses', () => {
    renderNode({ connectedCount: 3 });
    expect(screen.getByText('Show 3 connected verses')).toBeInTheDocument();
  });

  it('calls onExpand without also selecting', async () => {
    const { onSelect, onExpand } = renderNode({ connectedCount: 2 });
    await userEvent.click(screen.getByRole('button', { name: 'Expand network' }));
    expect(onExpand).toHaveBeenCalledOnce();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('marks the node selected only when isSelected is set', () => {
    const { container } = render(
      <ReactFlowProvider>
        <VerseNode
          data={{ verse, onSelect: vi.fn(), onRemove: vi.fn(), isSelected: true }}
        />
      </ReactFlowProvider>,
    );
    expect(container.querySelector('.verse-node')).toHaveClass('selected');
  });

  describe('without a summary', () => {
    const uncurated: Verse = {
      ...verse,
      id: '7.3',
      summary: undefined,
      theme: undefined,
      concepts: [],
      curated: false,
      reviewed: false,
    };

    it('leads with the fetched English translation', async () => {
      renderNode({ verse: uncurated });
      expect(await screen.findByText(TRANSLATION)).toBeInTheDocument();
      expect(screen.queryByText(uncurated.transliteration)).not.toBeInTheDocument();
    });

    it('falls back to the transliteration when the translation is unavailable', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 500 })));
      renderNode({ verse: { ...uncurated, id: '7.4' } });
      expect(await screen.findByText(uncurated.transliteration)).toBeInTheDocument();
    });
  });

  it('starts a tap-to-connect link from its link button, without opening the verse', async () => {
    const onStartConnect = vi.fn();
    const { onSelect } = renderNode({ onStartConnect });
    await userEvent.click(screen.getByRole('button', { name: 'Connect 2.47 to another verse' }));
    expect(onStartConnect).toHaveBeenCalledOnce();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('shows when it is the card a tap-to-connect link starts from', () => {
    renderNode({ onStartConnect: vi.fn(), connectSource: true });
    const button = screen.getByRole('button', { name: 'Cancel connecting from 2.47' });
    expect(button.getAttribute('aria-pressed')).toBe('true');
  });
});
