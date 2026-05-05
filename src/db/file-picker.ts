type FilePickerAcceptType = { description?: string; accept: Record<string, string[]> };

interface OpenPickerOptions { types?: FilePickerAcceptType[]; multiple?: boolean }
interface SavePickerOptions { types?: FilePickerAcceptType[]; suggestedName?: string }

// showOpenFilePicker / showSaveFilePicker are part of the File System Access API.
// They may not be typed in older TypeScript DOM libs, so we extend Window locally.
type FsaWindow = Window & {
  showOpenFilePicker(opts?: OpenPickerOptions): Promise<FileSystemFileHandle[]>;
  showSaveFilePicker(opts?: SavePickerOptions): Promise<FileSystemFileHandle>;
};

const PICKER_TYPES: FilePickerAcceptType[] = [
  { description: 'Cacablu project', accept: { 'application/x-sqlite3': ['.sqlite', '.spz', '.db'] } },
];

export function isFileSystemAccessSupported(): boolean {
  return 'showOpenFilePicker' in window && 'showSaveFilePicker' in window;
}

export async function pickSqliteFile(): Promise<FileSystemFileHandle | null> {
  try {
    const [handle] = await (window as unknown as FsaWindow).showOpenFilePicker({
      types: PICKER_TYPES,
      multiple: false,
    });
    return handle;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return null;
    throw err;
  }
}

export async function pickSaveAsFile(): Promise<FileSystemFileHandle | null> {
  try {
    const handle = await (window as unknown as FsaWindow).showSaveFilePicker({
      types: PICKER_TYPES,
      suggestedName: 'project.sqlite',
    });
    return handle;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return null;
    throw err;
  }
}
