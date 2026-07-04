import type { GroupPanelPartInitParameters } from 'dockview-core';

import type { DbSessionRef } from '../db/db-session';
import type { DbState } from '../state/db-state';
import type { AppState } from '../state/app-state';
import { createPhoenixGraphicsClient } from '../phoenix/graphics-client';
import {
  GRAPHICS_FBO_FORMATS,
  type GraphicsConfig,
  type GraphicsFboFormat,
  type GraphicsFboRow,
  type GraphicsFilter,
} from '../phoenix/graphics-client';
import { createContentRenderer } from './base-panel';
import {
  cloneGraphicsConfig,
  graphicsConfigFromProject,
  toProjectFbos,
  validateGraphicsConfig,
  type GraphicsValidationError,
} from '../services/graphics-config';

const COLOR_DEPTH_OPTIONS = [
  { label: '16 bits', value: 16 },
  { label: '24 bits', value: 24 },
  { label: '32 bits (True Color)', value: 32 },
];

export function createGraphicsSettingsPanel(
  state: AppState,
  dbState: DbState,
  sessionRef: DbSessionRef,
) {
  const phoenixGraphics = createPhoenixGraphicsClient();

  return createContentRenderer((element, params) => {
    element.className = 'panel panel--graphics';

    function render(): void {
      const config = graphicsConfigFromProject(sessionRef.current?.data ?? { variables: new Map(), fbos: [] });
      renderGraphicsSettingsContent(element, {
        initialConfig: config,
        async onApply(nextConfig) {
          if (state.getSnapshot().connectionStatus !== 'connected') {
            const message = 'Phoenix must be connected to apply graphics settings.';
            state.addEvent({ severity: 'warning', source: 'Graphics', description: message });
            throw new Error(message);
          }

          sessionRef.current?.updateGraphicsConfig(nextConfig.context, toProjectFbos(nextConfig));
          if (sessionRef.current) dbState.setDirty();

          const result = await phoenixGraphics.putConfig(nextConfig);
          for (const warning of result.warnings) {
            state.addEvent({ severity: 'warning', source: 'Graphics', description: warning.message });
          }
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

interface GraphicsSettingsContentOptions {
  initialConfig: GraphicsConfig;
  onApply(config: GraphicsConfig): Promise<void>;
  onCancel(): void;
}

function renderGraphicsSettingsContent(host: HTMLElement, options: GraphicsSettingsContentOptions): void {
  const draft = cloneGraphicsConfig(options.initialConfig);
  host.replaceChildren();

  const form = document.createElement('div');
  form.className = 'graphics-dialog graphics-dialog--panel';

  const contextGroup = document.createElement('fieldset');
  contextGroup.className = 'graphics-dialog__fieldset';
  const legend = document.createElement('legend');
  legend.textContent = 'Rendering Context Settings';
  contextGroup.append(legend);

  const contextGrid = document.createElement('div');
  contextGrid.className = 'graphics-dialog__context-grid';

  const colorDepth = createSelect(
    COLOR_DEPTH_OPTIONS.map((option) => ({ label: option.label, value: String(option.value) })),
    String(draft.context.colorDepth),
    (value) => { draft.context.colorDepth = Number.parseInt(value, 10); },
  );
  const width = createNumberInput(draft.context.width, (value) => { draft.context.width = value; });
  const height = createNumberInput(draft.context.height, (value) => { draft.context.height = value; });
  const vsync = createSelect(
    [
      { label: 'No', value: '0' },
      { label: '60 fps', value: '60' },
    ],
    draft.context.vsync ? '60' : '0',
    (value) => {
      draft.context.vsync = value !== '0';
      draft.context.targetFps = draft.context.vsync ? Number.parseInt(value, 10) : null;
    },
  );
  const fullscreen = document.createElement('input');
  fullscreen.type = 'checkbox';
  fullscreen.checked = draft.context.fullscreen;
  fullscreen.addEventListener('change', () => { draft.context.fullscreen = fullscreen.checked; });

  contextGrid.append(
    labeled('Color Depth:', colorDepth, 'context.colorDepth'),
    labeled('Width:', width, 'context.width'),
    labeled('V-sync:', vsync, 'context.vsync'),
    labeled('', checkboxLabel(fullscreen, 'Full Screen'), 'context.fullscreen'),
    labeled('Height:', height, 'context.height'),
  );
  contextGroup.append(contextGrid);

  const tableWrap = document.createElement('div');
  tableWrap.className = 'graphics-dialog__table-wrap';
  const table = document.createElement('table');
  table.className = 'graphics-dialog__table';
  table.append(createHeader());
  const body = document.createElement('tbody');
  draft.fbos.forEach((fbo) => body.append(createFboRow(fbo)));
  table.append(body);
  tableWrap.append(table);

  const errorBox = document.createElement('div');
  errorBox.className = 'graphics-dialog__errors';
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

  cancel.addEventListener('click', options.onCancel);
  ok.addEventListener('click', async () => {
    clearErrors(form, errorBox);
    const errors = validateGraphicsConfig(draft);
    if (errors.length > 0) {
      showErrors(form, errorBox, errors);
      return;
    }
    ok.disabled = true;
    cancel.disabled = true;
    try {
      await options.onApply(cloneGraphicsConfig(draft));
      errorBox.hidden = false;
      errorBox.textContent = 'Graphics settings applied.';
    } catch (error) {
      errorBox.hidden = false;
      errorBox.textContent = error instanceof Error ? error.message : 'Could not apply graphics settings.';
    } finally {
      ok.disabled = false;
      cancel.disabled = false;
    }
  });

  form.append(contextGroup, tableWrap, errorBox, footer);
  host.append(form);
  width.focus();
}

function createHeader(): HTMLTableSectionElement {
  const head = document.createElement('thead');
  const row = document.createElement('tr');
  ['FBO', 'Ratio', 'Format', 'Width', 'Height', 'Attachments', 'Filter'].forEach((label) => {
    const th = document.createElement('th');
    th.textContent = label;
    row.append(th);
  });
  head.append(row);
  return head;
}

function createFboRow(fbo: GraphicsFboRow): HTMLTableRowElement {
  const row = document.createElement('tr');
  row.append(
    textCell(String(fbo.dbId ?? fbo.index + 1)),
    controlCell(createNullableNumberInput(fbo.ratio, (value) => { fbo.ratio = value; }, fbo.index >= 20), `fbos[${fbo.index}].ratio`),
    controlCell(createSelect(
      GRAPHICS_FBO_FORMATS.map((format) => ({ label: format, value: format })),
      fbo.format,
      (value) => { fbo.format = value as GraphicsFboFormat; },
    ), `fbos[${fbo.index}].format`),
    controlCell(createNullableNumberInput(fbo.width, (value) => { fbo.width = value; }, fbo.index < 20), `fbos[${fbo.index}].width`),
    controlCell(createNullableNumberInput(fbo.height, (value) => { fbo.height = value; }, fbo.index < 20), `fbos[${fbo.index}].height`),
    controlCell(createNumberInput(fbo.attachments, (value) => { fbo.attachments = value; }), `fbos[${fbo.index}].attachments`),
    controlCell(createSelect(
      [
        { label: 'Bilinear', value: 'bilinear' },
        { label: 'No', value: 'none' },
      ],
      fbo.filter,
      (value) => { fbo.filter = value as GraphicsFilter; },
    ), `fbos[${fbo.index}].filter`),
  );
  return row;
}

function labeled(labelText: string, control: HTMLElement, path: string): HTMLElement {
  const label = document.createElement('label');
  label.className = 'graphics-dialog__field';
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

function createNumberInput(value: number, onChange: (value: number) => void): HTMLInputElement {
  const input = document.createElement('input');
  input.className = 'graphics-dialog__control';
  input.type = 'number';
  input.min = '1';
  input.step = '1';
  input.value = String(value);
  input.addEventListener('input', () => onChange(Number.parseInt(input.value, 10)));
  return input;
}

function createNullableNumberInput(value: number | null, onChange: (value: number | null) => void, disabled: boolean): HTMLInputElement {
  const input = createNumberInput(value ?? 0, (next) => onChange(Number.isFinite(next) && next > 0 ? next : null));
  input.value = value === null ? '' : String(value);
  input.disabled = disabled;
  return input;
}

function textCell(text: string): HTMLTableCellElement {
  const cell = document.createElement('td');
  cell.textContent = text;
  return cell;
}

function controlCell(control: HTMLElement, path: string): HTMLTableCellElement {
  const cell = document.createElement('td');
  cell.dataset.path = path;
  cell.append(control);
  return cell;
}

function clearErrors(root: HTMLElement, errorBox: HTMLElement): void {
  root.querySelectorAll('.graphics-dialog__invalid').forEach((element) => {
    element.classList.remove('graphics-dialog__invalid');
  });
  errorBox.hidden = true;
  errorBox.textContent = '';
}

function showErrors(root: HTMLElement, errorBox: HTMLElement, errors: GraphicsValidationError[]): void {
  for (const error of errors) {
    root.querySelectorAll<HTMLElement>(`[data-path="${CSS.escape(error.path)}"]`).forEach((element) => {
      element.classList.add('graphics-dialog__invalid');
    });
  }
  errorBox.hidden = false;
  errorBox.textContent = errors.slice(0, 3).map((error) => error.message).join(' ');
}

function closePanel(params: GroupPanelPartInitParameters): void {
  const api = params.api as unknown as { close?: () => void };
  api.close?.();
}
