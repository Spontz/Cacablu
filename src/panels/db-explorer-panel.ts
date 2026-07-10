import type { IContentRenderer } from 'dockview-core';

import type { DbState } from '../state/db-state';
import type { DbSessionRef } from '../db/db-session';
import type { ProjectDatabase } from '../db/db-schema';
import { createContentRenderer } from './base-panel';

type TableName = keyof ProjectDatabase;
type EditableValue = string | number | boolean | null;

export function createDbExplorerPanel(
  dbState: DbState,
  sessionRef: DbSessionRef,
): IContentRenderer {
  return createContentRenderer((element) => {
    element.className = 'panel panel--db-explorer';

    const placeholder = document.createElement('p');
    placeholder.className = 'db-explorer__placeholder';
    placeholder.textContent = 'No database open.';

    const layout = document.createElement('div');
    layout.className = 'db-explorer__layout';

    const tableList = document.createElement('ul');
    tableList.className = 'db-explorer__table-list';

    const dataArea = document.createElement('div');
    dataArea.className = 'db-explorer__data-area';

    layout.append(tableList, dataArea);
    element.append(placeholder, layout);

    let selectedTable: TableName | null = null;

    function renderVariables(db: ProjectDatabase): void {
      const table = document.createElement('table');
      table.className = 'db-explorer__grid';
      const hr = table.createTHead().insertRow();
      for (const col of ['variable', 'value']) {
        const th = document.createElement('th');
        th.textContent = col;
        hr.append(th);
      }
      const tbody = table.createTBody();
      for (const [k, v] of db.variables) {
        const tr = tbody.insertRow();
        tr.insertCell().textContent = k;
        const valueCell = tr.insertCell();
        renderEditableCell(valueCell, v, (nextValue) => {
          sessionRef.current?.updateCell('variables', k, 'value', String(nextValue ?? ''));
          db.variables.set(k, String(nextValue ?? ''));
        });
      }
      dataArea.append(table);
    }

    function renderRows(tableName: Exclude<TableName, 'variables'>, rows: object[]): void {
      if (rows.length === 0) {
        const hint = document.createElement('p');
        hint.className = 'db-explorer__hint';
        hint.textContent = 'This table is empty.';
        dataArea.append(hint);
        return;
      }

      const cols = Object.keys(rows[0]);
      const table = document.createElement('table');
      table.className = 'db-explorer__grid';
      const hr = table.createTHead().insertRow();
      for (const col of cols) {
        const th = document.createElement('th');
        th.textContent = col;
        hr.append(th);
      }
      const tbody = table.createTBody();
      for (const row of rows) {
        const tr = tbody.insertRow();
        for (const col of cols) {
          const val = (row as Record<string, unknown>)[col];
          const td = tr.insertCell();
          if (val instanceof Uint8Array) {
            td.textContent = `[${val.byteLength} bytes]`;
            td.className = 'db-explorer__blob';
          } else if (isReadOnlyColumn(col)) {
            td.textContent = String(val ?? '');
          } else {
            renderEditableCell(td, val, (nextValue) => {
              const rowId = (row as Record<string, unknown>).id;
              if (typeof rowId !== 'number') throw new Error('Cannot edit a row without a numeric id.');
              sessionRef.current?.updateCell(tableName, rowId, col, nextValue);
              (row as Record<string, unknown>)[col] = nextValue;
            });
          }
        }
      }
      dataArea.append(table);
    }

    function renderEditableCell(
      cell: HTMLTableCellElement,
      value: unknown,
      applyValue: (value: EditableValue) => void,
    ): void {
      const input = document.createElement('input');
      input.className = 'db-explorer__cell-input';
      input.value = String(value ?? '');
      input.dataset.originalValue = input.value;
      cell.classList.add('db-explorer__cell--editable');
      cell.append(input);

      const commit = (): void => {
        const originalValue = input.dataset.originalValue ?? '';
        if (input.value === originalValue) return;

        const parsed = parseEditedValue(value, input.value);
        if (!parsed.ok) {
          input.value = originalValue;
          flashInvalidCell(cell);
          return;
        }

        try {
          applyValue(parsed.value);
          input.dataset.originalValue = input.value;
          dbState.setDirty();
        } catch {
          input.value = originalValue;
          flashInvalidCell(cell);
        }
      };

      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          input.blur();
        }

        if (event.key === 'Escape') {
          event.preventDefault();
          input.value = input.dataset.originalValue ?? '';
          input.blur();
        }
      });

      input.addEventListener('blur', commit);
    }

    function flashInvalidCell(cell: HTMLTableCellElement): void {
      cell.classList.add('db-explorer__cell--invalid');
      window.setTimeout(() => {
        cell.classList.remove('db-explorer__cell--invalid');
      }, 900);
    }

    function render(): void {
      const db = sessionRef.current?.data ?? null;
      const hasDb = db !== null;

      // Use style.display directly — CSS display rules override the hidden attribute
      placeholder.style.display = hasDb ? 'none' : 'flex';
      layout.style.display = hasDb ? 'grid' : 'none';

      if (!hasDb) selectedTable = null;

      tableList.innerHTML = '';
      if (db) {
        for (const name of getTableNames(db)) {
          const li = document.createElement('li');
          li.className = 'db-explorer__table-item';
          if (name === selectedTable) li.classList.add('is-selected');
          li.dataset.table = name;
          li.textContent = name;
          tableList.append(li);
        }
      }

      dataArea.innerHTML = '';
      if (!db || !selectedTable) {
        const hint = document.createElement('p');
        hint.className = 'db-explorer__hint';
        hint.textContent = db ? 'Select a table from the list.' : '';
        dataArea.append(hint);
        return;
      }

      if (selectedTable === 'variables') {
        renderVariables(db);
        return;
      }

      renderRows(selectedTable, db[selectedTable] as object[]);
    }

    render();

    dbState.subscribe(render);

    tableList.addEventListener('click', (event) => {
      const item = (event.target as HTMLElement).closest<HTMLElement>('[data-table]');
      if (!item?.dataset.table) return;
      selectedTable = item.dataset.table as TableName;
      render();
    });
  });
}

function getTableNames(db: ProjectDatabase): TableName[] {
  return Object.keys(db).filter((key): key is TableName => {
    const value = db[key as keyof ProjectDatabase];
    return value instanceof Map || Array.isArray(value);
  });
}

function isReadOnlyColumn(column: string): boolean {
  return column === 'id' || column === 'data';
}

function parseEditedValue(
  currentValue: unknown,
  rawValue: string,
): { ok: true; value: EditableValue } | { ok: false } {
  if (typeof currentValue === 'number') {
    const nextNumber = Number(rawValue);
    if (!Number.isFinite(nextNumber)) return { ok: false };
    return { ok: true, value: nextNumber };
  }

  if (typeof currentValue === 'boolean') {
    const normalized = rawValue.trim().toLowerCase();
    if (['1', 'true', 'yes'].includes(normalized)) return { ok: true, value: true };
    if (['0', 'false', 'no'].includes(normalized)) return { ok: true, value: false };
    return { ok: false };
  }

  if (currentValue === null) {
    return { ok: true, value: rawValue.length > 0 ? rawValue : null };
  }

  return { ok: true, value: rawValue };
}
