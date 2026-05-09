import type { ProjectDatabase } from '../db/db-schema';

export interface EngineWritableFile {
  write(data: BufferSource | Blob | string): Promise<void>;
  close(): Promise<void>;
}

export interface EngineFileHandle {
  readonly name: string;
  readonly kind: 'file';
  getFile(): Promise<Blob>;
  createWritable(): Promise<EngineWritableFile>;
}

export type EngineDirectoryEntryHandle = EngineDirectoryHandle | EngineFileHandle;

export interface EngineDirectoryHandle {
  readonly name: string;
  readonly kind: 'directory';
  removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<EngineDirectoryHandle>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<EngineFileHandle>;
  values(): AsyncIterable<EngineDirectoryEntryHandle>;
}

export type EngineDirectoryPicker = () => Promise<EngineDirectoryHandle | null>;

type DirectoryPickerWindow = Window & {
  showDirectoryPicker(): Promise<EngineDirectoryHandle>;
};

export type EngineDataExportResult =
  | {
      status: 'success';
      directoryName: string;
      filesWritten: number;
      sectionsWritten: number;
      resourcesCopied: number;
      configWritten: boolean;
    }
  | { status: 'cancelled' };

export function isEngineDirectoryPickerSupported(): boolean {
  return 'showDirectoryPicker' in window;
}

export async function pickEngineDirectory(): Promise<EngineDirectoryHandle | null> {
  try {
    return await (window as unknown as DirectoryPickerWindow).showDirectoryPicker();
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return null;
    throw err;
  }
}

export async function exportEngineDataPool(options: {
  db: Pick<ProjectDatabase, 'bars' | 'fbos' | 'files' | 'folders' | 'variables'>;
  pickDirectory?: EngineDirectoryPicker;
}): Promise<EngineDataExportResult> {
  const pickDirectory = options.pickDirectory ?? pickEngineDirectory;
  const directory = await pickDirectory();
  if (!directory) return { status: 'cancelled' };

  await removeExistingDataDirectory(directory);
  const dataDirectory = await directory.getDirectoryHandle('data', { create: true });
  const poolDirectory = await dataDirectory.getDirectoryHandle('pool', { create: true });
  const filesWritten = await writeResourcePool(options.db, poolDirectory);
  const sectionsWritten = await writeSectionFiles(options.db, dataDirectory);
  await writeConfigFiles(options.db, dataDirectory);
  const resourcesCopied = await copyResourcesDirectory(directory, dataDirectory);

  return {
    status: 'success',
    directoryName: directory.name,
    filesWritten,
    sectionsWritten,
    resourcesCopied,
    configWritten: true,
  };
}

async function copyResourcesDirectory(
  engineDirectory: EngineDirectoryHandle,
  dataDirectory: EngineDirectoryHandle,
): Promise<number> {
  const source = await findResourcesDirectory(engineDirectory);
  const target = await dataDirectory.getDirectoryHandle('resources', { create: true });
  return copyDirectoryContents(source, target);
}

async function findResourcesDirectory(engineDirectory: EngineDirectoryHandle): Promise<EngineDirectoryHandle> {
  for await (const entry of engineDirectory.values()) {
    if (entry.kind === 'directory' && entry.name.toLowerCase() === 'resources') {
      return entry;
    }
  }

  throw new Error('The selected engine folder does not contain a resources folder.');
}

async function copyDirectoryContents(
  source: EngineDirectoryHandle,
  target: EngineDirectoryHandle,
): Promise<number> {
  let copied = 0;

  for await (const entry of source.values()) {
    if (entry.kind === 'directory') {
      const childTarget = await target.getDirectoryHandle(entry.name, { create: true });
      copied += await copyDirectoryContents(entry, childTarget);
      continue;
    }

    const targetFile = await target.getFileHandle(entry.name, { create: true });
    const writable = await targetFile.createWritable();

    try {
      await writable.write(await entry.getFile());
    } finally {
      await writable.close();
    }

    copied += 1;
  }

  return copied;
}

async function writeResourcePool(
  db: Pick<ProjectDatabase, 'folders' | 'files'>,
  poolDirectory: EngineDirectoryHandle,
): Promise<number> {
  const folderHandles = new Map<number, Promise<EngineDirectoryHandle>>();

  const getFolderHandle = (folderId: number): Promise<EngineDirectoryHandle> => {
    const existing = folderHandles.get(folderId);
    if (existing) return existing;

    const folder = db.folders.find((candidate) => candidate.id === folderId);
    if (!folder) return Promise.resolve(poolDirectory);

    const parentId = normalizeParentId(folder.parent);
    const handle = (parentId ? getFolderHandle(parentId) : Promise.resolve(poolDirectory))
      .then((parent) => parent.getDirectoryHandle(folder.name, { create: true }));

    folderHandles.set(folderId, handle);
    return handle;
  };

  let filesWritten = 0;

  for (const file of db.files) {
    const parentId = normalizeParentId(file.parent);
    const parent = parentId ? await getFolderHandle(parentId) : poolDirectory;
    const fileHandle = await parent.getFileHandle(file.name, { create: true });
    const writable = await fileHandle.createWritable();

    try {
      await writable.write(toArrayBuffer(file.data));
    } finally {
      await writable.close();
    }

    filesWritten += 1;
  }

  return filesWritten;
}

async function writeSectionFiles(
  db: Pick<ProjectDatabase, 'bars'>,
  dataDirectory: EngineDirectoryHandle,
): Promise<number> {
  let sectionsWritten = 0;

  for (const bar of db.bars) {
    const type = bar.type.trim() || 'section';
    const fileHandle = await dataDirectory.getFileHandle(`${bar.id}-${type}.spo`, { create: true });
    const writable = await fileHandle.createWritable();

    try {
      await writable.write(formatSectionFile(bar));
    } finally {
      await writable.close();
    }

    sectionsWritten += 1;
  }

  return sectionsWritten;
}

async function removeExistingDataDirectory(directory: EngineDirectoryHandle): Promise<void> {
  await removeEntryIfExists(directory, 'data');
}

async function removeEntryIfExists(directory: EngineDirectoryHandle, name: string): Promise<void> {
  try {
    await directory.removeEntry(name, { recursive: true });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'NotFoundError') return;
    throw err;
  }
}

async function writeConfigFiles(
  db: Pick<ProjectDatabase, 'fbos' | 'variables'>,
  dataDirectory: EngineDirectoryHandle,
): Promise<void> {
  const configDirectory = await dataDirectory.getDirectoryHandle('config', { create: true });
  await writeGraphicsConfig(db, configDirectory);
  await writeLoaderConfig(db, configDirectory);
  await writeControlConfig(db, configDirectory);
}

async function writeGraphicsConfig(
  db: Pick<ProjectDatabase, 'fbos' | 'variables'>,
  configDirectory: EngineDirectoryHandle,
): Promise<void> {
  const fileHandle = await configDirectory.getFileHandle('graphics.spo', { create: true });
  const writable = await fileHandle.createWritable();

  try {
    await writable.write(formatGraphicsConfig(db));
  } finally {
    await writable.close();
  }
}

async function writeLoaderConfig(
  db: Pick<ProjectDatabase, 'variables'>,
  configDirectory: EngineDirectoryHandle,
): Promise<void> {
  const fileHandle = await configDirectory.getFileHandle('loader.spo', { create: true });
  const writable = await fileHandle.createWritable();

  try {
    await writable.write(formatLoaderConfig(db.variables));
  } finally {
    await writable.close();
  }
}

async function writeControlConfig(
  db: Pick<ProjectDatabase, 'variables'>,
  configDirectory: EngineDirectoryHandle,
): Promise<void> {
  const fileHandle = await configDirectory.getFileHandle('control.spo', { create: true });
  const writable = await fileHandle.createWritable();

  try {
    await writable.write(formatControlConfig(db.variables));
  } finally {
    await writable.close();
  }
}

function formatGraphicsConfig(db: Pick<ProjectDatabase, 'fbos' | 'variables'>): string {
  const lines: string[] = [];

  for (const entry of GRAPHICS_VARIABLES) {
    lines.push(`${entry.outputName} ${getGraphicsVariableValue(db.variables, entry)}`);
  }

  if (lines.length > 0 && db.fbos.length > 0) {
    lines.push('');
  }

  db.fbos.forEach((fbo, index) => {
    if (index > 0) lines.push('');
    const fboIndex = fbo.id - 1;

    if (fbo.width > 0 || fbo.height > 0) {
      lines.push(`fbo_${fboIndex}_width ${formatNumber(fbo.width)}`);
      lines.push(`fbo_${fboIndex}_height ${formatNumber(fbo.height)}`);
    } else {
      lines.push(`fbo_${fboIndex}_ratio ${formatNumber(fbo.ratio)}`);
    }

    lines.push(`fbo_${fboIndex}_format ${fbo.format}`);
    lines.push(`fbo_${fboIndex}_colorAttachments ${fbo.colorAttachments}`);
  });

  return `${lines.join('\r\n')}\r\n`;
}

const GRAPHICS_VARIABLES = [
  { outputName: 'gl_fullscreen', sourceName: 'fullScreen' },
  { outputName: 'gl_width', sourceName: 'screenWidth' },
  { outputName: 'gl_height', sourceName: 'screenHeight' },
  { outputName: 'gl_aspect', calculate: calculateAspect },
  { outputName: 'gl_vsync', sourceName: 'vsync' },
] as const;

const CONTROL_VARIABLES = [
  { outputName: 'demo_name', sourceName: 'demoName' },
  { outputName: 'debug', value: '1' },
  { outputName: 'loop', sourceName: 'demoLoop' },
  { outputName: 'sound', value: '1' },
  { outputName: 'demo_start', sourceName: 'startTime' },
  { outputName: 'demo_end', sourceName: 'endTime' },
  { outputName: 'slave', value: '1' },
  { outputName: 'debugEnableAxis', value: '1' },
  { outputName: 'debugEnableFloor', value: '1' },
] as const;

function formatLoaderConfig(variables: ReadonlyMap<string, string>): string {
  const loaderCode = getVariableValue(variables, 'loaderCode').trimStart();
  const content = loaderCode.startsWith(':::loading')
    ? loaderCode
    : [':::loading', loaderCode].join('\r\n');

  return ensureTrailingNewline(content);
}

function formatControlConfig(variables: ReadonlyMap<string, string>): string {
  const lines = CONTROL_VARIABLES.map((entry) => (
    `${entry.outputName} ${getControlVariableValue(variables, entry)}`
  ));

  return `${lines.join('\r\n')}\r\n`;
}

function getControlVariableValue(
  variables: ReadonlyMap<string, string>,
  entry: (typeof CONTROL_VARIABLES)[number],
): string {
  if ('value' in entry) return entry.value;
  return getVariableValue(variables, entry.sourceName);
}

function getGraphicsVariableValue(
  variables: ReadonlyMap<string, string>,
  entry: (typeof GRAPHICS_VARIABLES)[number],
): string {
  if ('calculate' in entry) return entry.calculate(variables);
  return getVariableValue(variables, entry.sourceName);
}

function calculateAspect(variables: ReadonlyMap<string, string>): string {
  const width = Number.parseFloat(getVariableValue(variables, 'screenWidth'));
  const height = Number.parseFloat(getVariableValue(variables, 'screenHeight'));

  if (!Number.isFinite(width) || !Number.isFinite(height) || height === 0) return '';
  return formatNumber(width / height);
}

function getVariableValue(variables: ReadonlyMap<string, string>, name: string): string {
  return variables.get(name) ?? '';
}

function ensureTrailingNewline(value: string): string {
  return value.endsWith('\n') ? value : `${value}\r\n`;
}

function formatSectionFile(bar: ProjectDatabase['bars'][number]): string {
  const type = bar.type.trim() || 'section';
  const lines = [
    `:::${type}`,
    `id ${bar.id}`,
    `start ${formatNumber(bar.startTime)}`,
    `end ${formatNumber(bar.endTime)}`,
    `enabled ${bar.enabled ? 1 : 0}`,
    `layer ${bar.layer}`,
    `blend ${bar.srcBlending} ${bar.dstBlending}`,
    `blendequation ${bar.blendingEQ}`,
    '',
    toText(bar.script),
  ];

  return lines.join('\r\n');
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value);
}

function normalizeParentId(parent: number): number {
  return Number.isFinite(parent) && parent > 0 ? parent : 0;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function toText(value: string | Uint8Array): string {
  return typeof value === 'string' ? value : new TextDecoder().decode(value);
}
