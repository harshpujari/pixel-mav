// ── Settings state (webview-side) ───────────────────────────
// Persisted by the extension via globalState. The webview receives
// the initial values in a `settingsLoaded` message and sends
// mutations back via postMessage.

import { postMessage } from './vscodeApi.ts';

export const settings = {
  soundEnabled: true,
  volume: 0.5, // 0–1
};

// ── Subscription (for React) ────────────────────────────────

type Listener = () => void;
const listeners: Listener[] = [];
let version = 0;

export function subscribeSettings(fn: Listener): () => void {
  listeners.push(fn);
  return () => {
    const i = listeners.indexOf(fn);
    if (i >= 0) listeners.splice(i, 1);
  };
}

export function getSettingsVersion(): number {
  return version;
}

function notify(): void {
  version++;
  for (const fn of listeners) fn();
}

// ── Mutators (notify React + persist to extension) ──────────

export function setSoundEnabled(enabled: boolean): void {
  settings.soundEnabled = enabled;
  postMessage({ type: 'setSoundEnabled', enabled });
  notify();
}

export function setVolume(vol: number): void {
  settings.volume = Math.max(0, Math.min(1, vol));
  postMessage({ type: 'setVolume', volume: settings.volume });
  notify();
}

// ── Load from extension message ─────────────────────────────

export function applySettingsLoaded(msg: Record<string, unknown>): void {
  if (typeof msg.soundEnabled === 'boolean') {
    settings.soundEnabled = msg.soundEnabled;
  }
  if (typeof msg.volume === 'number') {
    settings.volume = msg.volume;
  }
  notify();
}
