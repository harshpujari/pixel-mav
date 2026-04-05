// ── Audio engine ────────────────────────────────────────────
// Plays click.wav for spawn, idle (turn complete), and chime events.
// Reads soundEnabled + volume from settingsStore.
// AudioContext is created lazily on first user gesture.

import { settings } from '../../settingsStore.ts';

let ctx: AudioContext | null = null;
let clickBuffer: AudioBuffer | null = null;
let loadAttempted = false;
let loadFailed = false;

/** Resolve the audio file path relative to the webview base URL */
function audioUrl(file: string): string {
  const base = document.baseURI || '';
  return new URL(`audio/${file}`, base).href;
}

/** Lazily create AudioContext + load the click sample */
async function ensureContext(): Promise<AudioContext | null> {
  if (ctx && clickBuffer) return ctx;
  if (loadFailed) return null;

  if (!ctx) {
    try {
      ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (err) {
      console.warn('Pixel Mav: AudioContext not supported', err);
      loadFailed = true;
      return null;
    }
  }

  if (ctx.state === 'suspended') {
    await ctx.resume().catch(() => {});
  }

  if (!clickBuffer && !loadAttempted) {
    loadAttempted = true;
    try {
      const url = audioUrl('click.wav');
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      const arrayBuf = await res.arrayBuffer();
      clickBuffer = await ctx.decodeAudioData(arrayBuf);
      console.log('Pixel Mav: Audio assets loaded');
    } catch (err) {
      console.warn('Pixel Mav: Failed to load audio assets. Sounds will be disabled.', err);
      loadFailed = true;
      return null;
    }
  }

  return ctx;
}

/** Play the click sound with optional playback rate and volume multiplier */
function playClick(rate = 1, volumeMult = 1): void {
  if (!settings.soundEnabled || loadFailed) return;

  ensureContext().then(audioCtx => {
    if (!audioCtx || !clickBuffer) return;

    try {
      const source = audioCtx.createBufferSource();
      source.buffer = clickBuffer;
      source.playbackRate.value = rate;

      const gain = audioCtx.createGain();
      gain.gain.value = Math.max(0, Math.min(1, settings.volume * volumeMult));

      source.connect(gain);
      gain.connect(audioCtx.destination);
      source.start();
    } catch (err) {
      console.warn('Pixel Mav: Error playing sound', err);
    }
  });
}

// ── Public API ──────────────────────────────────────────────

/** Mew sound — played on cat spawn */
export function playMew(): void {
  playClick(1.4, 0.7);
}

/** Purr/click sound — played when agent goes idle (turn complete) */
export function playPurr(): void {
  playClick(0.8, 0.5);
}

/** Chime sound — played on turn complete / agent active */
export function playChime(): void {
  playClick(1.2, 0.6);
}

/**
 * Warm up the AudioContext on first user interaction.
 * Call this from a click/keydown handler to satisfy browser autoplay policy.
 */
export function warmUpAudio(): void {
  ensureContext().catch(() => {});
}
