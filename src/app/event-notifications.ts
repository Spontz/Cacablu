export function shouldOpenEventsForNewError(
  previousErrorRevision: number,
  nextErrorRevision: number,
  eventsPanelOpen: boolean,
): boolean {
  return nextErrorRevision > previousErrorRevision && !eventsPanelOpen;
}

export function hasNewSectionErrors(previousIds: ReadonlySet<number>, nextIds: number[]): boolean {
  return nextIds.some((id) => !previousIds.has(id));
}

export function shouldDeferEventsOpen(projectOpening: boolean, timelineOpen: boolean): boolean {
  return projectOpening && !timelineOpen;
}
