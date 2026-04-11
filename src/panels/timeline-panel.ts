import type { IContentRenderer } from 'dockview-core';

import { createContentRenderer } from './base-panel';

export function createTimelinePanel(): IContentRenderer {
  return createContentRenderer((element) => {
    element.innerHTML = `
      <h2>Timeline</h2>
      <p>Sequencing placeholder for time, cues, and transport controls.</p>
      <div class="timeline-strip">
        <span>00:00</span>
        <span>00:15</span>
        <span>00:30</span>
        <span>00:45</span>
        <span>01:00</span>
      </div>
    `;
  });
}
