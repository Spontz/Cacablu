import type { ProjectDatabase } from '../db/db-schema';
import type { PhoenixDemoSettingsClient, DemoSettingsResponse } from '../phoenix/demo-settings-client';
import { buildDemoSettingsPayload, calculateDemoEnd, demoSettingsFromProject } from './demo-settings';

export interface ProjectDemoSettingsSyncProgress {
  phase: 'sections' | 'complete' | 'error';
  current: number;
  total: number;
  copied: number;
  skipped: number;
  failed: number;
  message: string;
  indeterminate?: boolean;
}

type ProgressListener = (progress: ProjectDemoSettingsSyncProgress) => void;

export interface ProjectDemoSettingsSyncOptions {
  signal?: AbortSignal;
}

export async function syncProjectDemoSettingsToPhoenix(
  db: Pick<ProjectDatabase, 'bars' | 'variables'>,
  client: Pick<PhoenixDemoSettingsClient, 'putSettings'>,
  onProgress: ProgressListener,
  options: ProjectDemoSettingsSyncOptions = {},
): Promise<DemoSettingsResponse> {
  throwIfAborted(options.signal);

  const draft = demoSettingsFromProject(db);
  const demoEnd = calculateDemoEnd(db);
  const payload = buildDemoSettingsPayload(draft, demoEnd);

  onProgress({
    phase: 'sections',
    current: 0,
    total: 0,
    copied: 0,
    skipped: 0,
    failed: 0,
    message: 'Transmitting demo settings...',
    indeterminate: true,
  });

  const result = await client.putSettings(payload, options.signal);

  onProgress({
    phase: 'complete',
    current: 1,
    total: 1,
    copied: 1,
    skipped: 0,
    failed: 0,
    message: 'Phoenix demo settings synced.',
  });

  return result;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  throw signal.reason instanceof Error ? signal.reason : new DOMException('Demo settings sync cancelled.', 'AbortError');
}
