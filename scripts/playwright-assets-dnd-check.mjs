/* global process, console, window, document, File */

import { chromium } from 'playwright';

const baseUrl = process.env.CACABLU_E2E_URL ?? 'http://127.0.0.1:5177/';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

try {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });

  await page.evaluate(async () => {
    const [{ createResourcesPanel }, { createAppState }, { createDbState }] = await Promise.all([
      import('/src/panels/resources-panel.ts'),
      import('/src/state/app-state.ts'),
      import('/src/state/db-state.ts'),
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
      moveResourceFile(fileId, parentId) {
        const file = db.files.find((candidate) => candidate.id === fileId);
        if (!file) throw new Error('missing file');
        file.parent = parentId;
        return file;
      },
      async save() {},
      async saveAs() { return this; },
      close() {},
    };

    const state = createAppState();
    const dbState = createDbState();
    const sessionRef = { current: session };
    const connection = {
      isConnected: () => false,
      subscribeAssets: () => () => {},
    };

    const root = document.querySelector('#app');
    root.innerHTML = '';
    const renderer = createResourcesPanel(state, dbState, sessionRef, connection);
    root.append(renderer.element);
    renderer.init({});
    dbState.setOpen('fixture.sqlite');
  });

  await page.getByRole('button', { name: /select data folder/i }).click();
  await page.locator('[data-resource-kind="folder"]', { hasText: 'source' }).click();

  const sourceFile = page.locator('[data-resource-kind="file"]', { hasText: 'logo.png' });
  const targetFolder = page.locator('[data-resource-kind="folder"]', { hasText: 'target' });

  await sourceFile.dragTo(targetFolder);
  await page.waitForFunction(() => {
    const fixture = window.__assetDndFixture;
    const target = fixture?.dataFolder?.directories?.get('pool')?.directories?.get('target');
    const source = fixture?.dataFolder?.directories?.get('pool')?.directories?.get('source');
    const dbFile = fixture?.db?.files?.find((file) => file.id === 10);
    return target?.files?.has('logo.png') && !source?.files?.has('logo.png') && dbFile?.parent === 2;
  }, null, { timeout: 1000 }).catch(async () => {
    const state = await page.evaluate(() => {
      const fixture = window.__assetDndFixture;
      const pool = fixture.dataFolder.directories.get('pool');
      return {
        sourceFiles: [...pool.directories.get('source').files.keys()],
        targetFiles: [...pool.directories.get('target').files.keys()],
        dbFileParent: fixture.db.files.find((file) => file.id === 10)?.parent,
        labels: [...document.querySelectorAll('.resources__label')].map((node) => node.textContent),
        status: document.querySelector('.resources-sync__status')?.textContent,
      };
    });
    throw new Error(`Asset DnD did not move file: ${JSON.stringify(state)}`);
  });

  const result = await page.evaluate(() => {
    const fixture = window.__assetDndFixture;
    const pool = fixture.dataFolder.directories.get('pool');
    return {
      sourceFiles: [...pool.directories.get('source').files.keys()],
      targetFiles: [...pool.directories.get('target').files.keys()],
      dbFileParent: fixture.db.files.find((file) => file.id === 10)?.parent,
      disclosureCount: document.querySelectorAll('.resources__disclosure').length,
      status: document.querySelector('.resources-sync__status')?.textContent,
    };
  });

  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
