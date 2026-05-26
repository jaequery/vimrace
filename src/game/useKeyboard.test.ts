/**
 * useKeyboard.test.ts — key bindings, the two-press `gg` sequence, and the
 * Ctrl-d / Ctrl-u half-page leaps.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboard } from '@/game/useKeyboard';
import type { Motion } from '@/game/types';

function press(key: string, init: KeyboardEventInit = {}): void {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...init }));
}

/** Pull the ordered list of motions passed to the spy. */
function motions(spy: Mock<(motion: Motion) => void>): Motion[] {
  return spy.mock.calls.map((c) => c[0]);
}

describe('useKeyboard', () => {
  let onMotion: Mock<(motion: Motion) => void>;

  beforeEach(() => {
    onMotion = vi.fn<(motion: Motion) => void>();
  });

  it('maps single keys to motions', () => {
    renderHook(() => useKeyboard(true, onMotion));
    for (const k of ['h', 'j', 'k', 'l', 'w', 'b', 'e', '0', '$']) press(k);
    press('G'); // Shift+g
    expect(motions(onMotion)).toEqual([
      'h', 'j', 'k', 'l', 'w', 'b', 'e', '0', '$', 'G',
    ]);
  });

  it('does nothing when inactive', () => {
    renderHook(() => useKeyboard(false, onMotion));
    press('h');
    expect(onMotion).not.toHaveBeenCalled();
  });

  it('fires gg only on the second g', () => {
    renderHook(() => useKeyboard(true, onMotion));
    press('g');
    expect(onMotion).not.toHaveBeenCalled();
    press('g');
    expect(onMotion).toHaveBeenCalledTimes(1);
    expect(onMotion).toHaveBeenLastCalledWith('gg');
  });

  it('a non-g key cancels a half-typed gg and is itself processed', () => {
    renderHook(() => useKeyboard(true, onMotion));
    press('g');
    press('l');
    expect(motions(onMotion)).toEqual(['l']);
    // A following g must not pair with the abandoned one.
    press('g');
    expect(onMotion).toHaveBeenCalledTimes(1);
  });

  it('maps Ctrl-d → pgdn and Ctrl-u → pgup', () => {
    renderHook(() => useKeyboard(true, onMotion));
    press('d', { ctrlKey: true });
    press('u', { ctrlKey: true });
    expect(motions(onMotion)).toEqual(['pgdn', 'pgup']);
  });

  it('ignores other Ctrl combos and bare d/u', () => {
    renderHook(() => useKeyboard(true, onMotion));
    press('a', { ctrlKey: true }); // Ctrl-a — not a motion
    press('d'); // bare d — not a motion
    press('l', { metaKey: true }); // Cmd-l — ignored
    expect(onMotion).not.toHaveBeenCalled();
  });
});
