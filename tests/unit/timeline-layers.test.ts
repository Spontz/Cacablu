import { describe, expect, it } from 'vitest';

import { canAddTimelineLayer, createTimelineLayerSession } from '../../src/services/timeline-layers';

describe('timeline layer session', () => {
  it('requires both a project and an open Timeline panel', () => {
    expect(canAddTimelineLayer(true, true)).toBe(true);
    expect(canAddTimelineLayer(true, false)).toBe(false);
    expect(canAddTimelineLayer(false, true)).toBe(false);
  });

  it('starts at layer zero and allocates monotonically', () => {
    const session = createTimelineLayerSession();

    expect(session.addNext([])).toBe(0);
    expect(session.addNext([])).toBe(1);
    expect(session.getLayers([])).toEqual([0, 1]);
  });

  it('appends after the greatest database or session layer without filling gaps', () => {
    const session = createTimelineLayerSession();

    expect(session.getLayers([5, 1, 5])).toEqual([1, 5]);
    expect(session.addNext([5, 1])).toBe(6);
    expect(session.addNext([2])).toBe(7);
    expect(session.getLayers([1, 5])).toEqual([1, 5, 6, 7]);
  });

  it('retains empty layers across reconciliation and clears them for a new project', () => {
    const session = createTimelineLayerSession();
    session.addNext([0]);

    expect(session.getLayers([0, 3])).toEqual([0, 1, 3]);
    session.clear();
    expect(session.getLayers([3])).toEqual([3]);
    expect(session.addNext([])).toBe(0);
  });

  it('ignores invalid database layer values', () => {
    const session = createTimelineLayerSession();

    expect(session.getLayers([0, 1.5, Number.NaN, Number.POSITIVE_INFINITY])).toEqual([0]);
  });
});
