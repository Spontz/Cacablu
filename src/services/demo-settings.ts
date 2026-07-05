import type { ProjectDatabase } from '../db/db-schema';
import { LOG_DETAIL_OPTIONS, type DemoSettings, type LogDetail } from '../phoenix/demo-settings-client';

export interface DemoSettingsDraft {
  demoName: string;
  loop: boolean;
  sound: boolean;
  debugGrid: boolean;
  logDetail: LogDetail;
}

export interface DemoSettingsValidationError {
  path: string;
  message: string;
}

export function demoSettingsFromProject(db: Pick<ProjectDatabase, 'variables'> | null): DemoSettingsDraft {
  const variables = db?.variables ?? new Map<string, string>();
  return {
    demoName: readString(variables, ['demoName', 'demo_name'], 'Phoenix demo engine'),
    loop: readBoolean(variables, ['demoLoop', 'loop'], true),
    sound: readBoolean(variables, ['demoSound', 'sound'], true),
    debugGrid: readBoolean(variables, ['debugEnableGrid', 'debugEnableFloor'], true),
    logDetail: readLogDetail(variables, ['logDetail', 'log_detail'], 1),
  };
}

export function calculateDemoEnd(db: Pick<ProjectDatabase, 'bars'> | null): number {
  if (!db || db.bars.length === 0) return 0;
  return db.bars.reduce((max, bar) => (
    Number.isFinite(bar.endTime) && bar.endTime > max ? bar.endTime : max
  ), 0);
}

export function buildDemoSettingsPayload(draft: DemoSettingsDraft, demoEnd: number): DemoSettings {
  return {
    ...draft,
    demoName: draft.demoName.trim(),
    demoEnd,
  };
}

export function validateDemoSettingsDraft(draft: DemoSettingsDraft, demoEnd: number): DemoSettingsValidationError[] {
  const errors: DemoSettingsValidationError[] = [];
  if (draft.demoName.trim().length === 0) {
    errors.push({ path: 'demoName', message: 'Demo title is required.' });
  }
  if (!Number.isFinite(demoEnd) || demoEnd < 0) {
    errors.push({ path: 'demoEnd', message: 'Demo end could not be calculated from the timeline.' });
  }
  if (!LOG_DETAIL_OPTIONS.some((option) => option.value === draft.logDetail)) {
    errors.push({ path: 'logDetail', message: 'Log detail is not supported.' });
  }
  return errors;
}

export function cloneDemoSettingsDraft(draft: DemoSettingsDraft): DemoSettingsDraft {
  return { ...draft };
}

function readString(variables: ReadonlyMap<string, string>, keys: readonly string[], fallback: string): string {
  for (const key of keys) {
    const value = variables.get(key);
    if (value && value.trim().length > 0) return value;
  }
  return fallback;
}

function readBoolean(variables: ReadonlyMap<string, string>, keys: readonly string[], fallback: boolean): boolean {
  for (const key of keys) {
    const raw = variables.get(key);
    if (raw !== undefined && raw !== '') return raw === '1' || raw.toLowerCase() === 'true';
  }
  return fallback;
}

function readLogDetail(variables: ReadonlyMap<string, string>, keys: readonly string[], fallback: LogDetail): LogDetail {
  for (const key of keys) {
    const value = Number.parseInt(variables.get(key) ?? '', 10);
    const normalized = value === 4 ? 3 : value;
    if (LOG_DETAIL_OPTIONS.some((option) => option.value === normalized)) return normalized as LogDetail;
  }
  return fallback;
}
