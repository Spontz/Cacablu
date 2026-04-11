import { describe, expect, it } from 'vitest';

import { detectRuntimeEnvironment } from '../../src/app/runtime-environment';

describe('detectRuntimeEnvironment', () => {
  it('flags file protocol with a visible notice', () => {
    expect(detectRuntimeEnvironment('file:')).toEqual({
      isFileProtocol: true,
      limitationNotice:
        'Running from a local file. The shell works, but some future features may behave differently than under HTTP hosting.',
    });
  });

  it('does not show a notice under http hosting', () => {
    expect(detectRuntimeEnvironment('http:')).toEqual({
      isFileProtocol: false,
      limitationNotice: null,
    });
  });
});
