import { createAppShell } from './shell';

export function bootstrapApp(root: HTMLElement): void {
  const shell = createAppShell(root);
  shell.mount();
}
