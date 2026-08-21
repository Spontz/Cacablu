/* global process, console, document, localStorage */

import { chromium } from 'playwright';

const baseUrl = process.env.CACABLU_E2E_URL ?? 'http://127.0.0.1:5191/';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

try {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  const result = await page.evaluate(async () => {
    const [{ createDockviewWorkspace }, { createAppState }, storageModule] = await Promise.all([
      import('/src/layout/dockview-workspace.ts'),
      import('/src/state/app-state.ts'),
      import('/src/layout/workspace-layout-storage.ts'),
    ]);

    localStorage.removeItem(storageModule.WORKSPACE_LAYOUT_STORAGE_KEY);
    const panels = {
      create(component) {
        const element = document.createElement('div');
        element.textContent = component;
        return { element, init() {}, dispose() {} };
      },
    };
    const createContainer = () => {
      const container = document.createElement('div');
      container.style.width = '1200px';
      container.style.height = '800px';
      document.body.append(container);
      return container;
    };
    const createWorkspace = () => createDockviewWorkspace({
      state: createAppState(),
      panels,
    });

    const first = createWorkspace();
    first.mount(createContainer());
    first.openPanel('timeline');
    first.openPanel('preview');
    first.openPanel('resources');
    first.openFloating('layout-test-float', 'about-panel', 'Floating Test');
    await new Promise((resolve) => setTimeout(resolve, 50));

    const savedRaw = localStorage.getItem(storageModule.WORKSPACE_LAYOUT_STORAGE_KEY);
    if (!savedRaw) throw new Error('Layout was not written');
    const saved = JSON.parse(savedRaw);

    const restored = createWorkspace();
    restored.mount(createContainer());
    const restoredPanels = ['timeline', 'preview', 'resources', 'layout-test-float']
      .filter((id) => restored.isPanelOpen(id));

    restored.resetLayout();
    await new Promise((resolve) => setTimeout(resolve, 50));
    const restoredEmpty = createWorkspace();
    restoredEmpty.mount(createContainer());
    const emptyPreference = restoredEmpty.hasLayoutPreference();
    const emptyPanelCount = ['timeline', 'preview', 'resources', 'layout-test-float']
      .filter((id) => restoredEmpty.isPanelOpen(id)).length;

    localStorage.setItem(storageModule.WORKSPACE_LAYOUT_STORAGE_KEY, '{invalid');
    const fallback = createWorkspace();
    fallback.mount(createContainer());

    return {
      version: saved.version,
      storedPanels: Object.keys(saved.layout.panels).sort(),
      floatingGroups: saved.layout.floatingGroups?.length ?? 0,
      restoredPanels,
      restoredPreference: restored.hasLayoutPreference(),
      emptyPreference,
      emptyPanelCount,
      corruptEntryRemoved: localStorage.getItem(storageModule.WORKSPACE_LAYOUT_STORAGE_KEY) === null,
      fallbackPreference: fallback.hasLayoutPreference(),
    };
  });

  if (
    result.version !== 1
    || result.storedPanels.join(',') !== 'layout-test-float,preview,resources,timeline'
    || result.floatingGroups !== 1
    || result.restoredPanels.length !== 4
    || !result.restoredPreference
    || !result.emptyPreference
    || result.emptyPanelCount !== 0
    || !result.corruptEntryRemoved
    || result.fallbackPreference
  ) {
    throw new Error(`Layout persistence failed: ${JSON.stringify(result)}`);
  }

  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
