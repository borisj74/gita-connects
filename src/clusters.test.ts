import { describe, it, expect } from 'vitest';
import { CLUSTERS, CONCEPT_CLUSTER, clusterOf, clusterLabel } from './clusters.js';
import { CONCEPTS } from './concepts.js';
import { verses } from './data/index.js';

describe('CLUSTERS', () => {
  it('has unique ids and labels', () => {
    expect(new Set(CLUSTERS.map((c) => c.id)).size).toBe(CLUSTERS.length);
    expect(new Set(CLUSTERS.map((c) => c.label)).size).toBe(CLUSTERS.length);
  });

  it('assigns every concept to a cluster that exists', () => {
    const ids = new Set<string>(CLUSTERS.map((c) => c.id));
    for (const concept of CONCEPTS) {
      expect(ids, concept).toContain(CONCEPT_CLUSTER[concept]);
    }
  });

  it('leaves no cluster without concepts', () => {
    const used = new Set(Object.values(CONCEPT_CLUSTER));
    for (const { id } of CLUSTERS) expect(used, id).toContain(id);
  });

  it('labels every id', () => {
    for (const { id, label } of CLUSTERS) expect(clusterLabel(id)).toBe(label);
  });
});

describe('clusterOf', () => {
  it('is undefined for no concepts', () => {
    expect(clusterOf([])).toBeUndefined();
  });

  it('returns the majority cluster', () => {
    expect(clusterOf(['soul', 'death', 'war'])).toBe('soul-and-self');
  });

  it('breaks ties toward the first concept', () => {
    expect(clusterOf(['war', 'soul'])).toBe('arjuna-dilemma');
    expect(clusterOf(['soul', 'war'])).toBe('soul-and-self');
  });
});

describe('verses and clusters', () => {
  it('gives every curated verse a cluster and every uncurated verse none', () => {
    for (const v of verses) {
      if (v.curated) expect(v.cluster, v.id).toBeDefined();
      else expect(v.cluster, v.id).toBeUndefined();
    }
  });

  it('gives every curated verse at least two concepts', () => {
    const thin = verses.filter((v) => v.curated && v.concepts.length < 2).map((v) => v.id);
    expect(thin).toEqual([]);
  });

  it('derives the cluster from the verse\'s own concepts', () => {
    for (const v of verses.filter((x) => x.curated)) {
      expect(v.cluster, v.id).toBe(clusterOf(v.concepts));
    }
  });
});
