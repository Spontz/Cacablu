import { describe, expect, it, vi } from 'vitest';

import { confirmProjectRevert } from '../../src/app/project-revert';

describe('project Revert confirmation', () => {
  it('asks for a simple confirmation when the project is clean', () => {
    const confirm = vi.fn(() => true);

    expect(confirmProjectRevert(false, confirm)).toBe('discard');
    expect(confirm).toHaveBeenCalledOnce();
  });

  it('asks only for discard confirmation when the project is dirty', () => {
    const confirm = vi.fn(() => true);

    expect(confirmProjectRevert(true, confirm)).toBe('discard');
    expect(confirm).toHaveBeenCalledOnce();
    expect(confirm).toHaveBeenCalledWith(
      'Discard all unsaved changes and reload the last saved version?',
    );
  });

  it('cancels without discarding when the dirty-project prompt is rejected', () => {
    const confirm = vi.fn(() => false);

    expect(confirmProjectRevert(true, confirm)).toBe('cancel');
    expect(confirm).toHaveBeenCalledOnce();
  });
});
