/* global process, console, window, document, File, DragEvent, DataTransfer */

import { chromium } from 'playwright';

const baseUrl = process.env.CACABLU_E2E_URL ?? 'http://127.0.0.1:5177/';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(error.message));

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
      updateResourceFileContent(fileId, input) {
        const file = db.files.find((candidate) => candidate.id === fileId);
        if (!file) throw new Error(`missing file ${fileId}`);
        Object.assign(file, input);
        return file;
      },
      findResourceScriptReferences() {
        return [];
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
    window.__assetDndFixture.dbState = dbState;
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

  await page.evaluate(() => {
    const { dbState } = window.__assetDndFixture;
    dbState.setDirty();
    dbState.setSaving();
    dbState.setSaved();
  });
  const sourceDisclosure = page.locator('[data-resource-kind="folder"][data-resource-id="1"] .resources__disclosure');
  if (await sourceDisclosure.getAttribute('data-expanded') !== 'true' || !await sourceFile.isVisible()) {
    throw new Error('Saving the project collapsed the expanded Pool tree.');
  }

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

  const primeStaleInternalDrag = async () => {
    await page.evaluate(() => {
      const transfer = new DataTransfer();
      const staleFile = document.querySelector('[data-resource-kind="file"][data-resource-id="20"]');
      if (!staleFile) throw new Error('Missing file used to prime the stale internal drag.');
      staleFile.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: transfer }));
    });
  };

  const dropExternalFile = async (bytes, name = 'destination.txt', targetId = 2) => {
    await page.evaluate(({ content, fileName, folderId }) => {
      const transfer = new DataTransfer();
      transfer.items.add(new File([new Uint8Array(content)], fileName, { type: 'text/plain' }));
      const target = document.querySelector(`[data-resource-kind="folder"][data-resource-id="${folderId}"]`);
      if (!target) throw new Error('Missing target folder for external file drop.');
      target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
    }, { content: bytes, fileName: name, folderId: targetId });
  };

  await primeStaleInternalDrag();
  await dropExternalFile([1, 2, 3], 'first.glsl', 2);
  await page.waitForFunction(() => window.__assetDndFixture.db.files.some((file) => (
    file.name === 'first.glsl' && file.parent === 2
  )));
  await dropExternalFile([4, 5, 6], 'second.glsl', 1);
  await page.waitForFunction(() => window.__assetDndFixture.db.files.some((file) => (
    file.name === 'second.glsl' && file.parent === 1
  )));
  const staleDropRegression = await page.evaluate(() => ({
    destinationParent: window.__assetDndFixture.db.files.find((file) => file.id === 20)?.parent,
    imported: window.__assetDndFixture.db.files
      .filter((file) => file.name === 'first.glsl' || file.name === 'second.glsl')
      .map((file) => [file.name, file.parent]),
  }));
  if (staleDropRegression.destinationParent !== 2 || staleDropRegression.imported.length !== 2) {
    throw new Error(`External file drop reused a stale internal drag: ${JSON.stringify(staleDropRegression)}`);
  }
  await page.evaluate(() => window.__assetDndFixture.dbState.setSaved());

  await dropExternalFile([88]);
  const replaceDialog = page.locator('[data-resource-replace-dialog]');
  await replaceDialog.waitFor({ state: 'visible', timeout: 2000 }).catch(async () => {
    const diagnostics = await page.evaluate(() => ({
      files: window.__assetDndFixture.db.files.map((file) => ({ id: file.id, name: file.name, parent: file.parent, data: [...file.data] })),
      status: document.querySelector('.resources__sync-status')?.textContent,
      dialogs: [...document.querySelectorAll('dialog')].map((dialog) => dialog.textContent),
    }));
    throw new Error(`Replacement prompt did not open: ${JSON.stringify({ diagnostics, pageErrors })}`);
  });
  result.replacePrompt = await replaceDialog.textContent();
  await replaceDialog.getByRole('button', { name: 'Cancel' }).click();
  result.fileAfterCancel = await page.evaluate(() => {
    const file = window.__assetDndFixture.db.files.find((candidate) => candidate.id === 20);
    return file ? {
      id: file.id,
      enabled: file.enabled,
      data: [...file.data],
      dirty: window.__assetDndFixture.dbState.getSnapshot().isDirty,
    } : null;
  });

  await dropExternalFile([89, 90]);
  await replaceDialog.waitFor({ state: 'visible' });
  await replaceDialog.getByRole('button', { name: 'Replace' }).click();
  await page.waitForFunction(() => {
    const file = window.__assetDndFixture.db.files.find((candidate) => candidate.id === 20);
    return file?.data?.length === 2 && file.data[0] === 89 && file.data[1] === 90;
  });
  result.fileAfterReplace = await page.evaluate(() => {
    const file = window.__assetDndFixture.db.files.find((candidate) => candidate.id === 20);
    return file ? {
      id: file.id,
      enabled: file.enabled,
      parent: file.parent,
      name: file.name,
      data: [...file.data],
      dirty: window.__assetDndFixture.dbState.getSnapshot().isDirty,
    } : null;
  });

  if (
    !result.replacePrompt?.includes('already exists')
    || JSON.stringify(result.fileAfterCancel) !== JSON.stringify({ id: 20, enabled: true, data: [68], dirty: false })
    || JSON.stringify(result.fileAfterReplace) !== JSON.stringify({
      id: 20,
      enabled: true,
      parent: 2,
      name: 'destination.txt',
      data: [89, 90],
      dirty: true,
    })
  ) {
    throw new Error(`Duplicate Pool import workflow failed: ${JSON.stringify(result)}`);
  }

  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
