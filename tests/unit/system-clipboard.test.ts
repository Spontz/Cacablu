import { describe, expect, it, vi } from 'vitest';

import { isNativeTextWriteInProgress, writeSystemClipboardText } from '../../src/resources/system-clipboard';

describe('system clipboard text', () => {
  it('writes text through the synchronous native copy event', async () => {
    const clipboardData = { setData: vi.fn() };
    const listeners = new Set<(event: ClipboardEvent) => void>();
    const documentStub = {
      addEventListener: (_type: string, listener: (event: ClipboardEvent) => void) => listeners.add(listener),
      removeEventListener: (_type: string, listener: (event: ClipboardEvent) => void) => listeners.delete(listener),
      execCommand: vi.fn(() => {
        expect(isNativeTextWriteInProgress()).toBe(true);
        const event = {
          clipboardData,
          preventDefault: vi.fn(),
        } as unknown as ClipboardEvent;
        for (const listener of listeners) listener(event);
        return true;
      }),
    };
    const asyncWrite = vi.fn();

    vi.stubGlobal('document', documentStub);
    vi.stubGlobal('navigator', { clipboard: { writeText: asyncWrite } });

    await writeSystemClipboardText('/pool/shaders/scene.glsl');

    expect(clipboardData.setData).toHaveBeenCalledWith('text/plain', '/pool/shaders/scene.glsl');
    expect(asyncWrite).not.toHaveBeenCalled();
    expect(isNativeTextWriteInProgress()).toBe(false);
    expect(listeners.size).toBe(0);
    vi.unstubAllGlobals();
  });

  it('falls back to the asynchronous Clipboard API when no native data transfer is available', async () => {
    const asyncWrite = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('document', {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      execCommand: vi.fn(() => false),
    });
    vi.stubGlobal('navigator', { clipboard: { writeText: asyncWrite } });

    await writeSystemClipboardText('/pool/audio/theme.ogg');

    expect(asyncWrite).toHaveBeenCalledWith('/pool/audio/theme.ogg');
    vi.unstubAllGlobals();
  });
});
