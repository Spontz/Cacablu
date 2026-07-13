let nativeTextWriteInProgress = false;

export function isNativeTextWriteInProgress(): boolean {
  return nativeTextWriteInProgress;
}

export async function writeSystemClipboardText(text: string): Promise<void> {
  let wroteNativeClipboard = false;
  const handleCopy = (event: ClipboardEvent): void => {
    if (!event.clipboardData) return;
    event.clipboardData.setData('text/plain', text);
    event.preventDefault();
    wroteNativeClipboard = true;
  };

  // execCommand dispatches a synchronous, trusted copy event while the keyboard
  // gesture is still active. This keeps Monaco's later native paste reliable.
  document.addEventListener('copy', handleCopy);
  try {
    nativeTextWriteInProgress = true;
    document.execCommand('copy');
  } finally {
    nativeTextWriteInProgress = false;
    document.removeEventListener('copy', handleCopy);
  }

  if (wroteNativeClipboard) return;
  if (!navigator.clipboard?.writeText) {
    throw new Error('The browser does not expose clipboard text writing.');
  }
  await navigator.clipboard.writeText(text);
}
