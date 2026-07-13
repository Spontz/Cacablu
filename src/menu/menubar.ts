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

  const menuNames = ['File', 'Edit', 'Timeline', 'Panels'] as const;
  const buttonMap = new Map<string, HTMLButtonElement>();
  const isMac = /\b(Mac|iPhone|iPad|iPod)\b/i.test(navigator.platform);

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
        if (action.separator) {
          const separator = document.createElement('div');
          separator.className = 'menu-bar__separator';
          separator.setAttribute('role', 'separator');
          popup.append(separator);
          continue;
        }

        const actionButton = document.createElement('button');
        actionButton.className = 'menu-bar__item';
        actionButton.type = 'button';
        actionButton.disabled = action.disabled ?? false;

        const label = document.createElement('span');
        label.className = 'menu-bar__item-label';
        label.textContent = action.label;
        actionButton.append(label);

        const shortcut = getShortcutLabel(action, isMac);
        if (shortcut) {
          const shortcutLabel = document.createElement('kbd');
          shortcutLabel.className = 'menu-bar__shortcut';
          shortcutLabel.textContent = shortcut;
          actionButton.append(shortcutLabel);
        }

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

function getShortcutLabel(action: MenuActionDefinition, isMac: boolean): string {
  if (!action.shortcut) return '';
  return isMac && action.shortcut.mac ? action.shortcut.mac : action.shortcut.default;
}

function closeAllMenus(root: HTMLElement): void {
  const popups = root.querySelectorAll<HTMLElement>('.menu-bar__popup');
  for (const popup of popups) {
    popup.dataset.open = 'false';
  }
}
