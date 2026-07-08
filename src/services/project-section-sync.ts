import type { ProjectDatabase } from '../db/db-schema';
import type { PhoenixSectionClient, PhoenixSectionPayload, PhoenixSectionManifestEntry } from '../phoenix/section-client';

export interface ProjectSectionSyncProgress {
  phase: 'sections' | 'complete' | 'error';
  current: number;
  total: number;
  copied: number;
  skipped: number;
  failed: number;
  message: string;
  indeterminate?: boolean;
}

export interface ProjectSectionSyncResult {
  total: number;
  valid: number;
  invalid: number;
  replaced: boolean;
  skipped: number;
  issues: ProjectSectionSyncIssue[];
}

export interface ProjectSectionSyncIssue {
  barId: number;
  sectionType: string;
  description: string;
  kind: 'unsupported-type' | 'load-failed';
}

export class ProjectSectionSyncError extends Error {
  readonly issues: ProjectSectionSyncIssue[];

  constructor(issues: ProjectSectionSyncIssue[]) {
    super(`Unsupported Phoenix section types: ${issues.map((issue) => `bar ${issue.barId} (${issue.sectionType})`).join(', ')}`);
    this.name = 'ProjectSectionSyncError';
    this.issues = issues;
  }
}

export interface ProjectSectionCollection {
  sections: PhoenixSectionPayload[];
  issues: ProjectSectionSyncIssue[];
}

type ProgressListener = (progress: ProjectSectionSyncProgress) => void;

export interface ProjectSectionSyncOptions {
  signal?: AbortSignal;
}

export async function syncProjectBarsToPhoenix(
  db: Pick<ProjectDatabase, 'bars'>,
  client: Pick<PhoenixSectionClient, 'fetchManifest' | 'replaceAll'> & Partial<Pick<PhoenixSectionClient, 'fetchSyncStatus'>>,
  onProgress: ProgressListener,
  options: ProjectSectionSyncOptions = {},
): Promise<ProjectSectionSyncResult> {
  throwIfAborted(options.signal);
  const { sections, issues } = collectPhoenixSections(db);
  if (sections.length === 0 && issues.length > 0) {
    throw new ProjectSectionSyncError(issues);
  }

  const expected = await buildExpectedSectionManifestEntries(sections, onProgress, options.signal);

  onProgress({
    phase: 'sections',
    current: 0,
    total: 0,
    copied: 0,
    skipped: 0,
    failed: 0,
    message: 'Checking Phoenix sections...',
  });

  const manifest = await client.fetchManifest(options.signal);
  if (await sectionManifestMatches(manifest.entries, expected, onProgress, options.signal)) {
    onProgress({
      phase: 'complete',
      current: sections.length,
      total: sections.length,
      copied: 0,
      skipped: sections.length,
      failed: 0,
      message: `Phoenix sections already match (${sections.length}/${sections.length}).`,
    });
    return { total: sections.length + issues.length, valid: sections.length, invalid: issues.length, replaced: false, skipped: sections.length, issues };
  }

  throwIfAborted(options.signal);
  onProgress({
    phase: 'sections',
    current: 0,
    total: sections.length,
    copied: sections.length,
    skipped: 0,
    failed: 0,
    message: 'Transmitting sections...',
    indeterminate: true,
  });

  const requestId = createSectionSyncRequestId();
  const replacePromise = client.replaceAll(sections, options.signal, requestId);
  await pollSectionSyncStatus(client, requestId, sections.length, onProgress, replacePromise, options.signal);
  const syncResult = await replacePromise;
  const loadIssues: ProjectSectionSyncIssue[] = syncResult.failedSections.map((section) => ({
    barId: Number.parseInt(section.id, 10),
    sectionType: sections.find((candidate) => candidate.id === section.id)?.type ?? '(unknown)',
    description: `Section ${section.id} was sent to Phoenix but did not load: ${section.message}.`,
    kind: 'load-failed',
  }));
  const allIssues = [...issues, ...loadIssues];
  onProgress({
    phase: allIssues.length > 0 ? 'error' : 'complete',
    current: sections.length,
    total: sections.length,
    copied: syncResult.loaded,
    skipped: 0,
    failed: allIssues.length,
    message: allIssues.length > 0
      ? `Phoenix sections sync finished with ${allIssues.length} issue(s): ${syncResult.loaded}/${sections.length} loaded.`
      : `Phoenix sections sync complete: ${sections.length} sent.`,
  });
  return { total: sections.length + issues.length, valid: sections.length, invalid: issues.length, replaced: true, skipped: 0, issues: allIssues };
}

export async function syncProjectBarToPhoenix(
  db: Pick<ProjectDatabase, 'bars'>,
  barId: number,
  client: Pick<PhoenixSectionClient, 'replaceOne'>,
  options: ProjectSectionSyncOptions = {},
): Promise<ProjectSectionSyncResult> {
  throwIfAborted(options.signal);
  const bar = db.bars.find((candidate) => candidate.id === barId);
  if (!bar) {
    return { total: 0, valid: 0, invalid: 0, replaced: false, skipped: 0, issues: [] };
  }

  const { sections, issues } = collectPhoenixSections({ bars: [bar] });
  if (sections.length === 0) {
    if (issues.length > 0) throw new ProjectSectionSyncError(issues);
    return { total: 1, valid: 0, invalid: 0, replaced: false, skipped: 0, issues };
  }

  const syncResult = await client.replaceOne(sections[0], options.signal);
  const loadIssues: ProjectSectionSyncIssue[] = syncResult.failedSections.map((section) => ({
    barId: Number.parseInt(section.id, 10),
    sectionType: sections[0].type,
    description: `Section ${section.id} was sent to Phoenix but did not load: ${section.message}.`,
    kind: 'load-failed',
  }));
  const allIssues = [...issues, ...loadIssues];
  return {
    total: 1 + issues.length,
    valid: 1,
    invalid: issues.length,
    replaced: true,
    skipped: 0,
    issues: allIssues,
  };
}

async function pollSectionSyncStatus(
  client: Partial<Pick<PhoenixSectionClient, 'fetchSyncStatus'>>,
  requestId: string,
  fallbackTotal: number,
  onProgress: ProgressListener,
  replacePromise: Promise<unknown>,
  signal?: AbortSignal,
): Promise<void> {
  if (!client.fetchSyncStatus) return;

  let settled = false;
  void replacePromise.then(
    () => { settled = true; },
    () => { settled = true; },
  );

  while (!settled) {
    throwIfAborted(signal);
    await delay(120);
    if (settled) break;

    try {
      const status = await client.fetchSyncStatus(requestId, signal);
      if (!status) continue;
      onProgress({
        phase: status.phase === 'error' ? 'error' : 'sections',
        current: status.total > 0 ? status.current : 0,
        total: status.total > 0 ? status.total : fallbackTotal,
        copied: status.loaded,
        skipped: 0,
        failed: status.failed,
        message: status.message,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') throw err;
    }
  }
}

function createSectionSyncRequestId(): string {
  return `sections-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function buildExpectedSectionManifestEntries(
  sections: PhoenixSectionPayload[],
  onProgress: ProgressListener,
  signal?: AbortSignal,
): Promise<PhoenixSectionManifestEntry[]> {
  const expected: PhoenixSectionManifestEntry[] = [];

  for (const [index, section] of sections.entries()) {
    throwIfAborted(signal);
    const current = index + 1;
    onProgress({
      phase: 'sections',
      current,
      total: sections.length,
      copied: current,
      skipped: 0,
      failed: 0,
      message: `Preparing Phoenix section ${section.id}...`,
    });

    const content = new TextEncoder().encode(buildSectionContentFromPayload(section));
    expected.push({
      id: section.id,
      type: section.type,
      startTime: section.startTime,
      endTime: section.endTime,
      enabled: section.enabled,
      layer: section.layer,
      srcBlending: section.srcBlending,
      dstBlending: section.dstBlending,
      blendingEQ: section.blendingEQ,
      contentHash: hashBytes(content),
      size: content.byteLength,
    });

    if (index % 8 === 7) {
      await yieldToBrowser();
    }
  }

  return expected;
}

export function collectPhoenixSections(db: Pick<ProjectDatabase, 'bars'>): ProjectSectionCollection {
  const bars = [...db.bars].filter((bar) => bar.enabled).sort(compareBarsForPhoenixLoad);
  const issues = bars
    .filter((bar) => bar.type.trim() !== '')
    .map((bar) => {
      const sectionType = bar.type.trim();
      return {
        barId: bar.id,
        sectionType,
        description: `Bar ${bar.id} was not sent to Phoenix because "${sectionType}" is not a supported Phoenix section type.`,
        kind: 'unsupported-type' as const,
      };
    })
    .filter((issue) => !isSupportedPhoenixSectionType(issue.sectionType));

  const sections = bars
    .filter((bar) => isSupportedPhoenixSectionType(bar.type))
    .map((bar) => ({
      id: String(bar.id),
      type: bar.type.trim(),
      startTime: bar.startTime,
      endTime: bar.endTime,
      enabled: bar.enabled,
      layer: bar.layer,
      srcBlending: bar.srcBlending,
      dstBlending: bar.dstBlending,
      blendingEQ: bar.blendingEQ,
      scriptBase64: textToBase64(normalizeSectionScriptLineEndings(toText(bar.script))),
    }));

  return { sections, issues };
}

function compareBarsForPhoenixLoad(
  left: ProjectDatabase['bars'][number],
  right: ProjectDatabase['bars'][number],
): number {
  return (
    left.layer - right.layer ||
    left.startTime - right.startTime ||
    left.endTime - right.endTime ||
    left.id - right.id
  );
}

const SUPPORTED_PHOENIX_SECTION_TYPES = new Set([
  'loading',
  'cameraFPS',
  'cameraTarget',
  'light',
  'drawScene',
  'drawSceneMatrix',
  'drawSceneMatrixFolder',
  'drawSceneMatrixInstanced',
  'drawSceneMatrixInstancedFolder',
  'drawImage',
  'drawSkybox',
  'drawVideo',
  'drawVolume',
  'drawVolumeImage',
  'drawQuad',
  'drawFbo',
  'drawFbo2',
  'drawParticles',
  'drawParticlesFbo',
  'drawParticlesImage',
  'drawParticlesScene',
  'drawEmitterScene',
  'drawEmitterSceneEx',
  'drawEmitterSpline',
  'sound',
  'setExpression',
  'fboBind',
  'fboUnbind',
  'efxAccum',
  'efxBloom',
  'efxBlur',
  'efxFader',
  'efxMotionBlur',
  'test',
]);

export function isSupportedPhoenixSectionType(type: string): boolean {
  return SUPPORTED_PHOENIX_SECTION_TYPES.has(type.trim());
}

async function sectionManifestMatches(
  actual: PhoenixSectionManifestEntry[],
  expected: PhoenixSectionManifestEntry[],
  onProgress: ProgressListener,
  signal?: AbortSignal,
): Promise<boolean> {
  if (actual.length !== expected.length) return false;

  const actualById = new Map(actual.map((entry) => [entry.id, entry]));
  for (const [index, entry] of expected.entries()) {
    throwIfAborted(signal);
    const current = index + 1;
    onProgress({
      phase: 'sections',
      current,
      total: expected.length,
      copied: current,
      skipped: 0,
      failed: 0,
      message: `Checking Phoenix section ${entry.id}...`,
    });

    const other = actualById.get(entry.id);
    if (!other) return false;
    if (
      other.type !== entry.type ||
      other.startTime !== entry.startTime ||
      other.endTime !== entry.endTime ||
      other.enabled !== entry.enabled ||
      other.layer !== entry.layer ||
      other.srcBlending !== entry.srcBlending ||
      other.dstBlending !== entry.dstBlending ||
      other.blendingEQ !== entry.blendingEQ ||
      other.contentHash !== entry.contentHash ||
      other.size !== entry.size
    ) {
      return false;
    }

    if (index % 8 === 7) {
      await yieldToBrowser();
    }
  }
  return true;
}

function buildSectionContentFromPayload(section: PhoenixSectionPayload): string {
  const script = fromBase64(section.scriptBase64);
  const header = [
    `:::${section.type}`,
    `id ${section.id}`,
    `start ${formatNumber(section.startTime)}`,
    `end ${formatNumber(section.endTime)}`,
    `enabled ${section.enabled ? 1 : 0}`,
    `layer ${section.layer}`,
  ];
  if (section.srcBlending.trim() !== '' && section.dstBlending.trim() !== '') {
    header.push(`blend ${section.srcBlending} ${section.dstBlending}`);
  }
  if (section.blendingEQ.trim() !== '') {
    header.push(`blendequation ${section.blendingEQ}`);
  }

  let content = [...header, '', script].join('\r\n');
  if (!content.endsWith('\n')) content += '\r\n';
  return content;
}

function hashBytes(value: Uint8Array): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.byteLength; index += 1) {
    hash ^= value[index];
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `fnv1a:${hash.toString(16).padStart(8, '0')}`;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value);
}

function normalizeSectionScriptLineEndings(value: string): string {
  return value.replace(/\r\n|\r|\n/g, '\r\n');
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  throw signal.reason instanceof Error ? signal.reason : new DOMException('Section sync cancelled.', 'AbortError');
}

function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, 0);
  });
}

function textToBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): string {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new TextDecoder().decode(bytes);
}

function toText(value: string | Uint8Array): string {
  return typeof value === 'string' ? value : new TextDecoder().decode(value);
}
