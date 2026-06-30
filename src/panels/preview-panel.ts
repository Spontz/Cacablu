import type { IContentRenderer } from 'dockview-core';

import type { ConnectionController } from '../ws/connection';
import { createContentRenderer } from './base-panel';

export function createPreviewPanel(connection: ConnectionController): IContentRenderer {
  return createContentRenderer((element) => {
      element.className = 'panel panel--preview';
      const frame = document.createElement('div');
      frame.className = 'stream-preview';
      frame.tabIndex = 0;

      const video = document.createElement('video');
      video.className = 'stream-preview__video';
      video.autoplay = true;
      video.muted = true;
      video.playsInline = true;
      video.tabIndex = 0;

      const status = document.createElement('p');
      status.className = 'panel-note stream-preview__note';
      status.textContent = 'Preview unavailable';

      let peer: RTCPeerConnection | null = null;
      let started = false;
      let readyForRemoteCandidates = false;
      let pendingCandidates: RTCIceCandidateInit[] = [];
      let pendingMove: { x: number; y: number } | null = null;
      let moveFrame = 0;
      let keyboardActive = false;

      function setKeyboardActive(active: boolean): void {
        keyboardActive = active;
        if (active) {
          frame.focus({ preventScroll: true });
        }
      }

      function toPhoenixMouseButton(button: number): number {
        if (button === 1) {
          return 2;
        }
        if (button === 2) {
          return 1;
        }
        return 0;
      }

      function toPhoenixKey(event: KeyboardEvent): number | null {
        if (event.code.startsWith('Key') && event.code.length === 4) {
          return event.code.charCodeAt(3);
        }
        if (event.code.startsWith('Digit') && event.code.length === 6) {
          return event.code.charCodeAt(5);
        }
        if (event.code.startsWith('F')) {
          const functionKey = Number.parseInt(event.code.slice(1), 10);
          if (Number.isInteger(functionKey) && functionKey >= 1 && functionKey <= 25) {
            return 289 + functionKey;
          }
        }

        const keyMap: Record<string, number> = {
          Space: 32,
          Apostrophe: 39,
          Comma: 44,
          Minus: 45,
          Period: 46,
          Slash: 47,
          Semicolon: 59,
          Equal: 61,
          BracketLeft: 91,
          Backslash: 92,
          BracketRight: 93,
          Backquote: 96,
          Escape: 256,
          Enter: 257,
          Tab: 258,
          Backspace: 259,
          Insert: 260,
          Delete: 261,
          ArrowRight: 262,
          ArrowLeft: 263,
          ArrowDown: 264,
          ArrowUp: 265,
          PageUp: 266,
          PageDown: 267,
          Home: 268,
          End: 269,
          CapsLock: 280,
          ScrollLock: 281,
          NumLock: 282,
          PrintScreen: 283,
          Pause: 284,
          Numpad0: 320,
          Numpad1: 321,
          Numpad2: 322,
          Numpad3: 323,
          Numpad4: 324,
          Numpad5: 325,
          Numpad6: 326,
          Numpad7: 327,
          Numpad8: 328,
          Numpad9: 329,
          NumpadDecimal: 330,
          NumpadDivide: 331,
          NumpadMultiply: 332,
          NumpadSubtract: 333,
          NumpadAdd: 334,
          NumpadEnter: 335,
          NumpadEqual: 336,
          ShiftLeft: 340,
          ControlLeft: 341,
          AltLeft: 342,
          MetaLeft: 343,
          ShiftRight: 344,
          ControlRight: 345,
          AltRight: 346,
          MetaRight: 347,
          ContextMenu: 348,
        };

        return keyMap[event.code] ?? null;
      }

      function toPhoenixMods(event: KeyboardEvent): number {
        return (event.shiftKey ? 1 : 0) |
          (event.ctrlKey ? 2 : 0) |
          (event.altKey ? 4 : 0) |
          (event.metaKey ? 8 : 0);
      }

      function handleKeyDown(event: KeyboardEvent): void {
        if (!keyboardActive) {
          return;
        }

        const key = toPhoenixKey(event);
        if (key === null) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        connection.send({
          type: 'input.key.down',
          key,
          scancode: 0,
          mods: toPhoenixMods(event),
          repeat: event.repeat,
        });
      }

      function handleKeyUp(event: KeyboardEvent): void {
        if (!keyboardActive) {
          return;
        }

        const key = toPhoenixKey(event);
        if (key === null) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        connection.send({
          type: 'input.key.up',
          key,
          scancode: 0,
          mods: toPhoenixMods(event),
        });
      }

      function getVideoPoint(event: PointerEvent | WheelEvent): { x: number; y: number } | null {
        if (!video.videoWidth || !video.videoHeight) {
          return null;
        }

        const rect = video.getBoundingClientRect();
        const videoAspect = video.videoWidth / video.videoHeight;
        const rectAspect = rect.width / rect.height;
        const renderedWidth = rectAspect > videoAspect ? rect.height * videoAspect : rect.width;
        const renderedHeight = rectAspect > videoAspect ? rect.height : rect.width / videoAspect;
        const offsetX = (rect.width - renderedWidth) / 2;
        const offsetY = (rect.height - renderedHeight) / 2;
        const x = event.clientX - rect.left - offsetX;
        const y = event.clientY - rect.top - offsetY;

        if (x < 0 || y < 0 || x > renderedWidth || y > renderedHeight) {
          return null;
        }

        return {
          x: (x / renderedWidth) * video.videoWidth,
          y: (y / renderedHeight) * video.videoHeight,
        };
      }

      function sendMouseMove(point: { x: number; y: number }): void {
        pendingMove = point;
        if (moveFrame !== 0) {
          return;
        }

        moveFrame = window.requestAnimationFrame(() => {
          moveFrame = 0;
          const move = pendingMove;
          pendingMove = null;
          if (move) {
            connection.send({ type: 'input.mouse.move', x: move.x, y: move.y });
          }
        });
      }

      function handlePointerMove(event: PointerEvent): void {
        const point = getVideoPoint(event);
        if (point) {
          sendMouseMove(point);
        }
      }

      function handlePointerDown(event: PointerEvent): void {
        setKeyboardActive(true);
        const point = getVideoPoint(event);
        if (!point) {
          return;
        }

        event.preventDefault();
        try {
          video.setPointerCapture(event.pointerId);
        } catch {
          // Synthetic pointer events used by tests do not always own a captureable pointer.
        }
        connection.send({ type: 'input.mouse.move', x: point.x, y: point.y });
        connection.send({ type: 'input.mouse.down', x: point.x, y: point.y, button: toPhoenixMouseButton(event.button) });
      }

      function handlePointerUp(event: PointerEvent): void {
        const point = getVideoPoint(event);
        if (!point) {
          return;
        }

        event.preventDefault();
        try {
          if (video.hasPointerCapture(event.pointerId)) {
            video.releasePointerCapture(event.pointerId);
          }
        } catch {
          // Ignore synthetic pointer events that never acquired capture.
        }
        connection.send({ type: 'input.mouse.move', x: point.x, y: point.y });
        connection.send({ type: 'input.mouse.up', x: point.x, y: point.y, button: toPhoenixMouseButton(event.button) });
      }

      function handleWheel(event: WheelEvent): void {
        const point = getVideoPoint(event);
        if (!point) {
          return;
        }

        event.preventDefault();
        const wheelScale = event.deltaMode === WheelEvent.DOM_DELTA_PIXEL ? 100 : 1;
        connection.send({
          type: 'input.mouse.wheel',
          x: point.x,
          y: point.y,
          deltaX: -event.deltaX / wheelScale,
          deltaY: -event.deltaY / wheelScale,
        });
      }

      function handleDocumentPointerDown(event: PointerEvent): void {
        if (!frame.contains(event.target as Node | null)) {
          setKeyboardActive(false);
        }
      }

      function handleDocumentFocusIn(event: FocusEvent): void {
        if (!frame.contains(event.target as Node | null)) {
          keyboardActive = false;
        }
      }

      function handleFramePointerDown(): void {
        setKeyboardActive(true);
      }

      function normalizeLocalCandidateText(candidate: string): string {
        const parts = candidate.split(' ');
        if (parts.length > 4 && parts[4].endsWith('.local')) {
          parts[4] = '127.0.0.1';
          return parts.join(' ');
        }

        return candidate;
      }

      function normalizeLocalSdp(sdp: string): string {
        return sdp
          .split('\r\n')
          .map((line) => line.startsWith('a=candidate:') ? `a=${normalizeLocalCandidateText(line.slice(2))}` : line)
          .join('\r\n');
      }

      async function waitForIceGatheringComplete(peerConnection: RTCPeerConnection): Promise<void> {
        if (peerConnection.iceGatheringState === 'complete') {
          return;
        }

        await new Promise<void>((resolve) => {
          const handleStateChange = (): void => {
            if (peerConnection.iceGatheringState === 'complete') {
              peerConnection.removeEventListener('icegatheringstatechange', handleStateChange);
              resolve();
            }
          };

          peerConnection.addEventListener('icegatheringstatechange', handleStateChange);
        });
      }

      function closePeer(): void {
        started = false;
        if (peer) {
          peer.close();
          peer = null;
        }
        video.srcObject = null;
        readyForRemoteCandidates = false;
        pendingCandidates = [];
      }

      async function startPeer(): Promise<void> {
        if (started || !connection.isConnected()) {
          return;
        }

        started = true;
        readyForRemoteCandidates = false;
        status.textContent = 'Starting WebRTC preview...';
        peer = new RTCPeerConnection();

        peer.addEventListener('track', (event) => {
          const [stream] = event.streams;
          if (stream) {
            video.srcObject = stream;
            status.textContent = '';
          }
        });

        peer.addEventListener('icecandidate', (event) => {
          if (!event.candidate) {
            return;
          }
          // The answer is sent after ICE gathering completes so Phoenix receives
          // browser candidates in the SDP, matching libdatachannel's media-sender flow.
        });

        peer.addEventListener('connectionstatechange', () => {
          if (!peer) {
            return;
          }

          if (peer.connectionState === 'failed' || peer.connectionState === 'closed' || peer.connectionState === 'disconnected') {
            closePeer();
            status.textContent = 'Preview unavailable';
          }
        });

        connection.send({ type: 'webrtc.request' });
      }

      const unsubscribeSignals = connection.subscribeWebRtc((message) => {
        void (async () => {
          if (!peer) {
            return;
          }

          if (message.type === 'webrtc.offer') {
            await peer.setRemoteDescription({ type: 'offer', sdp: message.sdp });
            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);
            await waitForIceGatheringComplete(peer);
            readyForRemoteCandidates = true;
            if (peer.localDescription?.sdp) {
              connection.send({ type: 'webrtc.answer', sessionId: message.sessionId, sdp: normalizeLocalSdp(peer.localDescription.sdp) });
            }
            const candidates = pendingCandidates;
            pendingCandidates = [];
            await Promise.all(candidates.map((candidate) => peer?.addIceCandidate(candidate)));
            return;
          }

          if (message.type === 'webrtc.ice-candidate') {
            const candidate = {
              candidate: message.candidate,
              sdpMid: message.sdpMid,
              sdpMLineIndex: message.sdpMLineIndex,
            };

            if (!readyForRemoteCandidates) {
              pendingCandidates.push(candidate);
              return;
            }

            await peer.addIceCandidate(candidate);
          }
        })().catch(() => {
          closePeer();
          status.textContent = 'Preview unavailable';
        });
      });

      const retryTimer = window.setInterval(() => {
        if (connection.isConnected()) {
          void startPeer().catch(() => {
            closePeer();
            status.textContent = 'Preview unavailable';
          });
        } else if (started) {
          closePeer();
        }
      }, 750);

      frame.append(video, status);
      element.replaceChildren(frame);
      frame.addEventListener('pointerdown', handleFramePointerDown, { capture: true });
      video.addEventListener('pointermove', handlePointerMove);
      video.addEventListener('pointerdown', handlePointerDown);
      video.addEventListener('pointerup', handlePointerUp);
      video.addEventListener('pointercancel', handlePointerUp);
      video.addEventListener('wheel', handleWheel, { passive: false });
      document.addEventListener('keydown', handleKeyDown, { capture: true });
      document.addEventListener('keyup', handleKeyUp, { capture: true });
      document.addEventListener('pointerdown', handleDocumentPointerDown, { capture: true });
      document.addEventListener('focusin', handleDocumentFocusIn, { capture: true });

      return () => {
        window.clearInterval(retryTimer);
        if (moveFrame !== 0) {
          window.cancelAnimationFrame(moveFrame);
        }
        video.removeEventListener('pointermove', handlePointerMove);
        frame.removeEventListener('pointerdown', handleFramePointerDown, { capture: true });
        video.removeEventListener('pointerdown', handlePointerDown);
        video.removeEventListener('pointerup', handlePointerUp);
        video.removeEventListener('pointercancel', handlePointerUp);
        video.removeEventListener('wheel', handleWheel);
        document.removeEventListener('keydown', handleKeyDown, { capture: true });
        document.removeEventListener('keyup', handleKeyUp, { capture: true });
        document.removeEventListener('pointerdown', handleDocumentPointerDown, { capture: true });
        document.removeEventListener('focusin', handleDocumentFocusIn, { capture: true });
        unsubscribeSignals();
        closePeer();
      };
  });
}
