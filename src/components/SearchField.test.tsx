import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SearchField from './SearchField.js';

function setup() {
  const onVerseSelect = vi.fn();
  const onAddVerse = vi.fn();
  render(
    <SearchField
      onVerseSelect={onVerseSelect}
      onAddVerse={onAddVerse}
      networkVerses={new Set()}
    />,
  );
  const input = screen.getByRole('combobox');
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: 'duty' } });
  return { input, onVerseSelect, onAddVerse };
}

const dropdown = () => document.querySelector('#sf-results');

describe('SearchField dismissal', () => {
  it('opens a dropdown once there is something to match on', () => {
    setup();
    expect(dropdown()).not.toBeNull();
  });

  it('closes on Escape but keeps the query, so it can be resumed', () => {
    const { input } = setup();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(dropdown()).toBeNull();
    expect((input as HTMLInputElement).value).toBe('duty');
  });

  it('clears the query when Escape is pressed again with the panel down', () => {
    const { input } = setup();
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect((input as HTMLInputElement).value).toBe('');
  });

  it('closes on a click anywhere outside the field', () => {
    setup();
    fireEvent.mouseDown(document.body);
    expect(dropdown()).toBeNull();
  });

  // React Flow's drag handling calls stopImmediatePropagation on mousedown, so
  // a listener on the way up never hears a click that landed on the canvas —
  // the largest target in the app. Listening on the way down is what fixes it,
  // and this is the test that fails if someone moves it back.
  it('closes even when something swallows the event on the way up', () => {
    setup();
    const canvas = document.createElement('div');
    canvas.addEventListener('mousedown', (e) => e.stopImmediatePropagation());
    document.body.appendChild(canvas);

    fireEvent.mouseDown(canvas);

    expect(dropdown()).toBeNull();
    canvas.remove();
  });

  it('leaves a click inside the field alone', () => {
    const { input } = setup();
    fireEvent.mouseDown(input);
    expect(dropdown()).not.toBeNull();
  });
});

describe('SearchField choosing a result', () => {
  it('puts the highlighted verse on the canvas on Enter, without opening it', () => {
    const { input, onVerseSelect, onAddVerse } = setup();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onAddVerse).toHaveBeenCalledOnce();
    expect(onVerseSelect).not.toHaveBeenCalled();
    expect(dropdown()).toBeNull();
  });

  it('puts a clicked result on the canvas', () => {
    const { onVerseSelect, onAddVerse } = setup();
    const first = document.querySelector<HTMLButtonElement>('.sf-result-main')!;
    fireEvent.click(first);
    expect(onAddVerse).toHaveBeenCalledOnce();
    expect(onVerseSelect).not.toHaveBeenCalled();
  });

  it('opens a verse to read, without adding it, from the book button', () => {
    const { onVerseSelect, onAddVerse } = setup();
    fireEvent.click(screen.getAllByRole('button', { name: /without adding it/ })[0]);
    expect(onVerseSelect).toHaveBeenCalledOnce();
    expect(onAddVerse).not.toHaveBeenCalled();
  });
});
