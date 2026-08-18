const RESOURCE_DRAG_SOURCE_ID = crypto.randomUUID();
const sessionIds = new WeakMap<object, string>();

export interface ResourceDragOrigin {
  sourceId?: string;
  sourceSessionId?: string;
}

export function getResourceDragOrigin(session: object): Required<ResourceDragOrigin> {
  let sourceSessionId = sessionIds.get(session);
  if (!sourceSessionId) {
    sourceSessionId = crypto.randomUUID();
    sessionIds.set(session, sourceSessionId);
  }
  return {
    sourceId: RESOURCE_DRAG_SOURCE_ID,
    sourceSessionId,
  };
}

export function isResourceDragFromSession(origin: ResourceDragOrigin, session: object): boolean {
  const current = getResourceDragOrigin(session);
  return origin.sourceId === current.sourceId && origin.sourceSessionId === current.sourceSessionId;
}
