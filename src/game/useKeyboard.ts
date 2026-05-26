import { useEffect } from 'react';
import type { Motion } from '@/game/types';

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
};

/** Keys that map to a recognized motion. */
const GAME_KEYS = new Set(Object.keys(KEY_TO_MOTION));

/**
 * Attaches a global keydown listener while `active` is true.
 * Maps raw KeyboardEvent.key values to Motion and calls `onMotion`.
 * Prevents default only for recognized game keys to avoid browser scroll, etc.
 * Ignores events with Ctrl/Meta/Alt held (browser / OS shortcuts).
 * Cleans up the listener on unmount or when `active` changes.
 */
export function useKeyboard(active: boolean, onMotion: (motion: Motion) => void): void {
  useEffect(() => {
    if (!active) return;

    function handleKeyDown(e: KeyboardEvent): void {
      // Ignore modified key combos
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      // `$` is produced by Shift+4; the browser gives us key === '$'
      const key = e.key;

      if (!GAME_KEYS.has(key)) return;

      e.preventDefault();

      const motion = KEY_TO_MOTION[key];
      if (motion !== undefined) {
        onMotion(motion);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [active, onMotion]);
}
