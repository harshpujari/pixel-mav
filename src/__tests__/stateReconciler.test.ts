import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StateReconciler, toolToCatState } from '../stateReconciler.js';
import type { ReconciledState, TranscriptEvent } from '../types.js';

describe('StateReconciler', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function makeReconciler() {
    const states: ReconciledState[] = [];
    const reconciler = new StateReconciler((s) => states.push({ ...s }));
    return { reconciler, states };
  }

  it('emits active when tool_start is pushed', () => {
    const { reconciler, states } = makeReconciler();
    reconciler.push([{ kind: 'tool_start', toolId: '1', toolName: 'Write' }]);
    vi.advanceTimersByTime(300); // past 200ms reconcile window
    expect(states.length).toBe(1);
    expect(states[0]).toEqual({ status: 'active', activeTool: 'Write' });
    reconciler.dispose();
  });

  it('emits idle on turn_end', () => {
    const { reconciler, states } = makeReconciler();
    reconciler.push([{ kind: 'tool_start', toolId: '1', toolName: 'Read' }]);
    vi.advanceTimersByTime(300);
    reconciler.push([{ kind: 'turn_end', durationMs: 1000 }]);
    vi.advanceTimersByTime(300);
    expect(states[states.length - 1]).toEqual({ status: 'idle', activeTool: null });
    reconciler.dispose();
  });

  it('emits idle after 5s silence with no active tools', () => {
    const { reconciler, states } = makeReconciler();
    // Push a tool start + result to get to "no active tools" state
    reconciler.push([
      { kind: 'tool_start', toolId: '1', toolName: 'Read' },
    ]);
    vi.advanceTimersByTime(300);
    reconciler.push([
      { kind: 'tool_result', toolId: '1' },
    ]);
    vi.advanceTimersByTime(300);
    // Now advance 5s silence
    vi.advanceTimersByTime(5000);
    expect(states[states.length - 1]).toEqual({ status: 'idle', activeTool: null });
    reconciler.dispose();
  });

  it('emits waiting after 7s silence with non-exempt tool', () => {
    const { reconciler, states } = makeReconciler();
    reconciler.push([{ kind: 'tool_start', toolId: '1', toolName: 'Bash' }]);
    vi.advanceTimersByTime(300); // reconcile
    vi.advanceTimersByTime(7000); // 7s silence
    expect(states[states.length - 1].status).toBe('waiting');
    reconciler.dispose();
  });

  it('does NOT emit waiting for exempt tools (Task, Agent)', () => {
    const { reconciler, states } = makeReconciler();
    reconciler.push([{ kind: 'tool_start', toolId: '1', toolName: 'Task' }]);
    vi.advanceTimersByTime(300);
    vi.advanceTimersByTime(10000);
    // Should still be active, no waiting
    expect(states.every(s => s.status !== 'waiting')).toBe(true);
    reconciler.dispose();
  });

  it('emits waiting immediately for AskUserQuestion', () => {
    const { reconciler, states } = makeReconciler();
    reconciler.push([{ kind: 'tool_start', toolId: '1', toolName: 'AskUserQuestion' }]);
    vi.advanceTimersByTime(300);
    expect(states[states.length - 1]).toEqual({ status: 'waiting', activeTool: 'AskUserQuestion' });
    reconciler.dispose();
  });

  it('does not emit duplicate states', () => {
    const { reconciler, states } = makeReconciler();
    reconciler.push([{ kind: 'tool_start', toolId: '1', toolName: 'Write' }]);
    vi.advanceTimersByTime(300);
    // Push same tool again (shouldn't emit duplicate)
    reconciler.push([{ kind: 'tool_start', toolId: '2', toolName: 'Write' }]);
    vi.advanceTimersByTime(300);
    // Should still be active with Write — only 1 emission since activeTool is the same
    // (second emission has toolId 2 as last, but toolName is still Write)
    expect(states.filter(s => s.status === 'active').length).toBeLessThanOrEqual(1);
    reconciler.dispose();
  });

  it('coalesces rapid events within 200ms window', () => {
    const { reconciler, states } = makeReconciler();
    // Rapid fire: start + result within same reconcile window
    reconciler.push([
      { kind: 'tool_start', toolId: '1', toolName: 'Read' },
    ]);
    // Push result before the 200ms reconcile fires
    vi.advanceTimersByTime(100);
    reconciler.push([
      { kind: 'tool_result', toolId: '1' },
    ]);
    vi.advanceTimersByTime(200);
    // The tool started and ended within the window — no "active" should be emitted
    // (activeTools is empty after reconcile)
    expect(states.filter(s => s.status === 'active').length).toBe(0);
    reconciler.dispose();
  });

  it('tracks multiple concurrent tools', () => {
    const { reconciler, states } = makeReconciler();
    reconciler.push([
      { kind: 'tool_start', toolId: '1', toolName: 'Read' },
      { kind: 'tool_start', toolId: '2', toolName: 'Write' },
    ]);
    vi.advanceTimersByTime(300);
    expect(states[states.length - 1].status).toBe('active');
    // Complete one tool — still active with the other
    reconciler.push([{ kind: 'tool_result', toolId: '1' }]);
    vi.advanceTimersByTime(300);
    expect(states[states.length - 1].status).toBe('active');
    expect(states[states.length - 1].activeTool).toBe('Write');
    reconciler.dispose();
  });

  it('resets inactivity timer on new data', () => {
    const { reconciler, states } = makeReconciler();
    reconciler.push([{ kind: 'tool_start', toolId: '1', toolName: 'Bash' }]);
    vi.advanceTimersByTime(300);
    // Advance 6s (just under 7s permission threshold)
    vi.advanceTimersByTime(6000);
    // Push new data — should reset the timer
    reconciler.push([]);
    vi.advanceTimersByTime(6000);
    // Only 6s since last data — should NOT be waiting yet
    const waitingStates = states.filter(s => s.status === 'waiting');
    expect(waitingStates.length).toBe(0);
    reconciler.dispose();
  });

  it('forwards events to onEvent callback', () => {
    const events: TranscriptEvent[] = [];
    const reconciler = new StateReconciler(() => {}, (e) => events.push(e));
    const toolStart: TranscriptEvent = { kind: 'tool_start', toolId: '1', toolName: 'Read' };
    reconciler.push([toolStart]);
    expect(events).toEqual([toolStart]);
    reconciler.dispose();
  });
});

describe('toolToCatState', () => {
  it('maps reading tools to read', () => {
    expect(toolToCatState('Read')).toBe('read');
    expect(toolToCatState('Grep')).toBe('read');
    expect(toolToCatState('Glob')).toBe('read');
    expect(toolToCatState('WebFetch')).toBe('read');
    expect(toolToCatState('WebSearch')).toBe('read');
  });

  it('maps typing tools to type', () => {
    expect(toolToCatState('Write')).toBe('type');
    expect(toolToCatState('Edit')).toBe('type');
    expect(toolToCatState('Bash')).toBe('type');
    expect(toolToCatState('Task')).toBe('type');
    expect(toolToCatState('NotebookEdit')).toBe('type');
    expect(toolToCatState('Agent')).toBe('type');
  });

  it('maps AskUserQuestion to wait', () => {
    expect(toolToCatState('AskUserQuestion')).toBe('wait');
  });

  it('defaults unknown tools to type', () => {
    expect(toolToCatState('SomeNewTool')).toBe('type');
  });
});
