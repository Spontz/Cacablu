export interface PanelVisibilityController {
  openPanel(panelId: string): void;
  closePanel(panelId: string): void;
  isPanelOpen(panelId: string): boolean;
}

export function togglePanelVisibility(workspace: PanelVisibilityController, panelId: string): void {
  if (workspace.isPanelOpen(panelId)) {
    workspace.closePanel(panelId);
    return;
  }

  workspace.openPanel(panelId);
}
