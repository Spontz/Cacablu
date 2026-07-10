import type { IContentRenderer } from 'dockview-core';

import type { DbSessionRef, DbTableSnapshot } from '../db/db-session';
import type { DbState } from '../state/db-state';
import { createContentRenderer } from './base-panel';

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

    let selectedTable: string | null = null;

    function renderTable(snapshot: DbTableSnapshot): void {
      if (snapshot.columns.length === 0) {
        const hint = document.createElement('p');
        hint.className = 'db-explorer__hint';
        hint.textContent = 'This table has no columns.';
        dataArea.append(hint);
        return;
      }

      const table = document.createElement('table');
      table.className = 'db-explorer__grid';
      const hr = table.createTHead().insertRow();
      for (const col of snapshot.columns) {
        const th = document.createElement('th');
        th.textContent = col;
        hr.append(th);
      }

      if (snapshot.rows.length === 0) {
        dataArea.append(table);
        const hint = document.createElement('p');
        hint.className = 'db-explorer__hint';
        hint.textContent = 'This table is empty.';
        dataArea.append(hint);
        return;
      }

      const tbody = table.createTBody();
      for (const row of snapshot.rows) {
        const tr = tbody.insertRow();
        for (const col of snapshot.columns) {
          const val = row[col];
          const td = tr.insertCell();
          if (val instanceof Uint8Array) {
            td.textContent = `[${val.byteLength} bytes]`;
            td.className = 'db-explorer__blob';
          } else if (isReadOnlyColumn(col) || !canEditRow(snapshot, row)) {
            td.textContent = String(val ?? '');
          } else {
            renderEditableCell(td, val, (nextValue) => {
              const rowKey = getRowKey(snapshot, row);
              if (rowKey === null) throw new Error('Cannot edit a row without a supported primary key.');
              sessionRef.current?.updateCell(snapshot.name, rowKey, col, nextValue);
              row[col] = nextValue;
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
      const session = sessionRef.current;
      const hasDb = session !== null;

      placeholder.style.display = hasDb ? 'none' : 'flex';
      layout.style.display = hasDb ? 'grid' : 'none';

      if (!hasDb) selectedTable = null;

      const tableNames = session?.getTableNames() ?? [];
      if (selectedTable && !tableNames.includes(selectedTable)) {
        selectedTable = null;
      }

      tableList.innerHTML = '';
      for (const name of tableNames) {
        const li = document.createElement('li');
        li.className = 'db-explorer__table-item';
        if (name === selectedTable) li.classList.add('is-selected');
        li.dataset.table = name;
        li.textContent = name;
        tableList.append(li);
      }

      dataArea.innerHTML = '';
      if (!session || !selectedTable) {
        const hint = document.createElement('p');
        hint.className = 'db-explorer__hint';
        hint.textContent = session ? 'Select a table from the list.' : '';
        dataArea.append(hint);
        return;
      }

      renderTable(session.getTableSnapshot(selectedTable));
    }

    render();

    dbState.subscribe(render);

    tableList.addEventListener('click', (event) => {
      const item = (event.target as HTMLElement).closest<HTMLElement>('[data-table]');
      if (!item?.dataset.table) return;
      selectedTable = item.dataset.table;
      render();
    });
  });
}

function isReadOnlyColumn(column: string): boolean {
  return column === 'id' || column === 'data';
}

function canEditRow(snapshot: DbTableSnapshot, row: Record<string, unknown>): boolean {
  return getRowKey(snapshot, row) !== null;
}

function getRowKey(snapshot: DbTableSnapshot, row: Record<string, unknown>): string | number | null {
  if (snapshot.name.toLowerCase() === 'variables') {
    const key = row.variable;
    return typeof key === 'string' || typeof key === 'number' ? key : null;
  }

  const id = row.id;
  return typeof id === 'string' || typeof id === 'number' ? id : null;
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
