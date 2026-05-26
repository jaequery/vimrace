import { useCallback, useEffect, useReducer, useRef } from 'react';
import type { GameMap, GameStatus, MapResult, Motion, Pos } from '@/game/types';
import { applyMotion, isGoalReached } from '@/game/vimEngine';
import { generateMap, parKeystrokes } from '@/game/map';
import { mapBonus, INITIAL_CLOCK_MS, levelForMapsCleared } from '@/game/scoring';
import { getHighScore, setHighScore } from '@/game/storage';
import { useKeyboard } from '@/game/useKeyboard';

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

export interface GameState {
  status: GameStatus;
  map: GameMap;
  cursor: Pos;
  score: number;
  mapsCleared: number;
  /** keystrokes used on the current map (reset each map) */
  keystrokesUsed: number;
  timeLeftMs: number;
  maxTimeMs: number;
  lastResult: MapResult | null;
  highScore: number;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

type Action =
  | { type: 'START' }
  | { type: 'APPLY_MOTION'; motion: Motion }
  | { type: 'TICK'; deltaMs: number }
  | { type: 'GAME_OVER' }
  | { type: 'RESET' };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInitialMap(): GameMap {
  return generateMap({ level: 1 });
}

function makeInitialState(): GameState {
  const map = makeInitialMap();
  return {
    status: 'idle',
    map,
    cursor: { ...map.start },
    score: 0,
    mapsCleared: 0,
    keystrokesUsed: 0,
    timeLeftMs: INITIAL_CLOCK_MS,
    maxTimeMs: INITIAL_CLOCK_MS,
    lastResult: null,
    highScore: getHighScore(),
  };
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'START': {
      if (state.status === 'playing') return state;
      const map = generateMap({ level: 1 });
      return {
        ...makeInitialState(),
        status: 'playing',
        map,
        cursor: { ...map.start },
        timeLeftMs: INITIAL_CLOCK_MS,
        maxTimeMs: INITIAL_CLOCK_MS,
      };
    }

    case 'RESET': {
      return makeInitialState();
    }

    case 'APPLY_MOTION': {
      if (state.status !== 'playing') return state;

      const newCursor = applyMotion(state.map, state.cursor, action.motion);
      const newKeystrokesUsed = state.keystrokesUsed + 1;

      if (isGoalReached(state.map, newCursor)) {
        // Compute bonus for clearing this map
        const result = mapBonus({
          par: parKeystrokes(state.map),
          used: newKeystrokesUsed,
          timeLeftMs: state.timeLeftMs,
          level: state.map.level,
        });

        const newScore = state.score + result.points;
        const newMapsCleared = state.mapsCleared + 1;
        const newTimeLeftMs = Math.min(
          state.timeLeftMs + result.bonusTimeMs,
          // Cap at some generous ceiling to keep game fair (3x INITIAL_CLOCK_MS)
          INITIAL_CLOCK_MS * 3,
        );

        const nextLevel = levelForMapsCleared(newMapsCleared);
        const nextMap = generateMap({ level: nextLevel });

        const newHighScore = Math.max(newScore, state.highScore);

        return {
          ...state,
          map: nextMap,
          cursor: { ...nextMap.start },
          score: newScore,
          mapsCleared: newMapsCleared,
          keystrokesUsed: 0,
          timeLeftMs: newTimeLeftMs,
          maxTimeMs: Math.max(state.maxTimeMs, newTimeLeftMs),
          lastResult: result,
          highScore: newHighScore,
        };
      }

      return {
        ...state,
        cursor: newCursor,
        keystrokesUsed: newKeystrokesUsed,
      };
    }

    case 'TICK': {
      if (state.status !== 'playing') return state;

      const newTimeLeftMs = Math.max(0, state.timeLeftMs - action.deltaMs);

      if (newTimeLeftMs <= 0) {
        // Will trigger GAME_OVER on next render via useEffect
        return { ...state, timeLeftMs: 0 };
      }

      return { ...state, timeLeftMs: newTimeLeftMs };
    }

    case 'GAME_OVER': {
      if (state.status !== 'playing') return state;
      const newHighScore = Math.max(state.score, state.highScore);
      return {
        ...state,
        status: 'gameover',
        timeLeftMs: 0,
        highScore: newHighScore,
      };
    }

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface UseGameReturn {
  status: GameStatus;
  map: GameMap;
  cursor: Pos;
  score: number;
  mapsCleared: number;
  timeLeftMs: number;
  maxTimeMs: number;
  lastResult: MapResult | null;
  highScore: number;
  start: () => void;
  reset: () => void;
}

export function useGame(): UseGameReturn {
  const [state, dispatch] = useReducer(reducer, undefined, makeInitialState);

  // -------------------------------------------------------------------------
  // RAF-driven countdown — drift-free, pauses when not playing
  // -------------------------------------------------------------------------
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const isPlaying = state.status === 'playing';
  const timeLeftMsRef = useRef(state.timeLeftMs);
  timeLeftMsRef.current = state.timeLeftMs;

  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      lastTimeRef.current = null;
      return;
    }

    function tick(now: number): void {
      if (lastTimeRef.current === null) {
        lastTimeRef.current = now;
      }

      const delta = now - lastTimeRef.current;
      lastTimeRef.current = now;

      dispatch({ type: 'TICK', deltaMs: delta });

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      lastTimeRef.current = null;
    };
  }, [isPlaying]);

  // -------------------------------------------------------------------------
  // Transition to game over when time runs out
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (state.status === 'playing' && state.timeLeftMs <= 0) {
      dispatch({ type: 'GAME_OVER' });
    }
  }, [state.status, state.timeLeftMs]);

  // -------------------------------------------------------------------------
  // Persist high score to localStorage whenever it changes
  // -------------------------------------------------------------------------
  const highScore = state.highScore;
  useEffect(() => {
    setHighScore(highScore);
  }, [highScore]);

  // -------------------------------------------------------------------------
  // Keyboard input — active only while playing
  // -------------------------------------------------------------------------
  const handleMotion = useCallback((motion: Motion) => {
    dispatch({ type: 'APPLY_MOTION', motion });
  }, []);

  useKeyboard(isPlaying, handleMotion);

  // -------------------------------------------------------------------------
  // Public actions
  // -------------------------------------------------------------------------
  const start = useCallback(() => {
    dispatch({ type: 'START' });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  return {
    status: state.status,
    map: state.map,
    cursor: state.cursor,
    score: state.score,
    mapsCleared: state.mapsCleared,
    timeLeftMs: state.timeLeftMs,
    maxTimeMs: state.maxTimeMs,
    lastResult: state.lastResult,
    highScore: state.highScore,
    start,
    reset,
  };
}
