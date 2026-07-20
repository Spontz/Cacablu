import type { DbBar } from '../db/db-schema';
import type { AssetClipboardNode } from '../resources/asset-clipboard';
import { normalizePoolPath, serializePoolPaths } from '../resources/asset-clipboard';
import { writeSystemClipboardFormats } from '../resources/system-clipboard';

export const CACABLU_CLIPBOARD_MIME = 'application/x-cacablu+json';
const CACABLU_CLIPBOARD_APP = 'cacablu';
const CACABLU_CLIPBOARD_VERSION = 1;
const HTML_MARKER_PREFIX = '<meta data-cacablu-clipboard="';
const HTML_MARKER_SUFFIX = '">';
const MAX_ENVELOPE_CHARS = 128 * 1024 * 1024;
const MAX_POOL_BYTES = 64 * 1024 * 1024;
const MAX_POOL_NODES = 100_000;
const MAX_POOL_DEPTH = 256;

export interface BarClipboardEntry {
  sourceId: number;
  name: string;
  type: string;
  layer: number;
  startTime: number;
  endTime: number;
  enabled: boolean;
  script: string;
  srcBlending: string;
  dstBlending: string;
  blendingEQ: string;
  srcAlpha: string;
  dstAlpha: string;
}

export interface BarClipboardPayload {
  anchorStart: number;
  anchorLayer: number;
  bars: BarClipboardEntry[];
}

export interface PoolClipboardFile {
  kind: 'file';
  sourceId: number;
  name: string;
  path: string;
  bytes: number;
  type: string;
  dataBase64: string;
  format: string;
  enabled: boolean;
}

export interface PoolClipboardFolder {
  kind: 'folder';
  sourceId: number;
  name: string;
  path: string;
  enabled: boolean;
  children: PoolClipboardNode[];
}

export type PoolClipboardNode = PoolClipboardFile | PoolClipboardFolder;

export interface BarClipboardEnvelope {
  app: typeof CACABLU_CLIPBOARD_APP;
  version: typeof CACABLU_CLIPBOARD_VERSION;
  kind: 'bars';
  createdAt: string;
  payload: BarClipboardPayload;
}

export interface PoolClipboardEnvelope {
  app: typeof CACABLU_CLIPBOARD_APP;
  version: typeof CACABLU_CLIPBOARD_VERSION;
  kind: 'pool';
  createdAt: string;
  payload: { roots: PoolClipboardNode[] };
}

export type CacabluClipboardEnvelope = BarClipboardEnvelope | PoolClipboardEnvelope;

export function createBarClipboardEnvelope(bars: DbBar[]): BarClipboardEnvelope {
  const selected = [...new Map(bars.map((bar) => [bar.id, bar])).values()]
    .sort((left, right) => left.id - right.id);
  if (selected.length === 0) throw new Error('Select at least one Timeline bar to copy.');
  const entries = selected.map(barToClipboardEntry);
  return {
    app: CACABLU_CLIPBOARD_APP,
    version: CACABLU_CLIPBOARD_VERSION,
    kind: 'bars',
    createdAt: new Date().toISOString(),
    payload: {
      anchorStart: Math.min(...entries.map((bar) => bar.startTime)),
      anchorLayer: Math.min(...entries.map((bar) => bar.layer)),
      bars: entries,
    },
  };
}

export function createPoolClipboardEnvelope(roots: AssetClipboardNode[]): PoolClipboardEnvelope {
  if (roots.length === 0) throw new Error('Select at least one Pool item to copy.');
  return {
    app: CACABLU_CLIPBOARD_APP,
    version: CACABLU_CLIPBOARD_VERSION,
    kind: 'pool',
    createdAt: new Date().toISOString(),
    payload: { roots: roots.map(assetNodeToClipboardNode) },
  };
}

export function getClipboardPlainText(envelope: CacabluClipboardEnvelope): string {
  if (envelope.kind === 'pool') {
    return serializePoolPaths(envelope.payload.roots.map((root) => root.path));
  }
  const ids = envelope.payload.bars.map((bar) => bar.sourceId).join(', ');
  return `Cacablu Timeline bars (${envelope.payload.bars.length}): ${ids}`;
}

export function writeEnvelopeToDataTransfer(
  clipboardData: Pick<DataTransfer, 'setData'>,
  envelope: CacabluClipboardEnvelope,
): void {
  const formats = encodeClipboardFormats(envelope);
  for (const [type, value] of Object.entries(formats)) clipboardData.setData(type, value);
}

export async function writeEnvelopeToSystemClipboard(envelope: CacabluClipboardEnvelope): Promise<void> {
  await writeSystemClipboardFormats(encodeClipboardFormats(envelope));
}

export function readEnvelopeFromDataTransfer(
  clipboardData: Pick<DataTransfer, 'getData' | 'types'>,
): CacabluClipboardEnvelope | null {
  if (Array.from(clipboardData.types).includes(CACABLU_CLIPBOARD_MIME)) {
    const custom = clipboardData.getData(CACABLU_CLIPBOARD_MIME);
    if (custom) return decodeClipboardEnvelope(custom);
  }
  const html = clipboardData.getData('text/html');
  return html ? decodeEnvelopeFromHtml(html) : null;
}

export async function readEnvelopeFromSystemClipboard(): Promise<CacabluClipboardEnvelope | null> {
  if (!navigator.clipboard?.read) {
    throw new Error('The browser does not expose rich clipboard reading.');
  }
  const items = await navigator.clipboard.read();
  for (const item of items) {
    if (item.types.includes(CACABLU_CLIPBOARD_MIME)) {
      return decodeClipboardEnvelope(await (await item.getType(CACABLU_CLIPBOARD_MIME)).text());
    }
    if (item.types.includes('text/html')) {
      const envelope = decodeEnvelopeFromHtml(await (await item.getType('text/html')).text());
      if (envelope) return envelope;
    }
  }
  return null;
}

export function decodeClipboardEnvelope(json: string): CacabluClipboardEnvelope {
  if (json.length === 0 || json.length > MAX_ENVELOPE_CHARS) {
    throw new Error('The Cacablu clipboard payload is empty or too large.');
  }
  let input: unknown;
  try {
    input = JSON.parse(json);
  } catch {
    throw new Error('The Cacablu clipboard payload is not valid JSON.');
  }
  const record = requireRecord(input, 'clipboard envelope');
  if (record.app !== CACABLU_CLIPBOARD_APP) throw new Error('The clipboard data does not belong to Cacablu.');
  if (record.version !== CACABLU_CLIPBOARD_VERSION) throw new Error('This Cacablu clipboard version is not supported.');
  if (typeof record.createdAt !== 'string' || !Number.isFinite(Date.parse(record.createdAt))) {
    throw new Error('The Cacablu clipboard timestamp is invalid.');
  }
  if (record.kind === 'bars') {
    return {
      app: CACABLU_CLIPBOARD_APP,
      version: CACABLU_CLIPBOARD_VERSION,
      kind: 'bars',
      createdAt: record.createdAt,
      payload: decodeBarPayload(record.payload),
    };
  }
  if (record.kind === 'pool') {
    return {
      app: CACABLU_CLIPBOARD_APP,
      version: CACABLU_CLIPBOARD_VERSION,
      kind: 'pool',
      createdAt: record.createdAt,
      payload: decodePoolPayload(record.payload),
    };
  }
  throw new Error('The Cacablu clipboard payload kind is not supported.');
}

export function poolClipboardRootsToAssetNodes(payload: PoolClipboardEnvelope['payload']): AssetClipboardNode[] {
  let totalBytes = 0;
  let totalNodes = 0;
  const convert = (node: PoolClipboardNode, depth: number): AssetClipboardNode => {
    totalNodes += 1;
    if (totalNodes > MAX_POOL_NODES || depth > MAX_POOL_DEPTH) {
      throw new Error('The Pool clipboard hierarchy is too large or too deep.');
    }
    if (node.kind === 'folder') {
      return {
        kind: 'folder',
        sourceId: node.sourceId,
        name: node.name,
        path: normalizePoolPath(node.path),
        enabled: node.enabled,
        children: node.children.map((child) => convert(child, depth + 1)),
      };
    }
    const data = base64ToBytes(node.dataBase64);
    totalBytes += data.byteLength;
    if (totalBytes > MAX_POOL_BYTES) throw new Error('The Pool clipboard file data is too large.');
    if (data.byteLength !== node.bytes) throw new Error(`Clipboard file ${node.name} has an invalid byte count.`);
    return {
      kind: 'file',
      sourceId: node.sourceId,
      name: node.name,
      path: normalizePoolPath(node.path),
      bytes: node.bytes,
      type: node.type,
      data,
      format: node.format,
      enabled: node.enabled,
    };
  };
  return payload.roots.map((root) => convert(root, 0));
}

function encodeClipboardFormats(envelope: CacabluClipboardEnvelope): Record<string, string> {
  const json = JSON.stringify(envelope);
  if (json.length > MAX_ENVELOPE_CHARS) throw new Error('The Cacablu clipboard payload is too large.');
  const encoded = bytesToBase64(new TextEncoder().encode(json));
  return {
    [CACABLU_CLIPBOARD_MIME]: json,
    'text/html': `${HTML_MARKER_PREFIX}${encoded}${HTML_MARKER_SUFFIX}`,
    'text/plain': getClipboardPlainText(envelope),
  };
}

function decodeEnvelopeFromHtml(html: string): CacabluClipboardEnvelope | null {
  const start = html.indexOf(HTML_MARKER_PREFIX);
  if (start < 0) return null;
  const valueStart = start + HTML_MARKER_PREFIX.length;
  const end = html.indexOf(HTML_MARKER_SUFFIX, valueStart);
  if (end < 0) throw new Error('The Cacablu clipboard HTML marker is incomplete.');
  const encoded = html.slice(valueStart, end);
  if (encoded.length > Math.ceil(MAX_ENVELOPE_CHARS * 4 / 3) + 8) {
    throw new Error('The Cacablu clipboard HTML payload is too large.');
  }
  return decodeClipboardEnvelope(new TextDecoder().decode(base64ToBytes(encoded)));
}

function barToClipboardEntry(bar: DbBar): BarClipboardEntry {
  return {
    sourceId: bar.id,
    name: bar.name,
    type: bar.type,
    layer: bar.layer,
    startTime: bar.startTime,
    endTime: bar.endTime,
    enabled: bar.enabled,
    script: bar.script,
    srcBlending: bar.srcBlending,
    dstBlending: bar.dstBlending,
    blendingEQ: bar.blendingEQ,
    srcAlpha: bar.srcAlpha,
    dstAlpha: bar.dstAlpha,
  };
}

function assetNodeToClipboardNode(node: AssetClipboardNode): PoolClipboardNode {
  if (node.kind === 'folder') {
    return {
      kind: 'folder',
      sourceId: node.sourceId,
      name: node.name,
      path: normalizePoolPath(node.path),
      enabled: node.enabled,
      children: node.children.map(assetNodeToClipboardNode),
    };
  }
  return {
    kind: 'file',
    sourceId: node.sourceId,
    name: node.name,
    path: normalizePoolPath(node.path),
    bytes: node.bytes,
    type: node.type,
    dataBase64: bytesToBase64(node.data),
    format: node.format,
    enabled: node.enabled,
  };
}

function decodeBarPayload(input: unknown): BarClipboardPayload {
  const payload = requireRecord(input, 'bar payload');
  const anchorStart = requireFinite(payload.anchorStart, 'bar anchor start');
  const anchorLayer = requireInteger(payload.anchorLayer, 'bar anchor layer');
  if (!Array.isArray(payload.bars) || payload.bars.length === 0) throw new Error('The bar clipboard is empty.');
  const sourceIds = new Set<number>();
  const bars = payload.bars.map((value) => {
    const bar = requireRecord(value, 'bar');
    const sourceId = requireSafeId(bar.sourceId, 'bar source id');
    if (sourceIds.has(sourceId)) throw new Error(`The clipboard contains duplicate bar id ${sourceId}.`);
    sourceIds.add(sourceId);
    const startTime = requireFinite(bar.startTime, 'bar start time');
    const endTime = requireFinite(bar.endTime, 'bar end time');
    if (endTime < startTime) throw new Error(`Clipboard bar ${sourceId} ends before it starts.`);
    return {
      sourceId,
      name: requireString(bar.name, 'bar name'),
      type: requireString(bar.type, 'bar type'),
      layer: requireInteger(bar.layer, 'bar layer'),
      startTime,
      endTime,
      enabled: requireBoolean(bar.enabled, 'bar enabled'),
      script: requireString(bar.script, 'bar script'),
      srcBlending: requireString(bar.srcBlending, 'bar source blending'),
      dstBlending: requireString(bar.dstBlending, 'bar destination blending'),
      blendingEQ: requireString(bar.blendingEQ, 'bar blend equation'),
      srcAlpha: requireString(bar.srcAlpha, 'bar source alpha'),
      dstAlpha: requireString(bar.dstAlpha, 'bar destination alpha'),
    };
  });
  if (anchorStart !== Math.min(...bars.map((bar) => bar.startTime))) throw new Error('The bar clipboard start anchor is invalid.');
  if (anchorLayer !== Math.min(...bars.map((bar) => bar.layer))) throw new Error('The bar clipboard layer anchor is invalid.');
  return { anchorStart, anchorLayer, bars };
}

function decodePoolPayload(input: unknown): PoolClipboardEnvelope['payload'] {
  const payload = requireRecord(input, 'Pool payload');
  if (!Array.isArray(payload.roots) || payload.roots.length === 0) throw new Error('The Pool clipboard is empty.');
  let totalNodes = 0;
  const decodeNode = (value: unknown, depth: number): PoolClipboardNode => {
    totalNodes += 1;
    if (totalNodes > MAX_POOL_NODES || depth > MAX_POOL_DEPTH) {
      throw new Error('The Pool clipboard hierarchy is too large or too deep.');
    }
    const node = requireRecord(value, 'Pool node');
    const sourceId = requireSafeId(node.sourceId, 'Pool source id');
    const name = requireName(node.name);
    const path = normalizePoolPath(requireString(node.path, 'Pool path'));
    const enabled = requireBoolean(node.enabled, 'Pool enabled');
    if (node.kind === 'folder') {
      if (!Array.isArray(node.children)) throw new Error(`Clipboard folder ${name} has invalid children.`);
      return {
        kind: 'folder',
        sourceId,
        name,
        path,
        enabled,
        children: node.children.map((child) => decodeNode(child, depth + 1)),
      };
    }
    if (node.kind !== 'file') throw new Error('The Pool clipboard node kind is invalid.');
    const bytes = requireInteger(node.bytes, 'Pool file bytes');
    if (bytes < 0 || bytes > MAX_POOL_BYTES) throw new Error(`Clipboard file ${name} has an invalid size.`);
    const dataBase64 = requireString(node.dataBase64, 'Pool file data');
    return {
      kind: 'file',
      sourceId,
      name,
      path,
      bytes,
      type: requireString(node.type, 'Pool file type'),
      dataBase64,
      format: requireString(node.format, 'Pool file format'),
      enabled,
    };
  };
  const roots = payload.roots.map((root) => decodeNode(root, 0));
  poolClipboardRootsToAssetNodes({ roots });
  return { roots };
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`The ${label} is invalid.`);
  return value as Record<string, unknown>;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== 'string') throw new Error(`The ${label} is invalid.`);
  return value;
}

function requireName(value: unknown): string {
  const name = requireString(value, 'Pool name');
  const hasControlCharacter = [...name].some((character) => character.charCodeAt(0) < 32);
  if (!name || name === '.' || name === '..' || name.includes('/') || name.includes('\\') || hasControlCharacter) {
    throw new Error('The Pool clipboard contains an invalid name.');
  }
  return name;
}

function requireBoolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`The ${label} is invalid.`);
  return value;
}

function requireFinite(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`The ${label} is invalid.`);
  return value;
}

function requireInteger(value: unknown, label: string): number {
  const number = requireFinite(value, label);
  if (!Number.isInteger(number)) throw new Error(`The ${label} is invalid.`);
  return number;
}

function requireSafeId(value: unknown, label: string): number {
  const id = requireInteger(value, label);
  if (!Number.isSafeInteger(id) || id < 0) throw new Error(`The ${label} is invalid.`);
  return id;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.byteLength; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + chunkSize, bytes.byteLength)));
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(value) || value.length % 4 === 1) {
    throw new Error('The Pool clipboard contains invalid base64 data.');
  }
  let binary: string;
  try {
    binary = atob(value);
  } catch {
    throw new Error('The Pool clipboard contains invalid base64 data.');
  }
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}
