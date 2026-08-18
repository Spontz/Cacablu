import { describe, expect, it } from 'vitest';

import {
  getResourceDragOrigin,
  isResourceDragFromSession,
} from '../../src/resources/resource-drag-origin';

describe('Pool drag origin', () => {
  it('recognizes only the exact source session as a local move', () => {
    const sourceSession = {};
    const destinationSession = {};
    const origin = getResourceDragOrigin(sourceSession);

    expect(isResourceDragFromSession(origin, sourceSession)).toBe(true);
    expect(isResourceDragFromSession(origin, destinationSession)).toBe(false);
  });

  it('rejects incomplete and foreign origins even when resource ids may overlap', () => {
    const destinationSession = {};
    const destinationOrigin = getResourceDragOrigin(destinationSession);

    expect(isResourceDragFromSession({ sourceId: destinationOrigin.sourceId }, destinationSession)).toBe(false);
    expect(isResourceDragFromSession({
      sourceId: destinationOrigin.sourceId,
      sourceSessionId: crypto.randomUUID(),
    }, destinationSession)).toBe(false);
    expect(isResourceDragFromSession({
      sourceId: crypto.randomUUID(),
      sourceSessionId: destinationOrigin.sourceSessionId,
    }, destinationSession)).toBe(false);
  });
});
