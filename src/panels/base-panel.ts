import type { GroupPanelPartInitParameters, IContentRenderer } from 'dockview-core';

export function createContentRenderer(
  render: (element: HTMLElement, params: GroupPanelPartInitParameters) => void | (() => void),
): IContentRenderer {
  const element = document.createElement('section');
  element.className = 'panel';
  let cleanup: (() => void) | null = null;

  return {
    element,
    init(params): void {
      cleanup = render(element, params) ?? null;
    },
    dispose(): void {
      cleanup?.();
      cleanup = null;
    },
  };
}
