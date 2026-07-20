let nativeTextWriteInProgress = false;

export function isNativeTextWriteInProgress(): boolean {
  return nativeTextWriteInProgress;
}

export async function writeSystemClipboardText(text: string): Promise<void> {
  await writeSystemClipboardFormats({ 'text/plain': text });
}

export async function writeSystemClipboardFormats(formats: Readonly<Record<string, string>>): Promise<void> {
  let wroteNativeClipboard = false;
  const handleCopy = (event: ClipboardEvent): void => {
    if (!event.clipboardData) return;
    for (const [type, value] of Object.entries(formats)) {
      event.clipboardData.setData(type, value);
    }
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
  if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
    const item = new ClipboardItem(Object.fromEntries(
      Object.entries(formats).map(([type, value]) => [type, new Blob([value], { type })]),
    ));
    await navigator.clipboard.write([item]);
    return;
  }
  const plainText = formats['text/plain'];
  if (!navigator.clipboard?.writeText || plainText === undefined) {
    throw new Error('The browser does not expose clipboard text writing.');
  }
  await navigator.clipboard.writeText(plainText);
}
