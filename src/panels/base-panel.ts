import type { GroupPanelPartInitParameters, IContentRenderer } from 'dockview-core';

export function createContentRenderer(
  render: (element: HTMLElement, params: GroupPanelPartInitParameters) => void,
): IContentRenderer {
  const element = document.createElement('section');
  element.className = 'panel';

  return {
    element,
    init(params): void {
      render(element, params);
    },
  };
}
