import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GuidedTour from './GuidedTour.js';
import { TOUR_STEPS } from '../tour/steps.js';
import { shouldWelcome, saveTourStatus, readTourStatus, TOUR_KEY } from '../tour/tourStore.js';
import { AUTOSAVE_KEY } from '../autosave.js';

const setup = (startAt: 'welcome' | 'tour' = 'welcome') => {
  const onBegin = vi.fn(() => '2.47');
  const onClose = vi.fn();
  const onStepEnter = vi.fn();
  render(<GuidedTour startAt={startAt} isMobile={false} onBegin={onBegin} onClose={onClose} onStepEnter={onStepEnter} />);
  return { onBegin, onClose, onStepEnter };
};

describe('guided tour', () => {
  it('welcomes, then walks every stop to the finish', async () => {
    const { onBegin, onClose, onStepEnter } = setup();
    expect(screen.getByRole('heading', { name: 'Welcome to Gita Connects' })).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'Take the tour' }));
    expect(onBegin).toHaveBeenCalledOnce();

    for (const [i, step] of TOUR_STEPS.entries()) {
      expect(screen.getByRole('heading', { name: step.title })).toBeTruthy();
      expect(screen.getByText(`${i + 1} of ${TOUR_STEPS.length}`)).toBeTruthy();
      expect(onStepEnter).toHaveBeenLastCalledWith(step.id);
      const last = i === TOUR_STEPS.length - 1;
      await userEvent.click(screen.getByRole('button', { name: last ? 'Finish' : 'Next' }));
    }

    expect(screen.getByRole('heading', { name: 'Now it’s your turn' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Start exploring' }));
    expect(onClose).toHaveBeenCalledWith('done');
  });

  it('goes back a stop, and has no Back on the first', async () => {
    setup('tour');
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('heading', { name: TOUR_STEPS[0].title })).toBeTruthy();
  });

  it('can be skipped from the welcome, mid-tour, or with Escape', async () => {
    let t = setup();
    await userEvent.click(screen.getByRole('button', { name: /Skip, I’ll explore/ }));
    expect(t.onClose).toHaveBeenCalledWith('skipped');
    expect(t.onBegin).not.toHaveBeenCalled();
    document.body.innerHTML = '';

    t = setup('tour');
    await userEvent.click(screen.getByRole('button', { name: 'Skip tour' }));
    expect(t.onClose).toHaveBeenCalledWith('skipped');
    document.body.innerHTML = '';

    t = setup('tour');
    await userEvent.keyboard('{Escape}');
    expect(t.onClose).toHaveBeenCalledWith('skipped');
  });

  it('a replay starts on the first stop', () => {
    const { onBegin } = setup('tour');
    expect(onBegin).toHaveBeenCalledOnce();
    expect(screen.getByRole('heading', { name: TOUR_STEPS[0].title })).toBeTruthy();
  });
});

describe('who is welcomed', () => {
  beforeEach(() => localStorage.clear());

  it('welcomes a first visit once', () => {
    expect(shouldWelcome()).toBe(true);
    saveTourStatus('skipped');
    expect(readTourStatus()).toBe('skipped');
    expect(shouldWelcome()).toBe(false);
  });

  it('does not greet someone who already has work here', () => {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ nodes: [{ id: '2.47' }], edges: [] }));
    expect(shouldWelcome()).toBe(false);
  });

  it('ignores an unknown stored value', () => {
    localStorage.setItem(TOUR_KEY, 'maybe');
    expect(readTourStatus()).toBeNull();
  });
});
