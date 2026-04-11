export interface RuntimeEnvironment {
  isFileProtocol: boolean;
  limitationNotice: string | null;
}

export function detectRuntimeEnvironment(protocol: string): RuntimeEnvironment {
  if (protocol === 'file:') {
    return {
      isFileProtocol: true,
      limitationNotice:
        'Running from a local file. The shell works, but some future features may behave differently than under HTTP hosting.',
    };
  }

  return {
    isFileProtocol: false,
    limitationNotice: null,
  };
}
