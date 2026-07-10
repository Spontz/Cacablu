import type { IContentRenderer } from 'dockview-core';

import type { UndoManager } from '../app/undo-manager';
import type { DbMarker } from '../db/db-schema';
import type { DbSessionRef } from '../db/db-session';
import type { DbState } from '../state/db-state';
import { createContentRenderer } from './base-panel';

export function createMarkersPanel(
  dbState: DbState,
  sessionRef: DbSessionRef,
  undoManager: UndoManager,
): IContentRenderer {
  return createContentRenderer((element) => {
    element.className = 'panel panel--markers';

    const header = document.createElement('div');
    header.className = 'markers-panel__header';
    header.innerHTML = '<span>Label</span><span>Time</span>';

    const list = document.createElement('div');
    list.className = 'markers-panel__list';
    element.replaceChildren(header, list);

    function render(): void {
      const markers = [...(sessionRef.current?.data.markers ?? [])].sort(compareMarkers);
      list.replaceChildren();

      if (markers.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'markers-panel__empty';
        empty.textContent = 'No markers.';
        list.append(empty);
        return;
      }

      for (const marker of markers) {
        list.append(createMarkerRow(marker));
      }
    }

    function createMarkerRow(marker: DbMarker): HTMLElement {
      const row = document.createElement('div');
      row.className = 'markers-panel__row';

      const label = document.createElement('input');
      label.className = 'markers-panel__input';
      label.value = marker.label;
      label.setAttribute('aria-label', `Marker ${marker.id} label`);
      attachCommitHandlers(label, () => commitLabel(marker.id, label.value));

      const time = document.createElement('input');
      time.className = 'markers-panel__input markers-panel__input--time';
      time.value = formatMarkerTime(marker.time);
      time.setAttribute('aria-label', `Marker ${marker.id} time`);
      attachCommitHandlers(time, () => {
        const parsed = Number.parseFloat(time.value.trim());
        if (!Number.isFinite(parsed)) {
          time.value = formatMarkerTime(findMarker(marker.id)?.time ?? marker.time);
          time.classList.add('is-invalid');
          window.setTimeout(() => time.classList.remove('is-invalid'), 900);
          return;
        }
        commitTime(marker.id, parsed);
      });

      row.append(label, time);
      return row;
    }

    function commitLabel(markerId: number, nextLabel: string): void {
      const marker = findMarker(markerId);
      const session = sessionRef.current;
      if (!marker || !session || marker.label === nextLabel) return;

      const previous = { ...marker };
      session.updateTimelineMarker(markerId, { label: nextLabel });
      dbState.setDirty();
      undoManager.push({
        label: `Rename marker ${markerId}`,
        undo: async () => {
          const current = findMarker(markerId);
          if (!current || !sessionRef.current) return;
          sessionRef.current.updateTimelineMarker(markerId, { label: previous.label, time: previous.time });
          dbState.setDirty();
          notifyMarkersChanged();
          render();
        },
      });
      notifyMarkersChanged();
      render();
    }

    function commitTime(markerId: number, nextTime: number): void {
      const marker = findMarker(markerId);
      const session = sessionRef.current;
      if (!marker || !session || marker.time === nextTime) return;

      const previous = { ...marker };
      session.updateTimelineMarker(markerId, { time: nextTime });
      dbState.setDirty();
      undoManager.push({
        label: `Edit marker ${markerId}`,
        undo: async () => {
          const current = findMarker(markerId);
          if (!current || !sessionRef.current) return;
          sessionRef.current.updateTimelineMarker(markerId, { label: previous.label, time: previous.time });
          dbState.setDirty();
          notifyMarkersChanged();
          render();
        },
      });
      notifyMarkersChanged();
      render();
    }

    function findMarker(markerId: number): DbMarker | null {
      return sessionRef.current?.data.markers.find((marker) => marker.id === markerId) ?? null;
    }

    const handleMarkersChanged = (): void => render();
    window.addEventListener('cacablu:timeline-markers-changed', handleMarkersChanged);
    render();

    return () => {
      window.removeEventListener('cacablu:timeline-markers-changed', handleMarkersChanged);
    };
  });
}

function attachCommitHandlers(input: HTMLInputElement, commit: () => void): void {
  input.addEventListener('blur', commit);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      input.blur();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      input.blur();
    }
  });
}

function notifyMarkersChanged(): void {
  window.dispatchEvent(new CustomEvent('cacablu:timeline-markers-changed'));
}

function compareMarkers(left: DbMarker, right: DbMarker): number {
  return left.time - right.time || left.id - right.id;
}

function formatMarkerTime(value: number): string {
  return Number.isFinite(value) ? Number.parseFloat(value.toFixed(3)).toString() : '';
}
