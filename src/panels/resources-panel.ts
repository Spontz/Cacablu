import type { IContentRenderer } from 'dockview-core';

import { createContentRenderer } from './base-panel';

export function createResourcesPanel(): IContentRenderer {
  return createContentRenderer((element) => {
    element.innerHTML = `
      <h2>Resources</h2>
      <p>Asset browser placeholder for clips, media, and imported items.</p>
      <ul class="panel-list">
        <li>Video Layers</li>
        <li>Image Sequences</li>
        <li>Shader Presets</li>
      </ul>
    `;
  });
}
