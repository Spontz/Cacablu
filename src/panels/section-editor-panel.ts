import type { IContentRenderer } from 'dockview-core';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api.js';
import 'monaco-editor/esm/vs/basic-languages/cpp/cpp.contribution.js';
import 'monaco-editor/min/vs/editor/editor.main.css';

import type { AppState } from '../state/app-state';
import type { DbState } from '../state/db-state';
import type { DbSessionRef } from '../db/db-session';
import type { DbBar } from '../db/db-schema';
import { createContentRenderer } from './base-panel';

const TEMPLATE_STORAGE_KEY = 'cacablu.sectionEditor.templates';
const BAR_TYPE_STORAGE_KEY = 'cacablu.sectionEditor.barTypes';
const CODE_TEMPLATE_BASE_API_URL = 'https://api.github.com/repos/Spontz/Dungeon/contents/Engines/Phoenix/CodeTemplates';
const BAR_TYPE_SOURCE_URL = `${CODE_TEMPLATE_BASE_API_URL}?ref=master`;

const BLEND_OPTIONS = [
  'ZERO',
  'ONE',
  'SRC_COLOR',
  'ONE_MINUS_SRC_COLOR',
  'DST_COLOR',
  'ONE_MINUS_DST_COLOR',
  'SRC_ALPHA',
  'ONE_MINUS_SRC_ALPHA',
  'DST_ALPHA',
  'ONE_MINUS_DST_ALPHA',
];

const BLEND_EQUATION_OPTIONS = [
  { label: 'Add', value: 'ADD', aliases: ['FUNC_ADD'] },
  { label: 'Subtract', value: 'SUBTRACT', aliases: ['FUNC_SUBTRACT'] },
  { label: 'Reverse subtract', value: 'REVERSE_SUBTRACT', aliases: ['FUNC_REVERSE_SUBTRACT'] },
];

interface SectionTemplate {
  barType: string;
  name: string;
  code: string;
}

interface RemoteSectionTemplate {
  name: string;
  url: string;
}

type ScriptTemplateOption =
  | { source: 'local'; name: string; code: string }
  | { source: 'remote'; name: string; url: string };

const FALLBACK_BAR_TYPES = [
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
];

export function createSectionEditorPanel(
  state: AppState,
  dbState: DbState,
  sessionRef: DbSessionRef,
): IContentRenderer {
  return createContentRenderer((element) => {
    element.className = 'panel panel--section-editor';

    let activeBarId: number | null = null;
    let codeEditor: monaco.editor.IStandaloneCodeEditor | null = null;
    let activeBarTypeInput: HTMLInputElement | null = null;
    let activeBarTypeMenu: HTMLElement | null = null;
    let barTypes = getInitialBarTypes();
    let disposed = false;
    let templateListRequestId = 0;
    let templateContentRequestId = 0;
    let suppressTemplateMismatchClear = false;

    function disposeCodeEditor(): void {
      templateContentRequestId += 1;
      codeEditor?.dispose();
      codeEditor = null;
    }

    function refreshActiveBarTypeCombo(query = activeBarTypeInput?.value ?? ''): void {
      if (!activeBarTypeInput || !activeBarTypeMenu) return;
      populateStringOptionMenu(activeBarTypeMenu, getFilteredStringOptions(barTypes, query), (barType) => {
        if (!activeBarTypeInput || !activeBarTypeMenu) return;
        activeBarTypeInput.value = barType;
        activeBarTypeMenu.hidden = true;
        activeBarTypeInput.dispatchEvent(new Event('change', { bubbles: true }));
      });
    }

    function getSelectedBar(): DbBar | null {
      const selection = state.getSnapshot().resourceSelection;
      if (selection.kind !== 'bar') return null;
      return sessionRef.current?.data.bars.find((bar) => bar.id === selection.id) ?? null;
    }

    function renderEmpty(message = 'Select a timeline bar.'): void {
      disposeCodeEditor();
      activeBarTypeInput = null;
      activeBarTypeMenu = null;
      element.replaceChildren(createPlaceholder(message));
    }

    function render(): void {
      disposeCodeEditor();
      if (dbState.getSnapshot().status !== 'open' || !sessionRef.current) {
        activeBarId = null;
        renderEmpty('No project open.');
        return;
      }

      const bar = getSelectedBar();
      if (!bar) {
        activeBarId = null;
        renderEmpty();
        return;
      }

      activeBarId = bar.id;

      const root = document.createElement('div');
      root.className = 'section-editor';

      const timeRow = document.createElement('div');
      timeRow.className = 'section-editor__row section-editor__row--bar-meta';

      const nameField = createField('Name');
      const nameInput = document.createElement('input');
      nameInput.className = 'section-editor__select';
      nameInput.value = bar.name.trim();
      nameField.append(nameInput);

      const startField = createField('Start Time');
      const startInput = createTimeInput(bar.startTime);
      startField.append(startInput);

      const endField = createField('End Time');
      const endInput = createTimeInput(bar.endTime);
      endField.append(endInput);

      timeRow.append(nameField, startField, endField);

      attachTimeWheelHandler(startInput, (delta) => {
        const current = getSelectedBar();
        if (!current) return false;
        return applyTimeRange(roundEditorTime(current.startTime + delta), current.endTime);
      });
      attachTimeWheelHandler(endInput, (delta) => {
        const current = getSelectedBar();
        if (!current) return false;
        return applyTimeRange(current.startTime, roundEditorTime(current.endTime + delta));
      });

      const templateRow = document.createElement('div');
      templateRow.className = 'section-editor__row section-editor__row--templates';

      const barTemplateField = createField('Bar Type');
      const barTemplateCombo = document.createElement('div');
      const barTemplateInput = document.createElement('input');
      const barTemplateMenu = document.createElement('div');
      barTemplateCombo.className = 'section-editor__combo';
      barTemplateInput.className = 'section-editor__select';
      barTemplateInput.value = bar.type.trim();
      barTemplateInput.setAttribute('autocomplete', 'off');
      barTemplateMenu.className = 'section-editor__combo-menu';
      barTemplateMenu.hidden = true;
      activeBarTypeInput = barTemplateInput;
      activeBarTypeMenu = barTemplateMenu;
      barTemplateCombo.append(barTemplateInput, barTemplateMenu);
      barTemplateField.append(barTemplateCombo);
      refreshActiveBarTypeCombo();

      const scriptTemplateField = createField('Script Template');
      const scriptTemplateCombo = document.createElement('div');
      const scriptTemplateInput = document.createElement('input');
      const scriptTemplateMenu = document.createElement('div');
      let scriptTemplateOptions = mergeScriptTemplateOptions(bar.type.trim(), []);
      scriptTemplateCombo.className = 'section-editor__combo';
      scriptTemplateInput.className = 'section-editor__select';
      scriptTemplateInput.setAttribute('autocomplete', 'off');
      scriptTemplateMenu.className = 'section-editor__combo-menu';
      scriptTemplateMenu.hidden = true;
      scriptTemplateCombo.append(scriptTemplateInput, scriptTemplateMenu);
      scriptTemplateField.append(scriptTemplateCombo);

      const saveTemplate = document.createElement('button');
      saveTemplate.type = 'button';
      saveTemplate.className = 'section-editor__button';
      saveTemplate.textContent = 'Save Template';

      templateRow.append(barTemplateField, scriptTemplateField, saveTemplate);

      const code = document.createElement('div');
      code.className = 'section-editor__code';
      code.setAttribute('aria-label', 'Section script editor');

      const storedSrcBlending = bar.srcBlending.trim();
      const storedDstBlending = bar.dstBlending.trim();
      const storedBlendEquation = bar.blendingEQ.trim();

      const blendRow = document.createElement('div');
      blendRow.className = 'section-editor__row section-editor__row--blend';

      const srcField = createField('Blend Source');
      const srcSelect = createBlendSelect(storedSrcBlending, { allowEmpty: true });
      srcField.append(srcSelect);

      const dstField = createField('Blend Destination');
      const dstSelect = createBlendSelect(storedDstBlending, { allowEmpty: true });
      dstField.append(dstSelect);

      const equationField = createField('Blend Equation');
      const equationSelect = createBlendEquationSelect(storedBlendEquation);
      equationField.append(equationSelect);

      const apply = document.createElement('button');
      apply.type = 'button';
      apply.className = 'section-editor__button section-editor__button--primary';
      apply.textContent = 'Apply';

      blendRow.append(srcField, dstField, equationField, apply);
      root.append(timeRow, templateRow, code, blendRow);
      element.replaceChildren(root);

      codeEditor = monaco.editor.create(code, {
        value: bar.script ?? '',
        language: 'cpp',
        theme: 'vs-dark',
        automaticLayout: true,
        lineNumbers: 'on',
        glyphMargin: false,
        lineDecorationsWidth: 8,
        lineNumbersMinChars: 3,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        tabSize: 2,
        insertSpaces: true,
        wordWrap: 'on',
      });
      requestAnimationFrame(() => {
        codeEditor?.layout();
      });
      codeEditor.onDidChangeModelContent(() => {
        if (suppressTemplateMismatchClear) return;
        scriptTemplateInput.value = '';
        closeScriptTemplateMenu();
      });
      refreshScriptTemplateMenu();
      if (bar.type.trim()) {
        void refreshScriptTemplates(bar.type.trim(), (templates) => {
          scriptTemplateOptions = mergeScriptTemplateOptions(bar.type.trim(), templates);
          refreshScriptTemplateMenu();
        });
      }

      barTemplateInput.addEventListener('focus', () => {
        openBarTypeMenu();
      });
      barTemplateInput.addEventListener('click', () => {
        openBarTypeMenu();
      });
      barTemplateInput.addEventListener('input', () => {
        refreshActiveBarTypeCombo(barTemplateInput.value);
        barTemplateMenu.hidden = barTemplateMenu.childElementCount === 0;
      });
      barTemplateInput.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        closeBarTypeMenu();
        barTemplateInput.dispatchEvent(new Event('change', { bubbles: true }));
      });
      barTemplateInput.addEventListener('blur', () => {
        window.setTimeout(closeBarTypeMenu, 120);
      });
      barTemplateInput.addEventListener('change', () => {
        const current = getSelectedBar();
        const session = sessionRef.current;
        if (!current || !session) return;

        const nextType = barTemplateInput.value.trim();
        if (nextType === current.type.trim()) return;

        session.updateCell('bars', current.id, 'type', nextType);
        current.type = nextType;
        if (nextType && !barTypes.includes(nextType)) {
          barTypes = normalizeBarTypes([...barTypes, nextType]);
          writeStoredBarTypes(barTypes);
        }
        window.dispatchEvent(new CustomEvent('cacablu:timeline-bars-changed'));
        scriptTemplateInput.value = '';
        scriptTemplateOptions = mergeScriptTemplateOptions(nextType, []);
        refreshScriptTemplateMenu();
        if (nextType) {
          void refreshScriptTemplates(nextType, (templates) => {
            scriptTemplateOptions = mergeScriptTemplateOptions(nextType, templates);
            refreshScriptTemplateMenu();
          });
        }
      });

      scriptTemplateInput.addEventListener('focus', () => {
        openScriptTemplateMenu();
      });
      scriptTemplateInput.addEventListener('click', () => {
        openScriptTemplateMenu();
      });
      scriptTemplateInput.addEventListener('input', () => {
        refreshScriptTemplateMenu(scriptTemplateInput.value);
        scriptTemplateMenu.hidden = scriptTemplateMenu.childElementCount === 0;
      });
      scriptTemplateInput.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return;
        const templateName = scriptTemplateInput.value.trim();
        const template = scriptTemplateOptions.find((candidate) => candidate.name === templateName);
        if (!template) return;
        event.preventDefault();
        closeScriptTemplateMenu();
        loadScriptTemplateOption(template);
      });
      scriptTemplateInput.addEventListener('blur', () => {
        window.setTimeout(closeScriptTemplateMenu, 120);
      });

      saveTemplate.addEventListener('click', () => {
        const barType = barTemplateInput.value.trim();
        const name = scriptTemplateInput.value.trim();
        if (!barType) {
          state.addEvent({
            severity: 'warning',
            source: 'Section Editor',
            description: 'Choose a bar type before saving a script template.',
          });
          return;
        }
        if (!name) {
          state.addEvent({
            severity: 'warning',
            source: 'Section Editor',
            description: 'Enter a script template name before saving.',
          });
          return;
        }

        upsertStoredTemplate({
          barType,
          name,
          code: codeEditor?.getValue() ?? '',
        });
        scriptTemplateOptions = mergeScriptTemplateOptions(
          barType,
          scriptTemplateOptions
            .filter((template): template is Extract<ScriptTemplateOption, { source: 'remote' }> => template.source === 'remote')
            .map((template) => ({ name: template.name, url: template.url })),
        );
        refreshScriptTemplateMenu();
        scriptTemplateInput.value = name;
      });

      apply.addEventListener('click', () => {
        const current = getSelectedBar();
        const session = sessionRef.current;
        if (!current || !session) {
          state.addEvent({
            severity: 'warning',
            source: 'Section Editor',
            description: 'No selected bar to apply section editor changes.',
          });
          return;
        }

        const nextScript = codeEditor?.getValue() ?? '';
        const nextName = nameInput.value.trim();
        const nextType = barTemplateInput.value.trim();
        const nextStartTime = parseEditorTime(startInput.value);
        const nextEndTime = parseEditorTime(endInput.value);
        if (
          nextStartTime === null
          || nextEndTime === null
          || !isValidTimeRange(current.id, current.layer, nextStartTime, nextEndTime)
        ) {
          state.addEvent({
            severity: 'warning',
            source: 'Section Editor',
            subjectId: String(current.id),
            description: `Bar ${current.id} has an invalid time range.`,
          });
          return;
        }
        session.updateCell('bars', current.id, 'type', nextType);
        session.updateCell('bars', current.id, 'name', nextName);
        session.updateCell('bars', current.id, 'script', nextScript);
        session.updateCell('bars', current.id, 'startTime', nextStartTime);
        session.updateCell('bars', current.id, 'endTime', nextEndTime);
        session.updateCell('bars', current.id, 'srcBlending', srcSelect.value);
        session.updateCell('bars', current.id, 'dstBlending', dstSelect.value);
        session.updateCell('bars', current.id, 'blendingEQ', equationSelect.value);
        current.type = nextType;
        current.name = nextName;
        current.script = nextScript;
        current.startTime = nextStartTime;
        current.endTime = nextEndTime;
        current.srcBlending = srcSelect.value;
        current.dstBlending = dstSelect.value;
        current.blendingEQ = equationSelect.value;
        window.dispatchEvent(new CustomEvent('cacablu:timeline-bars-changed'));
        state.setResourceSelection({ kind: 'bar', id: current.id });
      });

      function applyTimeRange(nextStartTime: number, nextEndTime: number): boolean {
        const current = getSelectedBar();
        const session = sessionRef.current;
        if (!current || !session) return false;
        if (!isValidTimeRange(current.id, current.layer, nextStartTime, nextEndTime)) {
          syncTimeInputsFromBar(current);
          return false;
        }

        session.updateCell('bars', current.id, 'startTime', nextStartTime);
        session.updateCell('bars', current.id, 'endTime', nextEndTime);
        current.startTime = nextStartTime;
        current.endTime = nextEndTime;
        syncTimeInputsFromBar(current);
        window.dispatchEvent(new CustomEvent('cacablu:timeline-bars-changed'));
        return true;
      }

      function syncTimeInputsFromBar(current: DbBar): void {
        startInput.value = formatEditorTime(current.startTime);
        endInput.value = formatEditorTime(current.endTime);
      }

      function refreshScriptTemplateMenu(query = scriptTemplateInput.value): void {
        populateScriptTemplateMenu(
          scriptTemplateMenu,
          getFilteredScriptTemplates(scriptTemplateOptions, query),
          loadScriptTemplateOption,
        );
      }

      function openScriptTemplateMenu(): void {
        refreshScriptTemplateMenu('');
        scriptTemplateMenu.hidden = scriptTemplateMenu.childElementCount === 0;
      }

      function closeScriptTemplateMenu(): void {
        scriptTemplateMenu.hidden = true;
      }

      function openBarTypeMenu(): void {
        refreshActiveBarTypeCombo('');
        if (activeBarTypeMenu) activeBarTypeMenu.hidden = activeBarTypeMenu.childElementCount === 0;
      }

      function closeBarTypeMenu(): void {
        if (activeBarTypeMenu) activeBarTypeMenu.hidden = true;
      }

      function loadScriptTemplateOption(template: ScriptTemplateOption): void {
        scriptTemplateInput.value = template.name;
        closeScriptTemplateMenu();
        if (template.source === 'local') {
          setCodeEditorValueFromTemplate(template.code);
          return;
        }
        void loadTemplateIntoEditor(template.url, template.name);
      }
    }

    async function refreshScriptTemplates(
      barType: string,
      onLoaded: (templates: RemoteSectionTemplate[]) => void,
    ): Promise<void> {
      const requestId = ++templateListRequestId;
      try {
        const templates = await fetchScriptTemplatesForBarType(barType);
        if (disposed || requestId !== templateListRequestId) return;
        onLoaded(templates);
      } catch {
        if (disposed || requestId !== templateListRequestId) return;
        onLoaded([]);
        state.addEvent({
          severity: 'warning',
          source: 'Section Editor',
          description: `Could not load script templates for ${barType}.`,
        });
      }
    }

    async function loadTemplateIntoEditor(
      url: string,
      templateName: string,
    ): Promise<void> {
      const requestId = ++templateContentRequestId;
      try {
        const content = await fetchTemplateContent(url);
        if (disposed || requestId !== templateContentRequestId) return;
        setCodeEditorValueFromTemplate(content);
      } catch {
        if (disposed || requestId !== templateContentRequestId) return;
        state.addEvent({
          severity: 'warning',
          source: 'Section Editor',
          description: `Could not load script template "${templateName}".`,
        });
      }
    }

    function setCodeEditorValueFromTemplate(value: string): void {
      suppressTemplateMismatchClear = true;
      try {
        codeEditor?.setValue(value);
      } finally {
        suppressTemplateMismatchClear = false;
      }
    }

    function isValidTimeRange(barId: number, layer: number, startTime: number, endTime: number): boolean {
      if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime) {
        return false;
      }

      const bars = sessionRef.current?.data.bars ?? [];
      return !bars.some((bar) => (
        bar.id !== barId
        && bar.layer === layer
        && startTime < bar.endTime
        && endTime > bar.startTime
      ));
    }

    const unsubscribeState = state.subscribe((snapshot) => {
      const nextBarId = snapshot.resourceSelection.kind === 'bar' ? snapshot.resourceSelection.id : null;
      if (nextBarId !== activeBarId) {
        render();
      }
    });
    const unsubscribeDb = dbState.subscribe(render);

    render();
    void refreshBarTypesFromGithub().then((nextTypes) => {
      if (disposed || nextTypes.length === 0) return;
      barTypes = nextTypes;
      refreshActiveBarTypeCombo();
    });

    return () => {
      disposed = true;
      disposeCodeEditor();
      activeBarTypeInput = null;
      activeBarTypeMenu = null;
      unsubscribeState();
      unsubscribeDb();
    };
  });
}

function createField(labelText: string): HTMLLabelElement {
  const label = document.createElement('label');
  label.className = 'section-editor__field';
  const text = document.createElement('span');
  text.textContent = labelText;
  label.append(text);
  return label;
}

function createTimeInput(value: number): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'number';
  input.step = '0.001';
  input.className = 'section-editor__select';
  input.value = formatEditorTime(value);
  return input;
}

function attachTimeWheelHandler(input: HTMLInputElement, applyDelta: (delta: number) => boolean): void {
  input.addEventListener('wheel', (event) => {
    event.preventDefault();
    const step = Number.parseFloat(input.step) || 1;
    const direction = event.deltaY < 0 ? 1 : -1;
    applyDelta(direction * step);
  }, { passive: false });
}

function parseEditorTime(value: string): number | null {
  const parsed = Number.parseFloat(value.trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function formatEditorTime(value: number): string {
  return Number.isFinite(value) ? value.toFixed(3) : '';
}

function roundEditorTime(value: number): number {
  return Number.parseFloat(value.toFixed(3));
}

function createBlendSelect(value: string, options: { allowEmpty?: boolean } = {}): HTMLSelectElement {
  const select = document.createElement('select');
  select.className = 'section-editor__select';
  if (options.allowEmpty) {
    const emptyOption = document.createElement('option');
    emptyOption.value = '';
    emptyOption.textContent = '';
    emptyOption.selected = value === '';
    select.append(emptyOption);
  }
  for (const optionValue of BLEND_OPTIONS) {
    const option = document.createElement('option');
    option.value = optionValue;
    option.textContent = optionValue;
    option.selected = optionValue === value;
    select.append(option);
  }
  if (value && !BLEND_OPTIONS.includes(value)) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    option.selected = true;
    select.prepend(option);
  }
  return select;
}

function createBlendEquationSelect(value: string): HTMLSelectElement {
  const select = document.createElement('select');
  select.className = 'section-editor__select';
  const normalizedValue = normalizeBlendEquationValue(value);

  const emptyOption = document.createElement('option');
  emptyOption.value = '';
  emptyOption.textContent = '';
  emptyOption.selected = normalizedValue === '';
  select.append(emptyOption);

  for (const optionValue of BLEND_EQUATION_OPTIONS) {
    const option = document.createElement('option');
    option.value = optionValue.value;
    option.textContent = optionValue.label;
    option.selected = optionValue.value === normalizedValue;
    select.append(option);
  }
  if (normalizedValue && !BLEND_EQUATION_OPTIONS.some((option) => option.value === normalizedValue)) {
    const option = document.createElement('option');
    option.value = normalizedValue;
    option.textContent = normalizedValue;
    option.selected = true;
    select.prepend(option);
  }
  return select;
}

function normalizeBlendEquationValue(value: string): string {
  const trimmed = value.trim();
  const option = BLEND_EQUATION_OPTIONS.find((candidate) => (
    candidate.value === trimmed || candidate.aliases.includes(trimmed)
  ));
  return option?.value ?? trimmed;
}

function createPlaceholder(message: string): HTMLElement {
  const placeholder = document.createElement('p');
  placeholder.className = 'section-editor__placeholder';
  placeholder.textContent = message;
  return placeholder;
}

function populateScriptTemplateMenu(
  menu: HTMLElement,
  templates: ScriptTemplateOption[],
  onSelect: (template: ScriptTemplateOption) => void,
): void {
  menu.replaceChildren();

  for (const template of templates) {
    const option = document.createElement('button');
    option.type = 'button';
    option.className = 'section-editor__combo-option';
    option.textContent = template.name;
    option.addEventListener('mousedown', (event) => {
      event.preventDefault();
      onSelect(template);
    });
    menu.append(option);
  }
}

function populateStringOptionMenu(
  menu: HTMLElement,
  options: string[],
  onSelect: (value: string) => void,
): void {
  menu.replaceChildren();

  for (const value of options) {
    const option = document.createElement('button');
    option.type = 'button';
    option.className = 'section-editor__combo-option';
    option.textContent = value;
    option.addEventListener('mousedown', (event) => {
      event.preventDefault();
      onSelect(value);
    });
    menu.append(option);
  }
}

function getFilteredScriptTemplates(templates: ScriptTemplateOption[], query: string): ScriptTemplateOption[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return templates;
  return templates.filter((template) => template.name.toLowerCase().includes(normalizedQuery));
}

function getFilteredStringOptions(options: string[], query: string): string[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return options;
  return options.filter((option) => option.toLowerCase().includes(normalizedQuery));
}

function mergeScriptTemplateOptions(barType: string, remoteTemplates: RemoteSectionTemplate[]): ScriptTemplateOption[] {
  const localTemplates: ScriptTemplateOption[] = readStoredTemplates(barType)
    .map((template) => ({
      source: 'local',
      name: template.name,
      code: template.code,
    }));
  const localNames = new Set(localTemplates.map((template) => template.name));
  const remoteOptions: ScriptTemplateOption[] = remoteTemplates
    .filter((template) => !localNames.has(template.name))
    .map((template) => ({
      source: 'remote',
      name: template.name,
      url: template.url,
    }));
  return [...localTemplates, ...remoteOptions].sort((a, b) => a.name.localeCompare(b.name));
}

function getInitialBarTypes(): string[] {
  const cached = readStoredBarTypes();
  return cached.length > 0 ? cached : FALLBACK_BAR_TYPES;
}

async function refreshBarTypesFromGithub(): Promise<string[]> {
  try {
    const response = await fetch(BAR_TYPE_SOURCE_URL, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!response.ok) throw new Error(`GitHub returned ${response.status}.`);

    const payload = await response.json() as unknown;
    if (!Array.isArray(payload)) throw new Error('GitHub returned an unexpected CodeTemplates payload.');

    const remoteTypes = normalizeBarTypes(payload
      .filter(isGithubDirectoryEntry)
      .map((entry) => entry.name));
    if (remoteTypes.length === 0) throw new Error('GitHub returned no CodeTemplates directories.');

    const mergedTypes = normalizeBarTypes([...readStoredBarTypes(), ...remoteTypes]);
    writeStoredBarTypes(mergedTypes);
    return mergedTypes;
  } catch {
    return getInitialBarTypes();
  }
}

async function fetchScriptTemplatesForBarType(barType: string): Promise<RemoteSectionTemplate[]> {
  const response = await fetch(`${CODE_TEMPLATE_BASE_API_URL}/${encodeURIComponent(barType)}?ref=master`, {
    headers: { Accept: 'application/vnd.github+json' },
  });
  if (!response.ok) throw new Error(`GitHub returned ${response.status}.`);

  const payload = await response.json() as unknown;
  if (!Array.isArray(payload)) throw new Error('GitHub returned an unexpected CodeTemplates payload.');

  return payload
    .filter(isGithubTemplateFileEntry)
    .map((entry) => ({
      name: entry.name.replace(/\.template$/i, ''),
      url: entry.download_url,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function fetchTemplateContent(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`GitHub returned ${response.status}.`);
  return response.text();
}

function readStoredBarTypes(): string[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(BAR_TYPE_STORAGE_KEY) ?? '[]') as unknown;
    if (!Array.isArray(parsed)) return [];
    return normalizeBarTypes(parsed.filter((value): value is string => typeof value === 'string'));
  } catch {
    return [];
  }
}

function writeStoredBarTypes(types: string[]): void {
  window.localStorage.setItem(BAR_TYPE_STORAGE_KEY, JSON.stringify(normalizeBarTypes(types)));
}

function normalizeBarTypes(types: string[]): string[] {
  return Array.from(new Set(types
    .map((type) => type.trim())
    .filter((type) => type.length > 0)))
    .sort((a, b) => a.localeCompare(b));
}

function isGithubDirectoryEntry(value: unknown): value is { name: string; type: 'dir' } {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { name?: unknown; type?: unknown };
  return candidate.type === 'dir' && typeof candidate.name === 'string';
}

function isGithubTemplateFileEntry(value: unknown): value is { name: string; type: 'file'; download_url: string } {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { name?: unknown; type?: unknown; download_url?: unknown };
  return (
    candidate.type === 'file'
    && typeof candidate.name === 'string'
    && /\.template$/i.test(candidate.name)
    && typeof candidate.download_url === 'string'
    && candidate.download_url.length > 0
  );
}

function readStoredTemplates(barType?: string): SectionTemplate[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(TEMPLATE_STORAGE_KEY) ?? '[]') as unknown;
    if (!Array.isArray(parsed)) return [];
    const templates = parsed
      .map(toStoredTemplate)
      .filter((template): template is SectionTemplate => Boolean(template));
    if (barType === undefined) return templates;
    return templates.filter((template) => template.barType === barType || template.barType === '');
  } catch {
    return [];
  }
}

function writeStoredTemplates(templates: SectionTemplate[]): void {
  window.localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(templates));
}

function upsertStoredTemplate(template: SectionTemplate): void {
  const nextTemplates = readStoredTemplates()
    .filter((candidate) => !(candidate.name === template.name && (candidate.barType === template.barType || candidate.barType === '')));
  nextTemplates.push(template);
  writeStoredTemplates(nextTemplates);
}

function toStoredTemplate(value: unknown): SectionTemplate | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<SectionTemplate>;
  if (typeof candidate.name !== 'string' || typeof candidate.code !== 'string') return null;
  return {
    barType: typeof candidate.barType === 'string' ? candidate.barType : '',
    name: candidate.name,
    code: candidate.code,
  };
}
