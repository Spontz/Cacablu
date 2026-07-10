import '@mantine/core/styles.css';

import type { IContentRenderer } from 'dockview-core';
import { Combobox, MantineProvider, NumberInput, ScrollArea, Text, TextInput, useCombobox } from '@mantine/core';
import { createRoot, type Root } from 'react-dom/client';
import { useEffect, useMemo, useState } from 'react';

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
  let root: Root | null = null;

  return createContentRenderer((element) => {
    element.className = 'panel panel--markers';
    root = createRoot(element);
    root.render(
      <MantineProvider>
        <MarkersPanelView dbState={dbState} sessionRef={sessionRef} undoManager={undoManager} />
      </MantineProvider>,
    );

    return () => {
      root?.unmount();
      root = null;
    };
  });
}

interface MarkersPanelViewProps {
  dbState: DbState;
  sessionRef: DbSessionRef;
  undoManager: UndoManager;
}

function MarkersPanelView({ dbState, sessionRef, undoManager }: MarkersPanelViewProps) {
  const combobox = useCombobox();
  const [revision, setRevision] = useState(0);
  const [selectedMarkerId, setSelectedMarkerId] = useState<number | null>(null);
  const [query, setQuery] = useState('');

  const markers = useMemo(
    () => [...(sessionRef.current?.data.markers ?? [])].sort(compareMarkers),
    [revision, sessionRef],
  );
  const filteredMarkers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return markers;
    return markers.filter((marker) => (
      marker.label.toLowerCase().includes(normalizedQuery)
      || String(marker.id).includes(normalizedQuery)
      || formatMarkerTime(marker.time).includes(normalizedQuery)
    ));
  }, [markers, query]);
  const selectedMarker = selectedMarkerId === null
    ? null
    : markers.find((marker) => marker.id === selectedMarkerId) ?? null;

  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1);
    const handleMarkerSelection = (event: Event) => {
      const detail = event instanceof CustomEvent ? event.detail as { markerId?: unknown } : null;
      const markerId = typeof detail?.markerId === 'number' && Number.isFinite(detail.markerId)
        ? detail.markerId
        : null;
      if (markerId === null || !findMarker(sessionRef, markerId)) return;
      setSelectedMarkerId(markerId);
      setQuery('');
      window.setTimeout(() => {
        document.querySelector<HTMLElement>(`[data-marker-option-id="${CSS.escape(String(markerId))}"]`)
          ?.scrollIntoView({ block: 'nearest' });
        document.querySelector<HTMLInputElement>('.markers-panel__editor input')?.focus();
      });
    };

    window.addEventListener('cacablu:timeline-markers-changed', refresh);
    window.addEventListener('cacablu:markers-panel-select', handleMarkerSelection);
    return () => {
      window.removeEventListener('cacablu:timeline-markers-changed', refresh);
      window.removeEventListener('cacablu:markers-panel-select', handleMarkerSelection);
    };
  }, [sessionRef]);

  useEffect(() => {
    if (selectedMarkerId !== null && !markers.some((marker) => marker.id === selectedMarkerId)) {
      setSelectedMarkerId(null);
    }
  }, [markers, selectedMarkerId]);

  function refresh(): void {
    setRevision((value) => value + 1);
  }

  function selectMarker(value: string): void {
    const markerId = Number(value);
    if (!Number.isInteger(markerId)) return;
    setSelectedMarkerId(markerId);
  }

  function commitLabel(markerId: number, nextLabel: string): void {
    const marker = findMarker(sessionRef, markerId);
    const session = sessionRef.current;
    if (!marker || !session || marker.label === nextLabel) return;

    const previous = { ...marker };
    session.updateTimelineMarker(markerId, { label: nextLabel });
    dbState.setDirty();
    undoManager.push({
      label: `Rename marker ${markerId}`,
      undo: async () => {
        if (!sessionRef.current || !findMarker(sessionRef, markerId)) return;
        sessionRef.current.updateTimelineMarker(markerId, { label: previous.label, time: previous.time });
        dbState.setDirty();
        notifyMarkersChanged();
        refresh();
      },
    });
    notifyMarkersChanged();
    refresh();
  }

  function commitTime(markerId: number, nextTime: number | string): void {
    const parsedTime = typeof nextTime === 'number' ? nextTime : Number.parseFloat(nextTime);
    const marker = findMarker(sessionRef, markerId);
    const session = sessionRef.current;
    if (!marker || !session || !Number.isFinite(parsedTime) || marker.time === parsedTime) return;

    const previous = { ...marker };
    session.updateTimelineMarker(markerId, { time: parsedTime });
    dbState.setDirty();
    undoManager.push({
      label: `Edit marker ${markerId}`,
      undo: async () => {
        if (!sessionRef.current || !findMarker(sessionRef, markerId)) return;
        sessionRef.current.updateTimelineMarker(markerId, { label: previous.label, time: previous.time });
        dbState.setDirty();
        notifyMarkersChanged();
        refresh();
      },
    });
    notifyMarkersChanged();
    refresh();
  }

  return (
    <section className="markers-panel">
      <TextInput
        className="markers-panel__search"
        value={query}
        onChange={(event) => setQuery(event.currentTarget.value)}
        placeholder="Search markers"
        size="xs"
      />

      <Combobox store={combobox} onOptionSubmit={selectMarker}>
        <Combobox.Options className="markers-panel__listbox" aria-label="Markers">
          <ScrollArea.Autosize mah="100%" type="auto">
            {filteredMarkers.length === 0 ? (
              <Combobox.Empty>No markers.</Combobox.Empty>
            ) : (
              filteredMarkers.map((marker) => (
                <Combobox.Option
                  active={marker.id === selectedMarkerId}
                  className="markers-panel__option"
                  data-marker-option-id={marker.id}
                  key={marker.id}
                  value={String(marker.id)}
                >
                  <span className="markers-panel__option-label">
                    {marker.label.trim() || `Marker ${marker.id}`}
                  </span>
                  <span className="markers-panel__option-time">{formatMarkerTime(marker.time)}s</span>
                </Combobox.Option>
              ))
            )}
          </ScrollArea.Autosize>
        </Combobox.Options>
      </Combobox>

      <div className="markers-panel__editor">
        {selectedMarker ? (
          <>
            <TextInput
              key={`label-${selectedMarker.id}-${selectedMarker.label}`}
              defaultValue={selectedMarker.label}
              label="Label"
              onBlur={(event) => commitLabel(selectedMarker.id, event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur();
              }}
              size="xs"
            />
            <NumberInput
              key={`time-${selectedMarker.id}-${selectedMarker.time}`}
              defaultValue={selectedMarker.time}
              label="Time"
              min={0}
              onBlur={(event) => commitTime(selectedMarker.id, event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur();
              }}
              size="xs"
              step={0.1}
            />
          </>
        ) : (
          <Text className="markers-panel__empty" size="xs">Select a marker.</Text>
        )}
      </div>
    </section>
  );
}

function findMarker(sessionRef: DbSessionRef, markerId: number): DbMarker | null {
  return sessionRef.current?.data.markers.find((marker) => marker.id === markerId) ?? null;
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
