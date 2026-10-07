import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConnectToPicker from './ConnectToPicker.js';

const setup = (onCanvas: string[] = ['2.47', '3.19', '5.10']) => {
  const onPick = vi.fn();
  const onCancel = vi.fn();
  render(<ConnectToPicker fromId="2.47" networkVerses={new Set(onCanvas)} onPick={onPick} onCancel={onCancel} />);
  return { onPick, onCancel };
};

const ids = () => screen.getAllByRole('option').map((o) => o.querySelector('.ctp-id')?.textContent);

describe('Connect to…', () => {
  it('offers the other verses on the canvas first, never the verse itself', () => {
    setup();
    expect(ids()).toEqual(['3.19', '5.10']);
  });

  it('searches all verses, with those on the canvas first', async () => {
    setup(['2.47', '18.66']);
    await userEvent.type(screen.getByRole('combobox'), '18.6');
    const found = ids();
    expect(found[0]).toBe('18.66');
    expect(found).toContain('18.60');
  });

  it('picks with a tap', async () => {
    const { onPick } = setup();
    await userEvent.click(screen.getByText('5.10'));
    expect(onPick).toHaveBeenCalledWith('5.10');
  });

  it('picks the highlighted verse with Enter, and closes on Escape', async () => {
    const { onPick, onCancel } = setup();
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(onPick).toHaveBeenCalledWith('5.10');
    await userEvent.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
