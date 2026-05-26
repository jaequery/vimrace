import { useEffect } from 'react';
import type { Motion } from '@/game/types';

/** Single-press keys that map directly to a motion. */
const KEY_TO_MOTION: Record<string, Motion> = {
  h: 'h',
  j: 'j',
  k: 'k',
  l: 'l',
  w: 'w',
  b: 'b',
  e: 'e',
  '0': '0',
  $: '$',
  G: 'G', // Shift+g
};

/** How long (ms) a leading `g` waits for its partner before lapsing. */
const G_SEQUENCE_TIMEOUT = 700;

/**
 * Attaches a global keydown listener while `active` is true.
 *
 * Maps raw KeyboardEvent.key values to a Motion and calls `onMotion`:
 *   - single keys (h/j/k/l/w/b/e/0/$/G) map directly;
 *   - `Ctrl-d` / `Ctrl-u` fire the half-page leaps (pgdn / pgup), as in Vim;
 *   - `gg` is a two-press sequence — a leading `g` arms a short window, and a
 *     second `g` within it fires `gg`; any other key (or the timeout) cancels.
 *
 * Prevents default only for recognized game keys (so `Ctrl-d`/`Ctrl-u` don't
 * trigger the browser and PageUp/PageDown-style scroll is avoided). Other
 * Ctrl/Meta/Alt combos are ignored so browser and OS shortcuts still work.
 * Cleans up on unmount or when `active` changes.
 */
export function useKeyboard(active: boolean, onMotion: (motion: Motion) => void): void {
  useEffect(() => {
    if (!active) return;

    // `g`-prefix state, scoped to this listener's lifetime.
    let pendingG = false;
    let gTimer: ReturnType<typeof setTimeout> | undefined;

    function cancelPendingG(): void {
      pendingG = false;
      if (gTimer !== undefined) {
        clearTimeout(gTimer);
        gTimer = undefined;
      }
    }

    function handleKeyDown(e: KeyboardEvent): void {
      // Ctrl-d / Ctrl-u → half-page leaps (Vim's half-screen scroll). Only
      // plain Ctrl (no Meta/Alt). preventDefault stops the browser's bookmark
      // (Ctrl-d) / view-source (Ctrl-u) while the game is active.
      if (e.ctrlKey && !e.metaKey && !e.altKey) {
        const ck = e.key.toLowerCase();
        if (ck === 'd' || ck === 'u') {
          e.preventDefault();
          cancelPendingG();
          onMotion(ck === 'd' ? 'pgdn' : 'pgup');
        }
        // Swallow every other Ctrl combo without acting on it.
        return;
      }

      // Ignore remaining modified key combos (Meta / Alt).
      if (e.metaKey || e.altKey) return;

      const key = e.key;

      // Two-press `gg` sequence.
      if (key === 'g') {
        e.preventDefault();
        if (pendingG) {
          cancelPendingG();
          onMotion('gg');
        } else {
          pendingG = true;
          gTimer = setTimeout(() => {
            pendingG = false;
            gTimer = undefined;
          }, G_SEQUENCE_TIMEOUT);
        }
        return;
      }

      // Any other key abandons a half-typed `gg`.
      if (pendingG) cancelPendingG();

      const motion = KEY_TO_MOTION[key];
      if (motion !== undefined) {
        e.preventDefault();
        onMotion(motion);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (gTimer !== undefined) clearTimeout(gTimer);
    };
  }, [active, onMotion]);
}
