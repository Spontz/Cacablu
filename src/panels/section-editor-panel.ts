import type { IContentRenderer } from 'dockview-core';

import type { AppState } from '../state/app-state';
import type { DbState } from '../state/db-state';
import type { DbSessionRef } from '../db/db-session';
import type { DbBar } from '../db/db-schema';
import { createContentRenderer } from './base-panel';

const TEMPLATE_STORAGE_KEY = 'cacablu.sectionEditor.templates';

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
  name: string;
  code: string;
}

const BUILTIN_TEMPLATES: SectionTemplate[] = [
  { name: 'Current Bar', code: '' },
  { name: 'Empty Section', code: '' },
  { name: 'Draw Image', code: 'drawImage();' },
  { name: 'Draw Scene', code: 'drawScene();' },
  { name: 'Effect', code: 'applyEffect();' },
];

const BAR_TEMPLATE_OPTIONS = [
  'Current Bar',
  'Image',
  'Scene',
  'Effect',
  'Sound',
];

export function createSectionEditorPanel(
  state: AppState,
  dbState: DbState,
  sessionRef: DbSessionRef,
): IContentRenderer {
  return createContentRenderer((element) => {
    element.className = 'panel panel--section-editor';

    let activeBarId: number | null = null;

    function getSelectedBar(): DbBar | null {
      const selection = state.getSnapshot().resourceSelection;
      if (selection.kind !== 'bar') return null;
      return sessionRef.current?.data.bars.find((bar) => bar.id === selection.id) ?? null;
    }

    function renderEmpty(message = 'Select a timeline bar.'): void {
      element.replaceChildren(createPlaceholder(message));
    }

    function render(): void {
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
      const templates = [...BUILTIN_TEMPLATES, ...readStoredTemplates()];

      const root = document.createElement('div');
      root.className = 'section-editor';

      const templateRow = document.createElement('div');
      templateRow.className = 'section-editor__row section-editor__row--templates';

      const barTemplateField = createField('Bar Type');
      const barTemplateSelect = document.createElement('select');
      barTemplateSelect.className = 'section-editor__select';
      for (const name of BAR_TEMPLATE_OPTIONS) {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        barTemplateSelect.append(option);
      }
      barTemplateField.append(barTemplateSelect);

      const scriptTemplateField = createField('Script Template');
      const scriptTemplateSelect = document.createElement('select');
      scriptTemplateSelect.className = 'section-editor__select';
      for (const template of templates) {
        const option = document.createElement('option');
        option.value = template.name;
        option.textContent = template.name;
        scriptTemplateSelect.append(option);
      }
      scriptTemplateField.append(scriptTemplateSelect);

      const saveTemplate = document.createElement('button');
      saveTemplate.type = 'button';
      saveTemplate.className = 'section-editor__button';
      saveTemplate.textContent = 'Save Template';

      templateRow.append(barTemplateField, scriptTemplateField, saveTemplate);

      const code = document.createElement('textarea');
      code.className = 'section-editor__code';
      code.spellcheck = false;
      code.value = bar.script ?? '';

      const blendRow = document.createElement('div');
      blendRow.className = 'section-editor__row section-editor__row--blend';

      const srcField = createField('Blend Source');
      const srcSelect = createBlendSelect(bar.srcBlending);
      srcField.append(srcSelect);

      const dstField = createField('Blend Destination');
      const dstSelect = createBlendSelect(bar.dstBlending);
      dstField.append(dstSelect);

      const equationField = createField('Blend Equation');
      const equationSelect = createBlendEquationSelect(bar.blendingEQ);
      equationField.append(equationSelect);

      const apply = document.createElement('button');
      apply.type = 'button';
      apply.className = 'section-editor__button section-editor__button--primary';
      apply.textContent = 'Apply';

      const status = document.createElement('p');
      status.className = 'section-editor__status';
      status.setAttribute('role', 'status');

      blendRow.append(srcField, dstField, equationField, apply);
      root.append(templateRow, code, blendRow, status);
      element.replaceChildren(root);

      scriptTemplateSelect.addEventListener('change', () => {
        const template = templates.find((candidate) => candidate.name === scriptTemplateSelect.value);
        if (!template || template.name === 'Current Bar') {
          code.value = bar.script ?? '';
          return;
        }
        code.value = template.code;
      });

      saveTemplate.addEventListener('click', () => {
        const name = window.prompt('Template name', scriptTemplateSelect.value === 'Current Bar' ? `Bar ${bar.id}` : scriptTemplateSelect.value);
        if (!name) return;

        const stored = readStoredTemplates().filter((template) => template.name !== name);
        stored.push({ name, code: code.value });
        writeStoredTemplates(stored);
        if (!Array.from(scriptTemplateSelect.options).some((option) => option.value === name)) {
          const option = document.createElement('option');
          option.value = name;
          option.textContent = name;
          scriptTemplateSelect.append(option);
        }
        scriptTemplateSelect.value = name;
        status.textContent = `Template "${name}" saved.`;
      });

      apply.addEventListener('click', () => {
        const current = getSelectedBar();
        const session = sessionRef.current;
        if (!current || !session) {
          status.textContent = 'No selected bar.';
          return;
        }

        session.updateCell('bars', current.id, 'script', code.value);
        session.updateCell('bars', current.id, 'srcBlending', srcSelect.value);
        session.updateCell('bars', current.id, 'dstBlending', dstSelect.value);
        session.updateCell('bars', current.id, 'blendingEQ', equationSelect.value);
        current.script = code.value;
        current.srcBlending = srcSelect.value;
        current.dstBlending = dstSelect.value;
        current.blendingEQ = equationSelect.value;
        status.textContent = `Bar ${current.id} applied.`;
        state.setResourceSelection({ kind: 'bar', id: current.id });
      });
    }

    const unsubscribeState = state.subscribe((snapshot) => {
      const nextBarId = snapshot.resourceSelection.kind === 'bar' ? snapshot.resourceSelection.id : null;
      if (nextBarId !== activeBarId) {
        render();
      }
    });
    const unsubscribeDb = dbState.subscribe(render);

    render();

    return () => {
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

function createBlendSelect(value: string): HTMLSelectElement {
  const select = document.createElement('select');
  select.className = 'section-editor__select';
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

function readStoredTemplates(): SectionTemplate[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(TEMPLATE_STORAGE_KEY) ?? '[]') as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isStoredTemplate);
  } catch {
    return [];
  }
}

function writeStoredTemplates(templates: SectionTemplate[]): void {
  window.localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(templates));
}

function isStoredTemplate(value: unknown): value is SectionTemplate {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<SectionTemplate>;
  return typeof candidate.name === 'string' && typeof candidate.code === 'string';
}
