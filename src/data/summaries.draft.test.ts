import { describe, it, expect } from 'vitest';
import { draftSummaries } from './summaries.draft.js';
import { verseCuration } from './curation.js';
import { verses, getVerse } from './index.js';

describe('draft summaries', () => {
  const entries = Object.entries(draftSummaries);

  it('belong to real verses that have no hand-written summary', () => {
    for (const [id] of entries) {
      expect(getVerse(id), id).toBeDefined();
      expect(verseCuration[id]?.summary, `${id} already has a hand-written summary`).toBeUndefined();
    }
  });

  it('are short readings, not long passages', () => {
    for (const [id, text] of entries) {
      const words = text.trim().split(/\s+/).length;
      expect(words, id).toBeGreaterThanOrEqual(8);
      expect(words, id).toBeLessThanOrEqual(70);
    }
  });

  it('are marked as drafts on the verse, and a hand-written summary wins', () => {
    for (const v of verses) {
      if (verseCuration[v.id]?.summary) {
        expect(v.summaryDraft).toBe(false);
        expect(v.summary).toBe(verseCuration[v.id].summary);
      } else if (draftSummaries[v.id]) {
        expect(v.summaryDraft).toBe(true);
        expect(v.summary).toBe(draftSummaries[v.id]);
      }
    }
  });
});
