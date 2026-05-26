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
  PageDown: 'pgdn',
  PageUp: 'pgup',
};

/** How long (ms) a leading `g` waits for its partner before lapsing. */
const G_SEQUENCE_TIMEOUT = 700;

/**
 * Attaches a global keydown listener while `active` is true.
 *
 * Maps raw KeyboardEvent.key values to a Motion and calls `onMotion`:
 *   - single keys (h/j/k/l/w/b/e/0/$/G) and PageUp/PageDown map directly;
 *   - `gg` is a two-press sequence — a leading `g` arms a short window, and a
 *     second `g` within it fires `gg`; any other key (or the timeout) cancels.
 *
 * Prevents default only for recognized game keys (so PageUp/PageDown don't
 * scroll the page, etc). Ignores events with Ctrl/Meta/Alt held so browser and
 * OS shortcuts still work. Cleans up on unmount or when `active` changes.
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
      // Ignore modified key combos (browser / OS shortcuts).
      if (e.ctrlKey || e.metaKey || e.altKey) return;

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
