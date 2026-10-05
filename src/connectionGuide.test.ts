import { describe, it, expect } from 'vitest';
import { CONNECTION_GUIDE } from './connectionGuide.js';
import { PREDEFINED_CONNECTION_TYPES } from './connectionTypes.js';
import { connections } from './data/index.js';

describe('connection guide', () => {
  it('explains every predefined kind and nothing else', () => {
    expect(Object.keys(CONNECTION_GUIDE).sort()).toEqual(PREDEFINED_CONNECTION_TYPES.map((t) => t.id).sort());
  });

  it('uses a real connection of that kind as each example', () => {
    for (const [type, { example }] of Object.entries(CONNECTION_GUIDE)) {
      const found = connections.some((c) => c.type === type && c.from === example.from && c.to === example.to);
      expect(found, `${type}: ${example.from} → ${example.to}`).toBe(true);
    }
  });
});
