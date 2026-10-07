import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConnectionDialog from './ConnectionDialog.js';
import { PREDEFINED_CONNECTION_TYPES } from '../connectionTypes.js';

describe('connection dialog direction', () => {
  it('shows which way the link runs and can swap it', async () => {
    const onSwap = vi.fn();
    render(
      <ConnectionDialog
        sourceVerseId="2.62"
        targetVerseId="2.71"
        connectionTypes={PREDEFINED_CONNECTION_TYPES}
        onCancel={() => {}}
        onConfirm={() => {}}
        onSwap={onSwap}
      />,
    );
    expect(screen.getByText(/Linking/).textContent).toMatch(/2\.62\s*→\s*2\.71/);
    await userEvent.click(screen.getByRole('button', { name: /Swap direction/ }));
    expect(onSwap).toHaveBeenCalledOnce();
  });
});
