import type { GroupPanelPartInitParameters } from 'dockview-core';

import type { DbSessionRef } from '../db/db-session';
import type { DbState } from '../state/db-state';
import type { AppState } from '../state/app-state';
import { LOG_DETAIL_OPTIONS, createPhoenixDemoSettingsClient, type LogDetail } from '../phoenix/demo-settings-client';
import {
  buildDemoSettingsPayload,
  calculateDemoEnd,
  cloneDemoSettingsDraft,
  demoSettingsFromProject,
  validateDemoSettingsDraft,
  type DemoSettingsDraft,
  type DemoSettingsValidationError,
} from '../services/demo-settings';
import { createContentRenderer } from './base-panel';

export function createDemoSettingsPanel(
  state: AppState,
  dbState: DbState,
  sessionRef: DbSessionRef,
) {
  const phoenixDemoSettings = createPhoenixDemoSettingsClient();

  return createContentRenderer((element, params) => {
    element.className = 'panel panel--demo-settings';

    function render(): void {
      const draft = demoSettingsFromProject(sessionRef.current?.data ?? null);
      renderDemoSettingsContent(element, {
        initialDraft: draft,
        getDemoEnd: () => calculateDemoEnd(sessionRef.current?.data ?? null),
        hasProject: () => Boolean(sessionRef.current),
        async onApply(nextDraft, demoEnd) {
          const session = sessionRef.current;
          if (!session) {
            const message = 'Load a project before applying demo settings.';
            state.addEvent({ severity: 'warning', source: 'Demo Settings', description: message });
            throw new Error(message);
          }

          session.updateDemoSettings(nextDraft);
          dbState.setDirty();

          if (state.getSnapshot().connectionStatus !== 'connected') {
            state.addEvent({
              severity: 'warning',
              source: 'Demo Settings',
              description: 'Demo settings saved in the project DB. Phoenix is not connected, so control.spo was not updated.',
            });
            return;
          }

          const result = await phoenixDemoSettings.putSettings(buildDemoSettingsPayload(nextDraft, demoEnd));
          for (const warning of result.warnings) {
            state.addEvent({ severity: 'warning', source: 'Demo Settings', description: warning.message });
          }
          state.addEvent({ severity: 'info', source: 'Demo Settings', description: 'Demo settings applied to Phoenix.' });
        },
        onCancel() {
          closePanel(params);
        },
      });
    }

    let lastProjectFileName: string | null | undefined;
    const unsubscribe = dbState.subscribe((snapshot) => {
      if (snapshot.fileName === lastProjectFileName) return;
      lastProjectFileName = snapshot.fileName;
      render();
    });
    return unsubscribe;
  });
}

interface DemoSettingsContentOptions {
  initialDraft: DemoSettingsDraft;
  getDemoEnd(): number;
  hasProject(): boolean;
  onApply(draft: DemoSettingsDraft, demoEnd: number): Promise<void>;
  onCancel(): void;
}

function renderDemoSettingsContent(host: HTMLElement, options: DemoSettingsContentOptions): void {
  let draft = cloneDemoSettingsDraft(options.initialDraft);
  host.replaceChildren();

  const form = document.createElement('div');
  form.className = 'demo-settings-dialog';

  const fields = document.createElement('div');
  fields.className = 'demo-settings-dialog__fields';

  const title = createTextInput(draft.demoName, (value) => { draft.demoName = value; });
  const loop = createCheckbox(draft.loop, (value) => { draft.loop = value; });
  const sound = createCheckbox(draft.sound, (value) => { draft.sound = value; });
  const debugGrid = createCheckbox(draft.debugGrid, (value) => { draft.debugGrid = value; });
  const logDetail = createSelect(
    LOG_DETAIL_OPTIONS.map((option) => ({ label: option.label, value: String(option.value) })),
    String(draft.logDetail),
    (value) => { draft.logDetail = Number.parseInt(value, 10) as LogDetail; },
  );
  const demoEnd = document.createElement('output');
  demoEnd.className = 'demo-settings-dialog__output';

  fields.append(
    labeled('Title', title, 'demoName'),
    labeled('', checkboxLabel(loop, 'Loop demo'), 'loop'),
    labeled('', checkboxLabel(sound, 'Sound'), 'sound'),
    labeled('', checkboxLabel(debugGrid, 'Debug grid'), 'debugGrid'),
    labeled('Log detail', logDetail, 'logDetail'),
    labeled('Demo end', demoEnd, 'demoEnd'),
  );

  const errorBox = document.createElement('div');
  errorBox.className = 'demo-settings-dialog__errors';
  errorBox.hidden = true;

  const footer = document.createElement('div');
  footer.className = 'graphics-dialog__footer';
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.textContent = 'Cancel';
  const ok = document.createElement('button');
  ok.type = 'button';
  ok.className = 'graphics-dialog__ok';
  ok.textContent = 'OK';
  footer.append(cancel, ok);

  function refreshDerivedState(): void {
    const value = options.getDemoEnd();
    demoEnd.value = formatTime(value);
    demoEnd.textContent = `${formatTime(value)}s`;
    ok.disabled = !options.hasProject();
  }

  cancel.addEventListener('click', options.onCancel);
  ok.addEventListener('click', async () => {
    clearErrors(form, errorBox);
    const nextDemoEnd = options.getDemoEnd();
    const errors = validateDemoSettingsDraft(draft, nextDemoEnd);
    if (errors.length > 0) {
      showErrors(form, errorBox, errors);
      return;
    }

    ok.disabled = true;
    cancel.disabled = true;
    try {
      await options.onApply(cloneDemoSettingsDraft(draft), nextDemoEnd);
      options.onCancel();
    } catch (error) {
      errorBox.hidden = false;
      errorBox.textContent = error instanceof Error ? error.message : 'Could not apply demo settings.';
    } finally {
      cancel.disabled = false;
      refreshDerivedState();
    }
  });

  form.append(fields, errorBox, footer);
  host.append(form);
  refreshDerivedState();
  title.focus();
}

function labeled(labelText: string, control: HTMLElement, path: string): HTMLElement {
  const label = document.createElement('label');
  label.className = 'demo-settings-dialog__field';
  label.dataset.path = path;
  const span = document.createElement('span');
  span.textContent = labelText;
  label.append(span, control);
  return label;
}

function checkboxLabel(input: HTMLInputElement, text: string): HTMLElement {
  const wrap = document.createElement('span');
  wrap.className = 'graphics-dialog__checkbox';
  const label = document.createElement('span');
  label.textContent = text;
  wrap.append(input, label);
  return wrap;
}

function createTextInput(value: string, onChange: (value: string) => void): HTMLInputElement {
  const input = document.createElement('input');
  input.className = 'graphics-dialog__control';
  input.type = 'text';
  input.value = value;
  input.addEventListener('input', () => onChange(input.value));
  return input;
}

function createCheckbox(value: boolean, onChange: (value: boolean) => void): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = value;
  input.addEventListener('change', () => onChange(input.checked));
  return input;
}

function createSelect(options: Array<{ label: string; value: string }>, value: string, onChange: (value: string) => void): HTMLSelectElement {
  const select = document.createElement('select');
  select.className = 'graphics-dialog__control';
  options.forEach((option) => {
    const item = document.createElement('option');
    item.value = option.value;
    item.textContent = option.label;
    select.append(item);
  });
  select.value = value;
  select.addEventListener('change', () => onChange(select.value));
  return select;
}

function clearErrors(root: HTMLElement, errorBox: HTMLElement): void {
  root.querySelectorAll('.graphics-dialog__invalid').forEach((element) => {
    element.classList.remove('graphics-dialog__invalid');
  });
  errorBox.hidden = true;
  errorBox.textContent = '';
}

function showErrors(root: HTMLElement, errorBox: HTMLElement, errors: DemoSettingsValidationError[]): void {
  for (const error of errors) {
    root.querySelectorAll<HTMLElement>(`[data-path="${CSS.escape(error.path)}"]`).forEach((element) => {
      element.classList.add('graphics-dialog__invalid');
    });
  }
  errorBox.hidden = false;
  errorBox.textContent = errors.slice(0, 3).map((error) => error.message).join(' ');
}

function formatTime(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
}

function closePanel(params: GroupPanelPartInitParameters): void {
  const api = params.api as unknown as { close?: () => void };
  api.close?.();
}
