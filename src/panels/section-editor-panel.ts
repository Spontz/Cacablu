import type { IContentRenderer } from 'dockview-core';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api.js';
import 'monaco-editor/min/vs/editor/editor.main.css';

import type { AppState } from '../state/app-state';
import type { DbState } from '../state/db-state';
import type { DbSessionRef } from '../db/db-session';
import type { DbBar } from '../db/db-schema';
import type { ConnectionController } from '../ws/connection';
import type { UndoManager } from '../app/undo-manager';
import { createPhoenixSectionClient } from '../phoenix/section-client';
import { createPhoenixLogClient } from '../phoenix/log-client';
import { primePhoenixLogEvents, recordPhoenixLogsAsEvents } from '../phoenix/log-events';
import { ProjectSectionSyncError, syncProjectBarToPhoenix, type ProjectSectionSyncIssue } from '../services/project-section-sync';
import { createContentRenderer } from './base-panel';
import { CACABLU_CODE_THEME, registerCacabluCodeTheme } from './code-editor-theme';

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

interface BarPlacement {
  id: number;
  layer: number;
  startTime: number;
  endTime: number;
}

interface BarSnapshot extends BarPlacement {
  name: string;
  type: string;
  script: string;
  srcBlending: string;
  dstBlending: string;
  blendingEQ: string;
}

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
  connection: ConnectionController,
  undoManager: UndoManager,
): IContentRenderer {
  registerCacabluCodeTheme();
  registerSectionIniLanguage();
  return createContentRenderer((element) => {
    element.className = 'panel panel--section-editor';

    let activeSelectionSignature: string | null = null;
    let codeEditor: monaco.editor.IStandaloneCodeEditor | null = null;
    let activeBarTypeInput: HTMLInputElement | null = null;
    let activeBarTypeMenu: HTMLElement | null = null;
    let barTypes = getInitialBarTypes();
    let disposed = false;
    let templateListRequestId = 0;
    let templateContentRequestId = 0;
    let suppressTemplateMismatchClear = false;
    const phoenixSections = createPhoenixSectionClient();
    const phoenixLogs = createPhoenixLogClient();

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

    function getSelectedBars(): DbBar[] {
      const selection = state.getSnapshot().resourceSelection;
      const bars = sessionRef.current?.data.bars ?? [];
      if (selection.kind === 'bar') {
        const bar = bars.find((candidate) => candidate.id === selection.id);
        return bar ? [bar] : [];
      }
      if (selection.kind === 'bars') {
        const selectedIds = new Set(selection.ids);
        return bars
          .filter((bar) => selectedIds.has(bar.id))
          .sort((a, b) => a.id - b.id);
      }
      return [];
    }

    function getSelectionSignature(): string | null {
      const selection = state.getSnapshot().resourceSelection;
      if (selection.kind === 'bar') return `bar:${selection.id}`;
      if (selection.kind === 'bars') return `bars:${[...selection.ids].sort((a, b) => a - b).join(',')}`;
      return null;
    }

    function renderEmpty(message = 'Select a timeline bar.'): void {
      disposeCodeEditor();
      activeSelectionSignature = null;
      activeBarTypeInput = null;
      activeBarTypeMenu = null;
      element.replaceChildren(createPlaceholder(message));
    }

    function render(): void {
      disposeCodeEditor();
      if (dbState.getSnapshot().status !== 'open' || !sessionRef.current) {
        activeSelectionSignature = null;
        renderEmpty('No project open.');
        return;
      }

      const selectedBars = getSelectedBars();
      if (selectedBars.length === 0) {
        activeSelectionSignature = null;
        renderEmpty();
        return;
      }

      activeSelectionSignature = getSelectionSignature();
      if (selectedBars.length > 1) {
        renderMultiSelection(selectedBars);
        return;
      }

      const bar = selectedBars[0];

      const root = document.createElement('div');
      root.className = 'section-editor';
      root.addEventListener('keydown', (event) => {
        if (!isApplyShortcut(event) || isMonacoEventTarget(event.target)) return;
        event.preventDefault();
        event.stopPropagation();
        window.setTimeout(applyCurrentBarEdits, 0);
      });

      const timeRow = document.createElement('div');
      timeRow.className = 'section-editor__row section-editor__row--bar-meta';

      const nameField = createField('Name');
      const nameInput = document.createElement('input');
      nameInput.className = 'section-editor__select';
      nameInput.value = bar.name.trim();
      nameField.append(nameInput);

      const startField = createField('Start Time');
      const startInput = createTimeInput(bar.startTime);
      let appliedStartInputValue = startInput.value;
      startField.append(startInput);

      const endField = createField('End Time');
      const endInput = createTimeInput(bar.endTime);
      let appliedEndInputValue = endInput.value;
      endField.append(endInput);

      timeRow.append(nameField, startField, endField);

      attachTimeWheelHandler(startInput, (delta) => {
        const current = parseEditorTime(startInput.value);
        if (current === null) return false;
        startInput.value = formatEditorTime(roundEditorTime(current + delta));
        return true;
      });
      attachTimeWheelHandler(endInput, (delta) => {
        const current = parseEditorTime(endInput.value);
        if (current === null) return false;
        endInput.value = formatEditorTime(roundEditorTime(current + delta));
        return true;
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
      attachComboMenuScrollBehavior(barTemplateMenu);
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
      attachComboMenuScrollBehavior(scriptTemplateMenu);

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
        language: 'cacablu-section-ini',
        theme: CACABLU_CODE_THEME,
        automaticLayout: true,
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: 10,
        lineNumbers: 'on',
        glyphMargin: false,
        lineDecorationsWidth: 5,
        lineNumbersMinChars: 2,
        padding: { top: 6, bottom: 6 },
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        tabSize: 2,
        insertSpaces: true,
        wordWrap: 'on',
        fixedOverflowWidgets: true,
        overflowWidgetsDomNode: document.body,
      });
      requestAnimationFrame(() => {
        codeEditor?.layout();
      });
      codeEditor.onDidChangeModelContent(() => {
        if (suppressTemplateMismatchClear) return;
        scriptTemplateInput.value = '';
        closeScriptTemplateMenu();
      });
      codeEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
        applyCurrentBarEdits();
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
        const nextType = barTemplateInput.value.trim();
        if (nextType && !barTypes.includes(nextType)) {
          barTypes = normalizeBarTypes([...barTypes, nextType]);
          writeStoredBarTypes(barTypes);
        }
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
            source: 'Bar Editor',
            description: 'Choose a bar type before saving a script template.',
          });
          return;
        }
        if (!name) {
          state.addEvent({
            severity: 'warning',
            source: 'Bar Editor',
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
        applyCurrentBarEdits();
      });

      function applyCurrentBarEdits(): void {
        const current = getSelectedBar();
        if (!current || !sessionRef.current) {
          state.addEvent({
            severity: 'warning',
            source: 'Bar Editor',
            description: 'No selected bar to apply bar editor changes.',
          });
          return;
        }

        const previous = takeBarSnapshots([current]);
        const nextScript = codeEditor?.getValue() ?? '';
        const nextType = barTemplateInput.value.trim();
        const nextName = nameInput.value.trim() || nextType;
        nameInput.value = nextName;
        const nextStartTime = parseEditorTime(startInput.value);
        const nextEndTime = parseEditorTime(endInput.value);
        const timeChanged = startInput.value.trim() !== appliedStartInputValue
          || endInput.value.trim() !== appliedEndInputValue;
        const canApplyTime = timeChanged
          && nextStartTime !== null
          && nextEndTime !== null
          && isValidEditorTimeRange(nextStartTime, nextEndTime);
        if (timeChanged && !canApplyTime) {
          state.addEvent({
            severity: 'warning',
            source: 'Bar Editor',
            subjectId: String(current.id),
            description: `Bar ${current.id} kept its previous time range because the edited range is not valid.`,
          });
        }

        const next: BarSnapshot[] = [{
          ...previous[0],
          name: nextName,
          type: nextType,
          script: nextScript,
          startTime: canApplyTime ? nextStartTime : previous[0].startTime,
          endTime: canApplyTime ? nextEndTime : previous[0].endTime,
          srcBlending: srcSelect.value,
          dstBlending: dstSelect.value,
          blendingEQ: equationSelect.value,
        }];
        const appliedStartTime = next[0].startTime;
        const appliedEndTime = next[0].endTime;
        if (!timeChanged || canApplyTime) {
          appliedStartInputValue = formatEditorTime(appliedStartTime);
          appliedEndInputValue = formatEditorTime(appliedEndTime);
          startInput.value = appliedStartInputValue;
          endInput.value = appliedEndInputValue;
        }

        if (!barSnapshotsChanged(previous, next)) {
          void syncBarsToPhoenix([current.id]);
          state.setResourceSelection({ kind: 'bar', id: current.id });
          return;
        }

        applyBarSnapshots(next);
        undoManager.push({
          label: `Edit bar ${current.id}`,
          undo: async () => {
            if (!canApplyBarPlacements(previous)) {
              state.addEvent({
                severity: 'warning',
                source: 'Bar Editor undo',
                subjectId: String(current.id),
                description: `Could not undo edit for bar ${current.id} because the original range is occupied.`,
              });
              return;
            }
            applyBarSnapshots(previous);
            window.dispatchEvent(new CustomEvent('cacablu:timeline-bars-changed'));
            await syncBarsToPhoenix(previous.map((snapshot) => snapshot.id));
          },
        });
        window.dispatchEvent(new CustomEvent('cacablu:timeline-bars-changed'));
        void syncBarsToPhoenix([current.id]);
        state.setResourceSelection({ kind: 'bar', id: current.id });
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

    function renderMultiSelection(selectedBars: DbBar[]): void {
      const root = document.createElement('div');
      root.className = 'section-editor section-editor--multi';

      const timeRow = document.createElement('div');
      timeRow.className = 'section-editor__row section-editor__row--multi-time';

      const groupStart = Math.min(...selectedBars.map((bar) => bar.startTime));
      const groupEnd = Math.max(...selectedBars.map((bar) => bar.endTime));

      const startField = createField('Start Time');
      const startInput = createTimeInput(groupStart);
      startField.append(startInput);

      const endField = createField('End Time');
      const endInput = createTimeInput(groupEnd);
      endField.append(endInput);

      const apply = document.createElement('button');
      apply.type = 'button';
      apply.className = 'section-editor__button section-editor__button--primary';
      apply.textContent = 'Apply';

      timeRow.append(startField, endField, apply);
      root.append(timeRow);
      element.replaceChildren(root);

      attachTimeWheelHandler(startInput, (delta) => {
        const current = parseEditorTime(startInput.value);
        if (current === null) return false;
        startInput.value = formatEditorTime(roundEditorTime(current + delta));
        return true;
      });
      attachTimeWheelHandler(endInput, (delta) => {
        const current = parseEditorTime(endInput.value);
        if (current === null) return false;
        endInput.value = formatEditorTime(roundEditorTime(current + delta));
        return true;
      });

      apply.addEventListener('click', () => {
        const currentBars = getSelectedBars();
        if (currentBars.length <= 1) return;

        const nextGroupStart = parseEditorTime(startInput.value);
        const nextGroupEnd = parseEditorTime(endInput.value);
        if (nextGroupStart === null || nextGroupEnd === null || nextGroupEnd <= nextGroupStart) {
          state.addEvent({
            severity: 'warning',
            source: 'Bar Editor',
            description: 'Selected bars have an invalid time range.',
          });
          return;
        }

        const previous = takeBarSnapshots(currentBars);
        const previousGroupStart = Math.min(...previous.map((bar) => bar.startTime));
        const previousGroupEnd = Math.max(...previous.map((bar) => bar.endTime));
        const startDelta = roundEditorTime(nextGroupStart - previousGroupStart);
        const endDelta = roundEditorTime(nextGroupEnd - previousGroupEnd);
        const next = previous.map((bar) => ({
          ...bar,
          startTime: roundEditorTime(bar.startTime + startDelta),
          endTime: roundEditorTime(bar.endTime + endDelta),
        }));

        if (!barSnapshotsChanged(previous, next)) return;
        if (!canApplyBarPlacements(next)) {
          state.addEvent({
            severity: 'warning',
            source: 'Bar Editor',
            description: 'Selected bars were not updated because at least one proposed range conflicts with another bar.',
          });
          return;
        }

        const changedIds = next.map((bar) => bar.id);
        applyBarSnapshots(next);
        undoManager.push({
          label: `Edit ${changedIds.length} bars`,
          undo: async () => {
            if (!canApplyBarPlacements(previous)) {
              state.addEvent({
                severity: 'warning',
                source: 'Bar Editor undo',
                description: `Could not undo edit for ${changedIds.length} bars because the original range is occupied.`,
              });
              return;
            }
            applyBarSnapshots(previous);
            window.dispatchEvent(new CustomEvent('cacablu:timeline-bars-changed'));
            await syncBarsToPhoenix(changedIds);
          },
        });
        window.dispatchEvent(new CustomEvent('cacablu:timeline-bars-changed'));
        void syncBarsToPhoenix(changedIds);
      });
    }

    function takeBarSnapshots(bars: DbBar[]): BarSnapshot[] {
      return bars.map((bar) => ({
        id: bar.id,
        name: bar.name,
        type: bar.type,
        layer: bar.layer,
        startTime: bar.startTime,
        endTime: bar.endTime,
        script: bar.script,
        srcBlending: bar.srcBlending,
        dstBlending: bar.dstBlending,
        blendingEQ: bar.blendingEQ,
      }));
    }

    function applyBarSnapshots(snapshots: BarSnapshot[]): void {
      const session = sessionRef.current;
      if (!session) return;

      let changed = false;
      for (const snapshot of snapshots) {
        const bar = session.data.bars.find((candidate) => candidate.id === snapshot.id);
        if (!bar) continue;

        bar.name = snapshot.name;
        bar.type = snapshot.type;
        bar.script = snapshot.script;
        bar.startTime = snapshot.startTime;
        bar.endTime = snapshot.endTime;
        bar.srcBlending = snapshot.srcBlending;
        bar.dstBlending = snapshot.dstBlending;
        bar.blendingEQ = snapshot.blendingEQ;
        changed = true;

        try {
          session.updateCell('bars', snapshot.id, 'name', snapshot.name);
          session.updateCell('bars', snapshot.id, 'type', snapshot.type);
          session.updateCell('bars', snapshot.id, 'script', snapshot.script);
          session.updateCell('bars', snapshot.id, 'startTime', snapshot.startTime);
          session.updateCell('bars', snapshot.id, 'endTime', snapshot.endTime);
          session.updateCell('bars', snapshot.id, 'srcBlending', snapshot.srcBlending);
          session.updateCell('bars', snapshot.id, 'dstBlending', snapshot.dstBlending);
          session.updateCell('bars', snapshot.id, 'blendingEQ', snapshot.blendingEQ);
        } catch (err) {
          state.addEvent({
            severity: 'error',
            source: 'Bar Editor',
            subjectId: String(snapshot.id),
            description: err instanceof Error
              ? `Bar ${snapshot.id} was updated in memory but could not be written to the project DB: ${err.message}`
              : `Bar ${snapshot.id} was updated in memory but could not be written to the project DB.`,
          });
        }
      }

      if (changed) dbState.setDirty();
    }

    function canApplyBarPlacements(nextBars: BarPlacement[]): boolean {
      const session = sessionRef.current;
      if (!session) return false;

      const nextById = new Map(nextBars.map((bar) => [bar.id, bar]));
      const placements = session.data.bars.map((bar) => nextById.get(bar.id) ?? bar);
      for (const placement of nextBars) {
        if (!Number.isFinite(placement.startTime) || !Number.isFinite(placement.endTime) || placement.endTime <= placement.startTime) {
          return false;
        }
      }

      for (const left of nextBars) {
        for (const right of placements) {
          if (left.id === right.id) continue;
          if (
            left.layer === right.layer &&
            left.startTime < right.endTime &&
            left.endTime > right.startTime
          ) {
            return false;
          }
        }
      }
      return true;
    }

    function barSnapshotsChanged(previous: BarSnapshot[], next: BarSnapshot[]): boolean {
      const previousById = new Map(previous.map((bar) => [bar.id, bar]));
      return next.some((bar) => {
        const old = previousById.get(bar.id);
        return !old || (
          old.name !== bar.name ||
          old.type !== bar.type ||
          old.script !== bar.script ||
          old.startTime !== bar.startTime ||
          old.endTime !== bar.endTime ||
          old.srcBlending !== bar.srcBlending ||
          old.dstBlending !== bar.dstBlending ||
          old.blendingEQ !== bar.blendingEQ
        );
      });
    }

    async function syncBarsToPhoenix(barIds: number[]): Promise<void> {
      const session = sessionRef.current;
      if (!session || !connection.isConnected()) return;

      for (const barId of barIds) {
        try {
          await primePhoenixLogEvents(phoenixLogs);
          const result = await syncProjectBarToPhoenix(session.data, barId, phoenixSections);
          const logResult = await recordPhoenixLogsAsEvents(state, phoenixLogs);
          applySingleBarSyncErrorState(barId, result.issues, logResult);
          recordSectionIssues(result.issues);
        } catch (err) {
          if (err instanceof ProjectSectionSyncError) {
            await recordPhoenixLogsAsEvents(state, phoenixLogs);
            recordSectionIssues(err.issues);
            continue;
          }
          await recordPhoenixLogsAsEvents(state, phoenixLogs);
          state.addEvent({
            severity: 'error',
            source: 'Phoenix section sync',
            subjectId: String(barId),
            description: err instanceof Error ? err.message : 'Could not sync edited timeline bar to Phoenix.',
          });
          state.markSectionErrors([barId]);
        }
      }
    }

    function clearSectionErrors(barIds: number[]): void {
      state.clearSectionErrors(barIds);
      state.clearEventsForSubjects(
        barIds.map(String),
        ['Phoenix section sync', 'Phoenix asset impact'],
      );
    }

    function recordSectionIssues(issues: ProjectSectionSyncIssue[]): void {
      if (issues.length === 0) return;
      state.markSectionErrors(issues.map((issue) => issue.barId));
    }

    function applySingleBarSyncErrorState(
      barId: number,
      issues: ProjectSectionSyncIssue[],
      logResult: Awaited<ReturnType<typeof recordPhoenixLogsAsEvents>>,
    ): void {
      const issueIds = new Set(issues.map((issue) => issue.barId));
      const logErrorIds = new Set(logResult.errorSubjectIds);
      if (logErrorIds.size > 0) {
        state.markSectionErrors([...logErrorIds]);
      }

      const currentBarFailed =
        issueIds.has(barId) ||
        logErrorIds.has(barId) ||
        logResult.unassignedErrorCount > 0;

      if (currentBarFailed) {
        state.markSectionErrors([barId]);
      } else {
        clearSectionErrors([barId]);
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
          source: 'Bar Editor',
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
          source: 'Bar Editor',
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

    function isValidEditorTimeRange(startTime: number, endTime: number): boolean {
      return Number.isFinite(startTime) && Number.isFinite(endTime) && endTime > startTime;
    }

    const unsubscribeState = state.subscribe((snapshot) => {
      const nextSelectionSignature = snapshot.resourceSelection.kind === 'bar'
        ? `bar:${snapshot.resourceSelection.id}`
        : snapshot.resourceSelection.kind === 'bars'
          ? `bars:${[...snapshot.resourceSelection.ids].sort((a, b) => a - b).join(',')}`
          : null;
      if (nextSelectionSignature !== activeSelectionSignature) {
        render();
      }
    });
    let lastDbStatus = dbState.getSnapshot().status;
    let lastDbFileName = dbState.getSnapshot().fileName;
    const unsubscribeDb = dbState.subscribe((snapshot) => {
      if (snapshot.status === lastDbStatus && snapshot.fileName === lastDbFileName) return;
      lastDbStatus = snapshot.status;
      lastDbFileName = snapshot.fileName;
      render();
    });

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

let sectionIniLanguageRegistered = false;

export function registerSectionIniLanguage(): void {
  if (sectionIniLanguageRegistered) return;
  sectionIniLanguageRegistered = true;

  if (!monaco.languages.getLanguages().some((language) => language.id === 'cacablu-section-ini')) {
    monaco.languages.register({
      id: 'cacablu-section-ini',
      extensions: ['.ini', '.spo'],
      aliases: ['Cacablu Section INI', 'INI'],
      mimetypes: ['text/x-ini'],
    });
  }

  monaco.languages.setLanguageConfiguration('cacablu-section-ini', {
    comments: {
      lineComment: '#',
    },
    brackets: [
      ['[', ']'],
    ],
    autoClosingPairs: [
      { open: '[', close: ']' },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
    ],
    surroundingPairs: [
      { open: '[', close: ']' },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
    ],
  });

  monaco.languages.setMonarchTokensProvider('cacablu-section-ini', {
    defaultToken: '',
    ignoreCase: true,
    tokenizer: {
      root: [
        [/^\s*[;#].*$/, 'comment'],
        [/^\s*\[[^\]]+\]/, 'section'],
        [/\b[A-Za-z_][\w.-]*(?=\s*(?::=|=|:))/, 'key'],
        [/^\s*[A-Za-z_][\w.-]*(?=\s*(?:=|:))/, 'key'],
        [/^\s*[A-Za-z_][\w.-]*(?=\s+\S)/, 'key'],
        [/#.*$/, 'comment'],
        [/"([^"\\]|\\.)*$/, 'string.invalid'],
        [/'([^'\\]|\\.)*$/, 'string.invalid'],
        [/"/, 'string', '@stringDouble'],
        [/'/, 'string', '@stringSingle'],
        [/\b(?:true|false|yes|no|on|off|null)\b/, 'constant'],
        [/[+-]?(?:\d+\.\d+|\d+|\.\d+)(?:e[+-]?\d+)?\b/, 'number'],
        [/[=:+,;]/, 'delimiter'],
      ],
      stringDouble: [
        [/[^\\"]+/, 'string'],
        [/\\./, 'string.escape'],
        [/"/, 'string', '@pop'],
      ],
      stringSingle: [
        [/[^\\']+/, 'string'],
        [/\\./, 'string.escape'],
        [/'/, 'string', '@pop'],
      ],
    },
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
  return Number.isFinite(value) ? Number.parseFloat(value.toFixed(3)).toString() : '';
}

function roundEditorTime(value: number): number {
  return Number.parseFloat(value.toFixed(3));
}

function isApplyShortcut(event: KeyboardEvent): boolean {
  const key = event.key.toLowerCase();
  return (event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && (key === 'enter' || key === 'return');
}

function isMonacoEventTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest('.monaco-editor'));
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

function attachComboMenuScrollBehavior(menu: HTMLElement): void {
  menu.addEventListener('mousedown', (event) => {
    event.preventDefault();
  });
  menu.addEventListener('wheel', (event) => {
    const canScroll = menu.scrollHeight > menu.clientHeight;
    if (!canScroll) return;

    event.preventDefault();
    event.stopPropagation();
    menu.scrollTop += event.deltaY;
  }, { passive: false });
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
