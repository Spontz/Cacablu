import { describe, expect, it, vi } from 'vitest';

import { togglePanelVisibility } from '../../src/layout/panel-visibility';

describe('togglePanelVisibility', () => {
  it('closes a panel that is already open', () => {
    const workspace = {
      isPanelOpen: vi.fn().mockReturnValue(true),
      openPanel: vi.fn(),
      closePanel: vi.fn(),
    };

    togglePanelVisibility(workspace, 'events');

    expect(workspace.closePanel).toHaveBeenCalledWith('events');
    expect(workspace.openPanel).not.toHaveBeenCalled();
  });

  it('opens a panel that is closed', () => {
    const workspace = {
      isPanelOpen: vi.fn().mockReturnValue(false),
      openPanel: vi.fn(),
      closePanel: vi.fn(),
    };

    togglePanelVisibility(workspace, 'events');

    expect(workspace.openPanel).toHaveBeenCalledWith('events');
    expect(workspace.closePanel).not.toHaveBeenCalled();
  });
});
