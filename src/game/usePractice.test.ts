/**
 * usePractice.test.ts — integration tests for the practice hook.
 *
 * Verifies the acceptance criteria end-to-end through the real window keyboard
 * wiring: drills are selectable, i/a/I/A/o/O enter insert mode, typing is
 * tracked, and ESC exits insert mode to complete a drill.
 */

import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { usePractice } from '@/game/usePractice';

/** Dispatch a real keydown on window, inside act so state flushes. */
function press(key: string): void {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, cancelable: true, bubbles: true }));
  });
}

describe('usePractice', () => {
  it('starts on the menu with drills available', () => {
    const { result } = renderHook(() => usePractice());
    expect(result.current.activeDrill).toBeNull();
    expect(result.current.drills.length).toBeGreaterThan(0);
  });

  it('runs the i-drill end to end via the keyboard', () => {
    const { result } = renderHook(() => usePractice());

    act(() => result.current.selectDrill('i'));
    expect(result.current.activeDrill?.id).toBe('i');
    expect(result.current.lines).toEqual(['ello']);
    expect(result.current.mode).toBe('normal');

    press('i');
    expect(result.current.mode).toBe('insert');

    press('H');
    expect(result.current.lines).toEqual(['Hello']);
    expect(result.current.typed).toBe(1);
    expect(result.current.completed).toBe(false); // still in insert mode — ESC required

    press('Escape');
    expect(result.current.mode).toBe('normal');
    expect(result.current.completed).toBe(true);
  });

  it('tracks every character typed in insert mode', () => {
    const { result } = renderHook(() => usePractice());
    act(() => result.current.selectDrill('o'));
    press('o');
    'line two'.split('').forEach(press);
    expect(result.current.typed).toBe('line two'.length);
    expect(result.current.lines).toEqual(['line one', 'line two']);
  });

  it('freezes input once the drill is complete', () => {
    const { result } = renderHook(() => usePractice());
    act(() => result.current.selectDrill('a'));
    press('a');
    press('i');
    press('Escape');
    expect(result.current.completed).toBe(true);
    expect(result.current.lines).toEqual(['Hi']);

    // The listener detaches on completion — stray keys must not corrupt the buffer.
    press('x');
    expect(result.current.lines).toEqual(['Hi']);
  });

  it('resetDrill restores the starting buffer', () => {
    const { result } = renderHook(() => usePractice());
    act(() => result.current.selectDrill('A'));
    press('A');
    press('!');
    expect(result.current.lines).toEqual(['Hello!']);

    act(() => result.current.resetDrill());
    expect(result.current.lines).toEqual(['Hello']);
    expect(result.current.mode).toBe('normal');
    expect(result.current.typed).toBe(0);
  });

  it('backToMenu clears the active drill', () => {
    const { result } = renderHook(() => usePractice());
    act(() => result.current.selectDrill('I'));
    expect(result.current.activeDrill).not.toBeNull();
    act(() => result.current.backToMenu());
    expect(result.current.activeDrill).toBeNull();
  });
});
