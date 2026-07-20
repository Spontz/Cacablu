import { describe, expect, it } from 'vitest';

import {
  CACABLU_CLIPBOARD_MIME,
  createBarClipboardEnvelope,
  createPoolClipboardEnvelope,
  decodeClipboardEnvelope,
  poolClipboardRootsToAssetNodes,
  readEnvelopeFromDataTransfer,
  writeEnvelopeToDataTransfer,
} from '../../src/services/cross-project-clipboard';

function createClipboardData(): DataTransfer {
  const values = new Map<string, string>();
  return {
    get types() {
      return [...values.keys()];
    },
    getData: (type: string) => values.get(type) ?? '',
    setData: (type: string, value: string) => {
      values.set(type, value);
    },
  } as unknown as DataTransfer;
}

describe('cross-project clipboard', () => {
  it('round-trips all Timeline bar properties through the rich clipboard', () => {
    const envelope = createBarClipboardEnvelope([
      {
        id: 8,
        name: 'Second',
        type: 'shader',
        layer: 5,
        startTime: 12,
        endTime: 14,
        enabled: false,
        selected: true,
        script: 'pool/scripts/second.lua',
        srcBlending: 'SRC_ALPHA',
        dstBlending: 'ONE',
        blendingEQ: 'ADD',
        srcAlpha: 'ONE',
        dstAlpha: 'ZERO',
      },
      {
        id: 3,
        name: 'First',
        type: 'image',
        layer: 2,
        startTime: 10,
        endTime: 11,
        enabled: true,
        selected: false,
        script: 'pool/images/first.png',
        srcBlending: 'ONE',
        dstBlending: 'ZERO',
        blendingEQ: '',
        srcAlpha: '',
        dstAlpha: '',
      },
    ]);
    const clipboard = createClipboardData();

    writeEnvelopeToDataTransfer(clipboard, envelope);

    expect(clipboard.types).toContain(CACABLU_CLIPBOARD_MIME);
    expect(readEnvelopeFromDataTransfer(clipboard)).toEqual(envelope);
    expect(envelope.payload).toMatchObject({
      anchorStart: 10,
      anchorLayer: 2,
      bars: [{ sourceId: 3 }, { sourceId: 8 }],
    });
  });

  it('round-trips nested Pool folders and binary file bytes', () => {
    const envelope = createPoolClipboardEnvelope([
      {
        kind: 'folder',
        sourceId: 4,
        name: 'media',
        path: '/pool/media',
        enabled: true,
        children: [{
          kind: 'file',
          sourceId: 9,
          name: 'pixel.bin',
          path: '/pool/media/pixel.bin',
          bytes: 4,
          type: 'application/octet-stream',
          data: new Uint8Array([0, 127, 128, 255]),
          format: 'binary',
          enabled: false,
        }],
      },
    ]);
    const clipboard = createClipboardData();
    writeEnvelopeToDataTransfer(clipboard, envelope);

    const decoded = readEnvelopeFromDataTransfer(clipboard);
    expect(decoded?.kind).toBe('pool');
    if (!decoded || decoded.kind !== 'pool') throw new Error('Expected Pool clipboard data.');
    expect(poolClipboardRootsToAssetNodes(decoded.payload)).toEqual([
      {
        kind: 'folder',
        sourceId: 4,
        name: 'media',
        path: '/pool/media',
        enabled: true,
        children: [{
          kind: 'file',
          sourceId: 9,
          name: 'pixel.bin',
          path: '/pool/media/pixel.bin',
          bytes: 4,
          type: 'application/octet-stream',
          data: new Uint8Array([0, 127, 128, 255]),
          format: 'binary',
          enabled: false,
        }],
      },
    ]);
  });

  it('rejects unsupported versions and malformed payloads', () => {
    expect(() => decodeClipboardEnvelope(JSON.stringify({
      app: 'cacablu',
      version: 99,
      kind: 'bars',
      createdAt: new Date().toISOString(),
      payload: {},
    }))).toThrow(/version/i);

    expect(() => decodeClipboardEnvelope('{broken')).toThrow(/JSON/i);
  });

  it('ignores untrusted plain text and rejects malformed Pool paths and binary lengths', () => {
    const plainText = createClipboardData();
    plainText.setData('text/plain', '{"app":"cacablu"}');
    expect(readEnvelopeFromDataTransfer(plainText)).toBeNull();

    const baseEnvelope = {
      app: 'cacablu',
      version: 1,
      kind: 'pool',
      createdAt: new Date().toISOString(),
    };
    const file = {
      kind: 'file',
      sourceId: 1,
      name: 'file.bin',
      path: '/pool/file.bin',
      bytes: 1,
      type: 'application/octet-stream',
      dataBase64: 'AA==',
      format: 'binary',
      enabled: true,
    };

    expect(() => decodeClipboardEnvelope(JSON.stringify({
      ...baseEnvelope,
      payload: { roots: [{ ...file, path: '/pool/../file.bin' }] },
    }))).toThrow(/traversal/i);
    expect(() => decodeClipboardEnvelope(JSON.stringify({
      ...baseEnvelope,
      payload: { roots: [{ ...file, name: '../file.bin' }] },
    }))).toThrow(/invalid name/i);
    expect(() => decodeClipboardEnvelope(JSON.stringify({
      ...baseEnvelope,
      payload: { roots: [{ ...file, bytes: 2 }] },
    }))).toThrow(/byte count/i);
    expect(() => decodeClipboardEnvelope(JSON.stringify({
      ...baseEnvelope,
      payload: { roots: [{ ...file, bytes: 64 * 1024 * 1024 + 1 }] },
    }))).toThrow(/invalid size/i);
  });
});
