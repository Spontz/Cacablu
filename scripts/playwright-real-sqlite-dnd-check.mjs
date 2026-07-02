/* global process, console, window, document, File, Buffer, atob */

import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';

const baseUrl = process.env.CACABLU_E2E_URL ?? 'http://127.0.0.1:5177/';
const sqlitePath = process.env.CACABLU_SQLITE_PATH ?? `${process.env.USERPROFILE}\\Desktop\\Evoke 2024.sqlite`;
const sqliteName = basename(sqlitePath);
const sqliteBase64 = Buffer.from(await readFile(sqlitePath)).toString('base64');

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

try {
  await page.addInitScript(({ name, base64 }) => {
    function bytesFromBase64(input) {
      const binary = atob(input);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }
      return bytes;
    }

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
      constructor(fileName, bytes = []) {
        this.name = fileName;
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
      constructor(directoryName) {
        this.name = directoryName;
        this.kind = 'directory';
        this.directories = new Map();
        this.files = new Map();
      }

      async getDirectoryHandle(childName, options = {}) {
        let directory = this.directories.get(childName);
        if (!directory && options.create) {
          directory = new MemoryDirectoryHandle(childName);
          this.directories.set(childName, directory);
        }
        if (!directory) throw new Error(`Missing directory ${childName}`);
        return directory;
      }

      async getFileHandle(fileName, options = {}) {
        let file = this.files.get(fileName);
        if (!file && options.create) {
          file = new MemoryFileHandle(fileName);
          this.files.set(fileName, file);
        }
        if (!file) throw new Error(`Missing file ${fileName}`);
        return file;
      }

      async removeEntry(childName) {
        this.files.delete(childName);
        this.directories.delete(childName);
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
    dataFolder.directories.set('pool', new MemoryDirectoryHandle('pool'));
    dataFolder.directories.set('resources', new MemoryDirectoryHandle('resources'));

    window.__realSqliteDnd = { dataFolder };
    window.showOpenFilePicker = async () => [{
      name,
      kind: 'file',
      async getFile() {
        return new File([bytesFromBase64(base64)], name);
      },
      async createWritable() {
        return new MemoryWritable(this);
      },
    }];
    window.showSaveFilePicker = async () => ({
      name,
      kind: 'file',
      async getFile() {
        return new File([bytesFromBase64(base64)], name);
      },
      async createWritable() {
        return new MemoryWritable(this);
      },
    });
    window.showDirectoryPicker = async () => dataFolder;
  }, { name: sqliteName, base64: sqliteBase64 });

  await page.goto(baseUrl, { waitUntil: 'networkidle' });

  await page.getByRole('button', { name: 'File' }).click();
  await page.getByRole('button', { name: 'Abrir' }).click();
  await page.waitForSelector(`text=${sqliteName}`, { timeout: 15000 });
  await page.getByRole('button', { name: /select data folder/i }).click();

  for (let round = 0; round < 10; round += 1) {
    const collapsed = await page.locator(
      '[data-resource-kind="folder"] .resources__disclosure:not(.is-empty)[data-expanded="false"]',
    ).evaluateAll((nodes) => nodes.map((node) => node.parentElement));
    if (collapsed.length === 0) break;
    await page.locator(
      '[data-resource-kind="folder"] .resources__disclosure:not(.is-empty)[data-expanded="false"]',
    ).first().click();
    await page.waitForTimeout(50);
  }

  const selection = await page.evaluate(() => {
    const files = [...document.querySelectorAll('[data-resource-kind="file"]')];
    const folders = [...document.querySelectorAll('[data-resource-kind="folder"]')];

    for (const file of files) {
      const sourceParent = file.closest('.resources__subtree')?.previousElementSibling;
      const sourceParentId = sourceParent?.dataset?.resourceId;
      const target = folders.find((folder) => folder.dataset.resourceId !== sourceParentId);
      if (target) {
        return {
          fileName: file.dataset.resourceName,
          fileId: Number(file.dataset.resourceId),
          sourcePath: file.dataset.poolPath,
          sourceParentId: Number(sourceParentId),
          targetName: target.querySelector('.resources__label')?.textContent,
          targetId: Number(target.dataset.resourceId),
          targetPath: target.dataset.poolPath,
        };
      }
    }

    return null;
  });

  if (!selection) {
    throw new Error('Could not find a movable asset file and destination folder in the real SQLite project.');
  }

  await page.locator(`[data-resource-kind="file"][data-resource-id="${selection.fileId}"]`).dragTo(
    page.locator(`[data-resource-kind="folder"][data-resource-id="${selection.targetId}"]`),
  );

  try {
    await page.waitForFunction(({ fileId, targetId }) => {
      const file = document.querySelector(`[data-resource-kind="file"][data-resource-id="${fileId}"]`);
      const parentFolder = file?.closest('.resources__subtree')?.previousElementSibling;
      return Number(parentFolder?.dataset?.resourceId) === targetId;
    }, { fileId: selection.fileId, targetId: selection.targetId }, { timeout: 3000 });
  } catch (err) {
    const debug = await page.evaluate(({ fileId, targetId }) => {
      const file = document.querySelector(`[data-resource-kind="file"][data-resource-id="${fileId}"]`);
      const parentFolder = file?.closest('.resources__subtree')?.previousElementSibling;
      return {
        fileExists: Boolean(file),
        fileText: file?.textContent,
        currentParentId: Number(parentFolder?.dataset?.resourceId),
        currentParentName: parentFolder?.querySelector('.resources__label')?.textContent,
        targetId,
        targetText: document.querySelector(`[data-resource-kind="folder"][data-resource-id="${targetId}"]`)?.textContent,
        status: document.querySelector('.resources-sync__status')?.textContent,
        selectedLabels: [...document.querySelectorAll('.resources__file, .resources__folder-row')]
          .slice(0, 30)
          .map((node) => ({
            kind: node.dataset.resourceKind,
            id: node.dataset.resourceId,
            text: node.textContent,
            poolPath: node.dataset.poolPath,
          })),
      };
    }, { fileId: selection.fileId, targetId: selection.targetId });
    throw new Error(`${err instanceof Error ? err.message : String(err)}\n${JSON.stringify({ selection, debug }, null, 2)}`);
  }

  const result = await page.evaluate(({ fileId, targetId }) => {
    const file = document.querySelector(`[data-resource-kind="file"][data-resource-id="${fileId}"]`);
    const parentFolder = file?.closest('.resources__subtree')?.previousElementSibling;
    const dataFolder = window.__realSqliteDnd.dataFolder;
    return {
      movedFileName: file?.dataset.resourceName,
      currentParentId: Number(parentFolder?.dataset?.resourceId),
      targetId,
      currentParentName: parentFolder?.querySelector('.resources__label')?.textContent,
      poolRootDirectories: [...dataFolder.directories.get('pool').directories.keys()],
      status: document.querySelector('.resources-sync__status')?.textContent,
    };
  }, { fileId: selection.fileId, targetId: selection.targetId });

  console.log(JSON.stringify({ sqlitePath, selection, result }, null, 2));
} finally {
  await browser.close();
}
