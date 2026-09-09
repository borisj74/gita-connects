import { describe, it, expect, vi, afterEach } from 'vitest';
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
  wordMeanings: 'karmaṇi—in prescribed duties; eva—only; adhikāraḥ—right',
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

describe('VerseNode', () => {
  it('renders the verse id, theme, summary, and concepts', () => {
    renderNode();
    expect(screen.getByText('2.47')).toBeInTheDocument();
    expect(screen.getByText('Selfless action')).toBeInTheDocument();
    expect(screen.getByText(verse.summary!)).toBeInTheDocument();
    expect(screen.getByText('duty')).toBeInTheDocument();
    expect(screen.getByText('detachment')).toBeInTheDocument();
  });

  it('calls onSelect when the node body is clicked', async () => {
    const { onSelect } = renderNode();
    await userEvent.click(screen.getByText(verse.summary!));
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it('calls onRemove without also selecting', async () => {
    const { onSelect, onRemove } = renderNode();
    await userEvent.click(screen.getByRole('button', { name: 'Remove verse' }));
    expect(onRemove).toHaveBeenCalledOnce();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('hides the expand button when nothing is connected', () => {
    renderNode({ connectedCount: 0 });
    expect(screen.queryByRole('button', { name: 'Expand network' })).not.toBeInTheDocument();
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
    afterEach(() => vi.unstubAllGlobals());

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
      vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
        translation: 'Out of many thousands among men, one may endeavor for perfection.',
      }))));
      renderNode({ verse: uncurated });
      expect(await screen.findByText(/Out of many thousands/)).toBeInTheDocument();
      expect(screen.queryByText(uncurated.transliteration)).not.toBeInTheDocument();
    });

    it('falls back to the transliteration when the translation is unavailable', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 500 })));
      renderNode({ verse: { ...uncurated, id: '7.4' } });
      expect(await screen.findByText(uncurated.transliteration)).toBeInTheDocument();
    });
  });
});
