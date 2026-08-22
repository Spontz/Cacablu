export type ProjectRevertChoice = 'discard' | 'cancel';

export type ConfirmProjectRevert = (message: string) => boolean;

export function confirmProjectRevert(
  isDirty: boolean,
  confirm: ConfirmProjectRevert,
): ProjectRevertChoice {
  if (!isDirty) {
    return confirm('Reload the last saved version of this project?') ? 'discard' : 'cancel';
  }

  return confirm('Discard all unsaved changes and reload the last saved version?')
    ? 'discard'
    : 'cancel';
}
