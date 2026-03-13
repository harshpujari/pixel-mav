import type { TranscriptEvent } from './types.js';

/**
 * Parse a single JSONL line into zero or more TranscriptEvents.
 *
 * Claude Code JSONL records have this structure:
 *   { type: 'assistant', message: { content: [{ type: 'tool_use', id, name, ... }] } }
 *   { type: 'user',      message: { content: [{ type: 'tool_result', tool_use_id }] } }
 *   { type: 'system', subtype: 'turn_duration', durationMs: number }
 *
 * Malformed or unrecognised lines are silently skipped (returns []).
 */
export function parseLine(line: string): TranscriptEvent[] {
  let record: Record<string, unknown>;
  try {
    record = JSON.parse(line);
  } catch {
    return [];
  }

  if (!record || typeof record !== 'object') return [];

  const events: TranscriptEvent[] = [];
  const content = getContentBlocks(record);

  if (record.type === 'assistant' && content) {
    for (const block of content) {
      if (
        block.type === 'tool_use' &&
        typeof block.id === 'string' &&
        typeof block.name === 'string'
      ) {
        events.push({ kind: 'tool_start', toolId: block.id, toolName: block.name });
      }
    }
  }

  if ((record.type === 'user' || record.type === 'human') && content) {
    for (const block of content) {
      if (block.type === 'tool_result' && typeof block.tool_use_id === 'string') {
        events.push({ kind: 'tool_result', toolId: block.tool_use_id });
      }
    }
  }

  if (record.type === 'system' && record.subtype === 'turn_duration') {
    const ms = typeof record.durationMs === 'number' ? record.durationMs : 0;
    events.push({ kind: 'turn_end', durationMs: ms });
  }

  return events;
}

/** Extract content blocks from a JSONL record, handling nested message wrapper. */
function getContentBlocks(record: Record<string, unknown>): Array<Record<string, unknown>> | null {
  // Nested: { message: { content: [...] } }
  const msg = record.message as Record<string, unknown> | undefined;
  if (msg && Array.isArray(msg.content)) return msg.content;
  // Direct: { content: [...] }
  if (Array.isArray(record.content)) return record.content;
  return null;
}
