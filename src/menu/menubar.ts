import type { MenuActionDefinition } from '../app/types';

interface MenuBarOptions {
  actions: MenuActionDefinition[];
  runAction: (actionId: string) => void;
}

export interface MenuBar {
  element: HTMLElement;
  updateActions(actions: MenuActionDefinition[]): void;
}

export function createMenuBar(options: MenuBarOptions): MenuBar {
  const element = document.createElement('nav');
  element.className = 'menu-bar';
  element.setAttribute('aria-label', 'Main menu');

  const menuNames = ['File', 'View', 'Window', 'Help'] as const;
  const buttonMap = new Map<string, HTMLButtonElement>();

  function render(actions: MenuActionDefinition[]): void {
    buttonMap.clear();
    element.innerHTML = '';

    for (const menuName of menuNames) {
      const menuRoot = document.createElement('div');
      menuRoot.className = 'menu-bar__group';

      const trigger = document.createElement('button');
      trigger.className = 'menu-bar__trigger';
      trigger.type = 'button';
      trigger.textContent = menuName;

      const popup = document.createElement('div');
      popup.className = 'menu-bar__popup';

      const menuActions = actions.filter((action) => action.menu === menuName);

      for (const action of menuActions) {
        const actionButton = document.createElement('button');
        actionButton.className = 'menu-bar__item';
        actionButton.type = 'button';
        actionButton.textContent = action.label;
        actionButton.disabled = action.disabled ?? false;
        actionButton.addEventListener('click', () => {
          popup.dataset.open = 'false';
          options.runAction(action.id);
        });
        popup.append(actionButton);
        buttonMap.set(action.id, actionButton);
      }

      trigger.addEventListener('click', () => {
        const isOpen = popup.dataset.open === 'true';
        closeAllMenus(element);
        if (!isOpen) {
          const rect = trigger.getBoundingClientRect();
          popup.style.top = `${rect.bottom + 6}px`;
          popup.style.left = `${rect.left}px`;
          popup.dataset.open = 'true';
        }
      });

      menuRoot.append(trigger, popup);
      element.append(menuRoot);
    }
  }

  render(options.actions);

  document.addEventListener('click', (event) => {
    if (element.contains(event.target as Node)) {
      return;
    }

    closeAllMenus(element);
  });

  return {
    element,

    updateActions(actions: MenuActionDefinition[]): void {
      render(actions);
    },
  };

}

function closeAllMenus(root: HTMLElement): void {
  const popups = root.querySelectorAll<HTMLElement>('.menu-bar__popup');
  for (const popup of popups) {
    popup.dataset.open = 'false';
  }
}
