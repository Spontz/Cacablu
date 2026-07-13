import { describe, expect, it } from 'vitest';

import {
  hasNewSectionErrors,
  shouldDeferEventsOpen,
  shouldOpenEventsForNewError,
} from '../../src/app/event-notifications';

describe('event notifications', () => {
  it('opens Events only for a newer error revision when the panel is closed', () => {
    expect(shouldOpenEventsForNewError(2, 3, false)).toBe(true);
    expect(shouldOpenEventsForNewError(2, 3, true)).toBe(false);
    expect(shouldOpenEventsForNewError(2, 2, false)).toBe(false);
  });

  it('opens and marks Events for new section errors even without an error event', () => {
    expect(hasNewSectionErrors(new Set([17]), [17, 22])).toBe(true);
    expect(hasNewSectionErrors(new Set([17, 22]), [22])).toBe(false);
  });

  it('defers Events while project loading has Timeline closed', () => {
    expect(shouldDeferEventsOpen(true, false)).toBe(true);
    expect(shouldDeferEventsOpen(true, true)).toBe(false);
    expect(shouldDeferEventsOpen(false, false)).toBe(false);
  });
});
