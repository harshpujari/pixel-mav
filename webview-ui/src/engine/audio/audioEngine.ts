// ── Audio engine ────────────────────────────────────────────
// Plays click.wav for spawn, idle (turn complete), and chime events.
// Reads soundEnabled + volume from settingsStore.
// AudioContext is created lazily on first user gesture.

import { settings } from '../../settingsStore.ts';

let ctx: AudioContext | null = null;
let clickBuffer: AudioBuffer | null = null;
let loaded = false;

/** Resolve the audio file path relative to the webview base URL */
function audioUrl(file: string): string {
  // In the built webview, assets live alongside index.html under dist/webview/
  // Vite copies public/ contents to the output root, so audio/ is at ./audio/
  const base = document.baseURI || '';
  return new URL(`audio/${file}`, base).href;
}

/** Lazily create AudioContext + load the click sample */
async function ensureContext(): Promise<AudioContext | null> {
  if (ctx && loaded) return ctx;

  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      return null; // no audio support
    }
  }

  if (ctx.state === 'suspended') {
    await ctx.resume().catch(() => {});
  }

  if (!loaded) {
    try {
      const res = await fetch(audioUrl('click.wav'));
      const arrayBuf = await res.arrayBuffer();
      clickBuffer = await ctx.decodeAudioData(arrayBuf);
      loaded = true;
    } catch {
      // audio file missing or decode failed — degrade silently
      return null;
    }
  }

  return ctx;
}

/** Play the click sound with optional playback rate and volume multiplier */
function playClick(rate = 1, volumeMult = 1): void {
  if (!settings.soundEnabled) return;

  ensureContext().then(audioCtx => {
    if (!audioCtx || !clickBuffer) return;

    const source = audioCtx.createBufferSource();
    source.buffer = clickBuffer;
    source.playbackRate.value = rate;

    const gain = audioCtx.createGain();
    gain.gain.value = settings.volume * volumeMult;

    source.connect(gain);
    gain.connect(audioCtx.destination);
    source.start();
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
  ensureContext();
}
