import { useCallback, useEffect, useState } from 'react';
import {
  createState,
  matchesGoal,
  reduceKey,
  type InsertMode,
  type BufferPos,
  type InsertState,
} from '@/game/insertEngine';
import { INSERT_DRILLS, DRILLS_BY_ID, type InsertDrill } from '@/game/insertDrills';

/**
 * usePractice — state machine for the insert-mode practice subsystem.
 *
 * Two views: the **menu** (no drill selected) and an **active drill**. While a
 * drill is open it owns a live `InsertState`, fed by a window keydown listener
 * (the keyboard logic itself lives in `reduceKey`, so this hook is a thin DOM
 * adapter). The listener is detached on the menu and once a drill is complete,
 * so it never competes with the race game's own keyboard handler.
 */
export interface UsePracticeReturn {
  /** every available drill, in menu order */
  drills: readonly InsertDrill[];
  /** the drill currently open, or null when showing the menu */
  activeDrill: InsertDrill | null;
  /** live buffer lines */
  lines: string[];
  /** live caret position */
  cursor: BufferPos;
  /** current mode (normal / insert) */
  mode: InsertMode;
  /** printable characters typed in insert mode this attempt */
  typed: number;
  /** true once the buffer matches the goal and the player is back in normal mode */
  completed: boolean;
  /** open a drill by id (resets its buffer) */
  selectDrill: (id: string) => void;
  /** restart the current drill from its starting buffer */
  resetDrill: () => void;
  /** close the current drill and return to the menu */
  backToMenu: () => void;
}

const EMPTY_LINES: string[] = [''];
const ORIGIN: BufferPos = { row: 0, col: 0 };

export function usePractice(): UsePracticeReturn {
  const [drillId, setDrillId] = useState<string | null>(null);
  const [engine, setEngine] = useState<InsertState | null>(null);

  const activeDrill = drillId !== null ? DRILLS_BY_ID[drillId] ?? null : null;

  const selectDrill = useCallback((id: string) => {
    const drill = DRILLS_BY_ID[id];
    if (!drill) return;
    setDrillId(id);
    setEngine(createState(drill.start));
  }, []);

  const resetDrill = useCallback(() => {
    setDrillId((id) => {
      const drill = id !== null ? DRILLS_BY_ID[id] : undefined;
      setEngine(drill ? createState(drill.start) : null);
      return id;
    });
  }, []);

  const backToMenu = useCallback(() => {
    setDrillId(null);
    setEngine(null);
  }, []);

  const completed =
    activeDrill !== null && engine !== null && matchesGoal(engine, activeDrill.goal);

  // -------------------------------------------------------------------------
  // Keyboard — active only while a drill is open and unfinished. The functional
  // setEngine updater keeps the listener stable across keystrokes (no rebind
  // per character); it re-binds only when the drill or completion flips.
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (activeDrill === null || completed) return;

    function handleKeyDown(e: KeyboardEvent): void {
      // Leave browser/OS shortcuts alone.
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      setEngine((prev) => {
        if (prev === null) return prev;
        const { state, handled } = reduceKey(prev, e.key);
        if (handled) e.preventDefault();
        return state;
      });
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeDrill, completed]);

  return {
    drills: INSERT_DRILLS,
    activeDrill,
    lines: engine?.lines ?? EMPTY_LINES,
    cursor: engine?.cursor ?? ORIGIN,
    mode: engine?.mode ?? 'normal',
    typed: engine?.typed ?? 0,
    completed,
    selectDrill,
    resetDrill,
    backToMenu,
  };
}
