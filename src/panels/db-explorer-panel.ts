import type { IContentRenderer } from 'dockview-core';

import type { DbState } from '../state/db-state';
import type { DbSessionRef } from '../db/db-session';
import type { ProjectDatabase } from '../db/db-schema';
import { createContentRenderer } from './base-panel';

const TABLE_NAMES = ['variables', 'bars', 'fbos', 'files', 'folders'] as const;
type TableName = (typeof TABLE_NAMES)[number];

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
        tr.insertCell().textContent = v;
      }
      dataArea.append(table);
    }

    function renderRows(rows: object[]): void {
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
          } else {
            td.textContent = String(val ?? '');
          }
        }
      }
      dataArea.append(table);
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
        for (const name of TABLE_NAMES) {
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

      renderRows(db[selectedTable] as object[]);
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
