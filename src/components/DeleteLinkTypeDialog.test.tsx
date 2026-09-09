import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Edge } from 'reactflow';
import DeleteLinkTypeDialog from './DeleteLinkTypeDialog.js';

const type = { id: 'custom-mentorship-1', label: 'Mentorship', color: '#5e9b8e', isCustom: true };
const edge = (source: string, target: string): Edge =>
  ({ id: `${source}-${target}`, source, target, data: { typeId: type.id } }) as Edge;

describe('DeleteLinkTypeDialog', () => {
  it('names the type and the number of links that go with it', () => {
    render(
      <DeleteLinkTypeDialog
        type={type}
        affected={[edge('2.47', '3.19'), edge('2.47', '18.66'), edge('2.47', '9.27'), edge('2.47', '4.7')]}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByRole('alertdialog', { name: /Delete the “Mentorship” link type\?/ })).toBeInTheDocument();
    expect(screen.getByText('4 connections')).toBeInTheDocument();
    expect(screen.getByText('2.47 → 3.19')).toBeInTheDocument();
    expect(screen.getByText('2.47 → 18.66')).toBeInTheDocument();
    expect(screen.getByText('and 2 more')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete type and links' })).toBeInTheDocument();
  });

  it('focuses Cancel first and returns Escape as a cancel', async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(<DeleteLinkTypeDialog type={type} affected={[edge('2.47', '3.19')]} onCancel={onCancel} onConfirm={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('confirms through the red button only', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(<DeleteLinkTypeDialog type={type} affected={[]} onCancel={vi.fn()} onConfirm={onConfirm} />);
    expect(screen.getByText(/Nothing on your canvas uses it yet/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete type' }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
