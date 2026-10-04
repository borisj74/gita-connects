import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ShortcutsOverlay from './ShortcutsOverlay.js';
import ConnectionDialog from './ConnectionDialog.js';
import { PREDEFINED_CONNECTION_TYPES } from '../connectionTypes.js';
import { CONNECTION_GUIDE } from '../connectionGuide.js';

describe('help panel', () => {
  it('opens on the kinds of connection when asked, with all ten explained', () => {
    render(<ShortcutsOverlay initialTab="kinds" onClose={() => {}} />);
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Kinds of connection');
    expect(screen.getByRole('tab', { name: 'Kinds of connection' }).getAttribute('aria-selected')).toBe('true');
    for (const t of PREDEFINED_CONNECTION_TYPES) {
      expect(screen.getByRole('heading', { level: 4, name: t.label })).toBeTruthy();
    }
    expect(screen.getByText(CONNECTION_GUIDE['question-answer'].meaning)).toBeTruthy();
    expect(screen.getByText('Telling them apart')).toBeTruthy();
  });

  it('switches between shortcuts and the guide', async () => {
    render(<ShortcutsOverlay onClose={() => {}} />);
    expect(screen.getByText('Finding verses')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: /What each kind of connection means/ }));
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Kinds of connection');
    await userEvent.click(screen.getByRole('tab', { name: 'Keyboard shortcuts' }));
    expect(screen.getByText('Finding verses')).toBeTruthy();
  });
});

describe('connection dialog', () => {
  it('explains the chosen kind and updates as the choice changes', async () => {
    const onShowGuide = vi.fn();
    render(
      <ConnectionDialog
        sourceVerseId="2.47"
        targetVerseId="3.19"
        connectionTypes={PREDEFINED_CONNECTION_TYPES}
        onCancel={() => {}}
        onConfirm={() => {}}
        onShowGuide={onShowGuide}
      />,
    );
    const contrast = PREDEFINED_CONNECTION_TYPES.find((t) => t.id === 'contrast')!;
    await userEvent.click(screen.getByRole('button', { name: contrast.label }));
    const box = screen.getByText(CONNECTION_GUIDE.contrast.meaning).closest('.type-meaning') as HTMLElement;
    expect(within(box).getByText(/Ask yourself:/).textContent).toContain(CONNECTION_GUIDE.contrast.ask);
    expect(within(box).getByText('two-way ↔')).toBeTruthy();

    await userEvent.click(within(box).getByRole('button', { name: /See all the kinds of connection/ }));
    expect(onShowGuide).toHaveBeenCalledOnce();
  });
});
