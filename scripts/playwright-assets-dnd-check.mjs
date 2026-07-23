/* global process, console, window, document, File */

import { chromium } from 'playwright';

const baseUrl = process.env.CACABLU_E2E_URL ?? 'http://127.0.0.1:5177/';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

try {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });

  await page.evaluate(async () => {
    const [{ createResourcesPanel }, { createAppState }, { createDbState }, { createUndoManager }, { createAssetClipboard }] = await Promise.all([
      import('/src/panels/resources-panel.ts'),
      import('/src/state/app-state.ts'),
      import('/src/state/db-state.ts'),
      import('/src/app/undo-manager.ts'),
      import('/src/resources/asset-clipboard.ts'),
    ]);

    class MemoryWritable {
      constructor(file) {
        this.file = file;
      }

      async write(data) {
        if (data instanceof Uint8Array) {
          this.file.bytes = [...data];
          return;
        }
        if (data instanceof ArrayBuffer) {
          this.file.bytes = [...new Uint8Array(data)];
          return;
        }
        this.file.bytes = [];
      }

      async close() {}
    }

    class MemoryFileHandle {
      constructor(name, bytes = []) {
        this.name = name;
        this.kind = 'file';
        this.bytes = bytes;
      }

      async getFile() {
        return new File([new Uint8Array(this.bytes)], this.name);
      }

      async createWritable() {
        return new MemoryWritable(this);
      }
    }

    class MemoryDirectoryHandle {
      constructor(name) {
        this.name = name;
        this.kind = 'directory';
        this.directories = new Map();
        this.files = new Map();
      }

      async getDirectoryHandle(name, options = {}) {
        let directory = this.directories.get(name);
        if (!directory && options.create) {
          directory = new MemoryDirectoryHandle(name);
          this.directories.set(name, directory);
        }
        if (!directory) throw new Error(`Missing directory ${name}`);
        return directory;
      }

      async getFileHandle(name, options = {}) {
        let file = this.files.get(name);
        if (!file && options.create) {
          file = new MemoryFileHandle(name);
          this.files.set(name, file);
        }
        if (!file) throw new Error(`Missing file ${name}`);
        return file;
      }

      async removeEntry(name) {
        this.files.delete(name);
        this.directories.delete(name);
      }

      async queryPermission() {
        return 'granted';
      }

      async requestPermission() {
        return 'granted';
      }

      async *values() {
        for (const directory of this.directories.values()) yield directory;
        for (const file of this.files.values()) yield file;
      }
    }

    const dataFolder = new MemoryDirectoryHandle('data');
    const pool = new MemoryDirectoryHandle('pool');
    const source = new MemoryDirectoryHandle('source');
    const target = new MemoryDirectoryHandle('target');
    const resources = new MemoryDirectoryHandle('resources');
    pool.directories.set('source', source);
    pool.directories.set('target', target);
    dataFolder.directories.set('pool', pool);
    dataFolder.directories.set('resources', resources);

    window.showDirectoryPicker = async () => dataFolder;
    const db = {
      variables: new Map(),
      bars: [],
      fbos: [],
      folders: [
        { id: 1, name: 'source', parent: 0, enabled: true },
        { id: 2, name: 'target', parent: 0, enabled: true },
      ],
      files: [
        {
          id: 10,
          name: 'logo.png',
          parent: 1,
          bytes: 3,
          type: 'image/png',
          data: new Uint8Array([1, 2, 3]),
          format: 'png',
          enabled: true,
        },
        {
          id: 11,
          name: 'mask.png',
          parent: 1,
          bytes: 3,
          type: 'image/png',
          data: new Uint8Array([4, 5, 6]),
          format: 'png',
          enabled: true,
        },
        {
          id: 20,
          name: 'destination.txt',
          parent: 2,
          bytes: 1,
          type: 'text/plain',
          data: new Uint8Array([68]),
          format: 'txt',
          enabled: true,
        },
      ],
    };

    window.__assetDndFixture = { dataFolder, db };

    const session = {
      fileName: 'fixture.sqlite',
      data: db,
      updateCell() {},
      upsertResourceFile(input) {
        const existing = db.files.find((file) => file.parent === input.parent && file.name === input.name);
        if (existing) {
          Object.assign(existing, input);
          return existing;
        }
        const file = { id: 100 + db.files.length, enabled: true, ...input };
        db.files.push(file);
        return file;
      },
      insertResourceFolder(input) {
        const folder = { id: 100 + db.folders.length, enabled: true, ...input };
        db.folders.push(folder);
        return folder;
      },
      moveResourceItems(roots, parentId) {
        const files = roots.flatMap((root) => {
          if (root.kind === 'folder') {
            const folder = db.folders.find((candidate) => candidate.id === root.id);
            if (!folder) throw new Error('missing folder');
            const descendants = db.files.filter((file) => file.parent === folder.id);
            const oldPrefix = folder.parent === 0 ? `/pool/${folder.name}` : `/pool/target/${folder.name}`;
            folder.parent = parentId;
            const newPrefix = parentId === 0 ? `/pool/${folder.name}` : `/pool/target/${folder.name}`;
            return descendants.map((file) => ({
              file,
              oldPath: `${oldPrefix}/${file.name}`,
              newPath: `${newPrefix}/${file.name}`,
            }));
          }
          const file = db.files.find((candidate) => candidate.id === root.id);
          if (!file) throw new Error('missing file');
          const oldPath = `/pool/source/${file.name}`;
          file.parent = parentId;
          return { file, oldPath, newPath: `/pool/target/${file.name}` };
        });
        return { operation: 'move', roots, files };
      },
      moveResourceItemsToParents(roots) {
        const files = roots.flatMap((root) => {
          if (root.kind === 'folder') {
            const folder = db.folders.find((candidate) => candidate.id === root.id);
            if (!folder) throw new Error('missing folder');
            const descendants = db.files.filter((file) => file.parent === folder.id);
            const oldPrefix = folder.parent === 0 ? `/pool/${folder.name}` : `/pool/target/${folder.name}`;
            folder.parent = root.parentId;
            const newPrefix = root.parentId === 0 ? `/pool/${folder.name}` : `/pool/target/${folder.name}`;
            return descendants.map((file) => ({
              file,
              oldPath: `${oldPrefix}/${file.name}`,
              newPath: `${newPrefix}/${file.name}`,
            }));
          }
          const file = db.files.find((candidate) => candidate.id === root.id);
          if (!file) throw new Error('missing file');
          const oldPath = `/pool/target/${file.name}`;
          file.parent = root.parentId;
          return { file, oldPath, newPath: `/pool/source/${file.name}` };
        });
        return { operation: 'move', roots, files };
      },
      async save() {},
      async saveAs() { return this; },
      close() {},
    };

    const state = createAppState();
    const dbState = createDbState();
    const undo = createUndoManager();
    const sessionRef = { current: session };
    const connection = {
      isConnected: () => false,
      subscribeAssets: () => () => {},
    };

    const root = document.querySelector('#app');
    root.innerHTML = '';
    window.__assetDndFixture.state = state;
    window.__assetDndFixture.undo = undo;
    const renderer = createResourcesPanel(state, dbState, sessionRef, connection, undo, createAssetClipboard());
    root.append(renderer.element);
    renderer.init({});
    dbState.setOpen('fixture.sqlite');
  });

  await page.locator('[data-resource-kind="folder"]', { hasText: 'source' }).click();

  const sourceFile = page.locator('[data-resource-kind="file"]', { hasText: 'logo.png' });
  const secondSourceFile = page.locator('[data-resource-kind="file"]', { hasText: 'mask.png' });
  const targetFolder = page.locator('[data-resource-kind="folder"]', { hasText: 'target' });

  await sourceFile.click();
  await secondSourceFile.click({ modifiers: ['Control'] });
  await sourceFile.dragTo(targetFolder);
  await page.waitForFunction(() => window.__assetDndFixture?.db?.files
    ?.filter((file) => file.id === 10 || file.id === 11)
    .every((file) => file.parent === 2), null, { timeout: 1000 }).catch(async () => {
    const state = await page.evaluate(() => {
      const fixture = window.__assetDndFixture;
      return {
        dbFileParents: fixture.db.files.filter((file) => file.id === 10 || file.id === 11).map((file) => [file.id, file.parent]),
        labels: [...document.querySelectorAll('.resources__label')].map((node) => node.textContent),
      };
    });
    throw new Error(`Asset DnD did not move all selected files: ${JSON.stringify(state)}`);
  });

  const result = await page.evaluate(() => {
    const fixture = window.__assetDndFixture;
    return {
      dbFileParents: fixture.db.files.filter((file) => file.id === 10 || file.id === 11).map((file) => [file.id, file.parent]),
      selection: fixture.state.getSnapshot().assetSelection,
      disclosureCount: document.querySelectorAll('.resources__disclosure').length,
    };
  });
  const selectedIds = result.selection.kind === 'multiple'
    ? result.selection.items.map((item) => item.id).sort((a, b) => a - b)
    : [];
  if (JSON.stringify(selectedIds) !== JSON.stringify([10, 11])) {
    throw new Error(`Asset DnD did not preserve the moved multi-selection: ${JSON.stringify(result)}`);
  }

  await page.evaluate(() => window.__assetDndFixture.undo.undo());
  await page.waitForFunction(() => window.__assetDndFixture.db.files
    .filter((file) => file.id === 10 || file.id === 11)
    .every((file) => file.parent === 1));
  result.parentsAfterUndo = await page.evaluate(() => window.__assetDndFixture.db.files
    .filter((file) => file.id === 10 || file.id === 11)
    .map((file) => [file.id, file.parent]));

  const sourceFolder = page.locator('[data-resource-kind="folder"]', { hasText: 'source' });
  await targetFolder.click();
  const targetChild = page.locator('[data-resource-kind="file"]', { hasText: 'destination.txt' });
  await sourceFolder.dragTo(targetChild);
  await page.waitForFunction(() => window.__assetDndFixture.db.folders.find((folder) => folder.id === 1)?.parent === 2);
  result.folderParentAfterMove = await page.evaluate(() => window.__assetDndFixture.db.folders.find((folder) => folder.id === 1)?.parent);
  await page.evaluate(() => window.__assetDndFixture.undo.undo());
  await page.waitForFunction(() => window.__assetDndFixture.db.folders.find((folder) => folder.id === 1)?.parent === 0);
  result.folderParentAfterUndo = await page.evaluate(() => window.__assetDndFixture.db.folders.find((folder) => folder.id === 1)?.parent);

  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
