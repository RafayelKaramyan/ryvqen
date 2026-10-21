import { useSyncExternalStore } from 'react';
import { DeskStore, STORAGE_KEY } from './store';
import type { FeedCommand } from './model';
const port = {
  getItem: (key: string) => window.localStorage.getItem(key),
  setItem: (key: string, value: string) => window.localStorage.setItem(key, value),
};
function workspaceId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  // Keep local HTTP previews usable; randomUUID itself requires a secure context.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export const desk = new DeskStore({
  storage: port,
  id: workspaceId,
  now: () => Date.now(),
  ...(navigator.locks
    ? {
        lock: async <T>(work: () => Promise<T>): Promise<T> =>
          await navigator.locks.request(STORAGE_KEY, work),
      }
    : {}),
});
export const useDesk = () => useSyncExternalStore(desk.subscribe, desk.getSnapshot);
export const websocketMode = Boolean(import.meta.env.VITE_FEED_URL);

export function connectFeed(): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) desk.refresh();
  };
  window.addEventListener('storage', onStorage);
  let close: () => void;
  if (!websocketMode) {
    const worker = new Worker(new URL('./feed.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<unknown>) => desk.receive(event.data);
    worker.onerror = () => desk.connection('disconnected');
    desk.send = (command: FeedCommand) => worker.postMessage(command);
    close = () => worker.terminate();
  } else {
    let socket: WebSocket | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    let paused = false;
    let attempts = 0;
    const closeSocket = () => {
      const old = socket;
      socket = undefined;
      if (old) {
        old.onclose = null;
        old.onmessage = null;
        old.onerror = null;
        old.close();
      }
    };
    const open = () => {
      if (stopped || paused) return;
      clearTimeout(retry);
      closeSocket();
      desk.connection('connecting');
      try {
        socket = new WebSocket(String(import.meta.env.VITE_FEED_URL));
      } catch {
        desk.connection('disconnected');
        return;
      }
      socket.onmessage = (event) => {
        try {
          desk.receive(JSON.parse(String(event.data)));
          attempts = 0;
        } catch {
          desk.receive(null);
        }
      };
      socket.onclose = () => {
        if (stopped || paused) return;
        socket = undefined;
        desk.connection('disconnected');
        retry = setTimeout(open, Math.min(16000, 1000 * 2 ** attempts++));
      };
      socket.onerror = () => socket?.close();
    };
    desk.send = (command) => {
      if (command.type === 'pause') {
        paused = true;
        clearTimeout(retry);
        closeSocket();
      } else if (command.type === 'resume') {
        paused = false;
        open();
      } else if (command.type === 'snapshot' && socket?.readyState === WebSocket.OPEN)
        socket.send(JSON.stringify(command));
    };
    open();
    close = () => {
      stopped = true;
      clearTimeout(retry);
      closeSocket();
    };
  }
  let recoveryAt = 0;
  const watchdog = setInterval(() => {
    const state = desk.getSnapshot().stream;
    const now = Date.now();
    if (state.connection === 'connected' && now - state.lastReceivedAt > 7500) {
      recoveryAt = now;
      desk.control('snapshot');
    } else if (recoveryAt && state.connection === 'connecting' && now - recoveryAt > 7500) {
      recoveryAt = 0;
      desk.control('resume');
    }
  }, 1000);
  return () => {
    clearInterval(watchdog);
    close();
    desk.send = undefined;
    window.removeEventListener('storage', onStorage);
  };
}

export function downloadFile(name: string, value: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([value], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
