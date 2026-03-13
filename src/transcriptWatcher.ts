import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * Watches a Claude Code JSONL transcript file for new lines.
 *
 * Triple-layer strategy for cross-platform reliability:
 *   1. fs.watch()     — fast, event-driven (unreliable on macOS)
 *   2. fs.watchFile() — stat-based polling every 1s (reliable fallback)
 *   3. setInterval()  — 1s safety net
 *
 * All three trigger the same idempotent read. Partial-line buffering
 * handles records split across write boundaries.
 */
export class TranscriptWatcher {
  private readonly path: string;
  private readonly onLine: (line: string) => void;

  private offset = 0;
  private buffer = '';
  private reading = false;

  private fsWatcher: fs.FSWatcher | null = null;
  private pollInterval: ReturnType<typeof setInterval> | null = null;

  constructor(filePath: string, onLine: (line: string) => void) {
    this.path = filePath;
    this.onLine = onLine;
  }

  start(): void {
    // Read any existing content
    this.readNewContent();

    // Layer 1: fs.watch (fast but unreliable on macOS)
    try {
      this.fsWatcher = fs.watch(this.path, () => this.readNewContent());
      this.fsWatcher.on('error', () => {});
    } catch {
      // File might not exist yet — other layers will pick it up
    }

    // Layer 2: fs.watchFile (stat-based, 1s interval)
    fs.watchFile(this.path, { interval: 1000 }, () => this.readNewContent());

    // Layer 3: Manual polling (1s safety net)
    this.pollInterval = setInterval(() => this.readNewContent(), 1000);
  }

  stop(): void {
    this.fsWatcher?.close();
    this.fsWatcher = null;
    fs.unwatchFile(this.path);
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  /**
   * Read bytes appended since last read, split into complete lines.
   * Idempotent: multiple watchers calling this concurrently is safe
   * because the `reading` flag prevents overlapping reads.
   */
  private readNewContent(): void {
    if (this.reading) return;
    this.reading = true;

    try {
      const stat = fs.statSync(this.path);

      // File truncated — reset
      if (stat.size < this.offset) {
        this.offset = 0;
        this.buffer = '';
      }

      if (stat.size <= this.offset) return;

      const fd = fs.openSync(this.path, 'r');
      try {
        const length = stat.size - this.offset;
        const buf = Buffer.alloc(length);
        fs.readSync(fd, buf, 0, length, this.offset);
        this.offset = stat.size;
        this.buffer += buf.toString('utf8');
      } finally {
        fs.closeSync(fd);
      }

      // Emit complete lines; keep incomplete last line in buffer
      const lines = this.buffer.split('\n');
      this.buffer = lines.pop()!;
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed) this.onLine(trimmed);
      }
    } catch {
      // File doesn't exist yet or I/O error — retry on next tick
    } finally {
      this.reading = false;
    }
  }
}

// ── JSONL file locator ───────────────────────────────────────

/**
 * Get the Claude Code project data directory for a workspace path.
 *
 * Claude Code stores data at `~/.claude/projects/<path-with-dashes>/`.
 * The directory name is the absolute workspace path with `/` → `-`.
 */
export function claudeProjectDir(workspacePath: string): string {
  const dirName = workspacePath.replace(/\//g, '-');
  return path.join(os.homedir(), '.claude', 'projects', dirName);
}

/** Build the full JSONL path for a given session ID. */
export function jsonlPath(workspacePath: string, sessionId: string): string {
  return path.join(claudeProjectDir(workspacePath), `${sessionId}.jsonl`);
}
