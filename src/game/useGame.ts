import { useCallback, useEffect, useReducer, useRef } from 'react';
import type { GameMap, GameStatus, LevelResult, Motion, Pos } from '@/game/types';
import { applyMotion, isGoalReached } from '@/game/vimEngine';
import { generateMap } from '@/game/map';
import {
  MAPS_PER_LEVEL,
  MAX_LEVEL,
  levelLimitMs,
  levelScore,
  seedForLevelMap,
} from '@/game/scoring';
import {
  getStats,
  setStats,
  getUsername,
  setUsername as persistUsername,
  getHighestUnlockedLevel,
  setHighestUnlockedLevel,
  normalizeUsername,
} from '@/game/storage';
import type { StoredStats } from '@/game/storage';
import { useKeyboard } from '@/game/useKeyboard';
import { submitRun, fetchHighScore } from '@/game/leaderboard';
import type { TimesByLevel } from '@/game/leaderboard';

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

export interface GameState {
  status: GameStatus;
  /** the level currently being played / just played (1-based) */
  level: number;
  /** the fixed sequence of mazes for `level` (deterministic per level) */
  maps: GameMap[];
  /** which maze within the level the player is on (0-based) */
  mapIndex: number;
  cursor: Pos;
  /** elapsed time this level (ms) — counts UP from 0 */
  elapsedMs: number;
  /** time limit for this level (ms) — run ends if elapsed reaches it */
  limitMs: number;
  /** summed par across the level's mazes */
  parTotal: number;
  /** total keystrokes used across the level's mazes so far */
  usedTotal: number;
  /** accumulated run score */
  score: number;
  highScore: number;
  /** high score as it stood when the current run began — to detect a *new* record */
  runStartHighScore: number;
  /** result of the most recently cleared level (for the level-complete screen) */
  lastResult: LevelResult | null;
  /** lifetime totals across all sessions (persisted to localStorage) */
  lifetimeStats: StoredStats;
  /** player handle for the leaderboard (persisted to localStorage) */
  username: string;
  /** best (lowest) completion time reached at each level during the current run */
  timesByLevel: TimesByLevel;
  /** highest level the player may start from (persisted; clearing N unlocks N+1) */
  highestUnlockedLevel: number;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

type Action =
  | { type: 'START'; level: number }
  | { type: 'NEXT_LEVEL' }
  | { type: 'APPLY_MOTION'; motion: Motion }
  | { type: 'TICK'; deltaMs: number }
  | { type: 'RESET' }
  | { type: 'SET_USERNAME'; username: string }
  // High score comes from the server (Redis), never localStorage.
  // `replace` sets it exactly (on identity change); otherwise it only ratchets up.
  | { type: 'SET_HIGH_SCORE'; highScore: number; replace?: boolean };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a level: its fixed mazes, total par, and time limit. */
function buildLevel(level: number): { maps: GameMap[]; parTotal: number; limitMs: number } {
  const maps: GameMap[] = [];
  for (let i = 0; i < MAPS_PER_LEVEL; i++) {
    maps.push(generateMap({ level, seed: seedForLevelMap(level, i) }));
  }
  const parTotal = maps.reduce((sum, m) => sum + m.par, 0);
  return { maps, parTotal, limitMs: levelLimitMs(level, parTotal) };
}

function makeInitialState(): GameState {
  const { maps, parTotal, limitMs } = buildLevel(1);
  // High score starts at 0 and is loaded from the server once a username is
  // known (see the fetch effect below) — it is never read from localStorage.
  return {
    status: 'idle',
    level: 1,
    maps,
    mapIndex: 0,
    cursor: { ...maps[0].start },
    elapsedMs: 0,
    limitMs,
    parTotal,
    usedTotal: 0,
    score: 0,
    highScore: 0,
    runStartHighScore: 0,
    lastResult: null,
    lifetimeStats: getStats(),
    username: getUsername(),
    timesByLevel: {},
    highestUnlockedLevel: getHighestUnlockedLevel(),
  };
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'START': {
      // Begin a *fresh run* at the chosen level (clamped to what's unlocked).
      const startLevel = Math.min(
        Math.max(1, Math.floor(action.level)),
        state.highestUnlockedLevel,
      );
      const { maps, parTotal, limitMs } = buildLevel(startLevel);
      return {
        ...state,
        status: 'playing',
        level: startLevel,
        maps,
        mapIndex: 0,
        cursor: { ...maps[0].start },
        elapsedMs: 0,
        limitMs,
        parTotal,
        usedTotal: 0,
        score: 0,
        runStartHighScore: state.highScore,
        lastResult: null,
        lifetimeStats: {
          totalMapsCleared: state.lifetimeStats.totalMapsCleared,
          totalGamesPlayed: state.lifetimeStats.totalGamesPlayed + 1,
        },
        timesByLevel: {},
      };
    }

    case 'NEXT_LEVEL': {
      // Continue the *same run* into the next level — score and times carry over.
      if (state.status !== 'levelcomplete') return state;
      const next = Math.min(state.level + 1, MAX_LEVEL);
      const { maps, parTotal, limitMs } = buildLevel(next);
      return {
        ...state,
        status: 'playing',
        level: next,
        maps,
        mapIndex: 0,
        cursor: { ...maps[0].start },
        elapsedMs: 0,
        limitMs,
        parTotal,
        usedTotal: 0,
        lastResult: null,
      };
    }

    case 'RESET': {
      // Back to the start screen; preserve the player's handle and their
      // server-loaded high score (it isn't re-fetched on a same-name reset).
      return {
        ...makeInitialState(),
        username: state.username,
        highScore: state.highScore,
        runStartHighScore: state.highScore,
      };
    }

    case 'SET_USERNAME': {
      return { ...state, username: normalizeUsername(action.username) };
    }

    case 'SET_HIGH_SCORE': {
      const next = action.replace
        ? action.highScore
        : Math.max(state.highScore, action.highScore);
      return next === state.highScore ? state : { ...state, highScore: next };
    }

    case 'APPLY_MOTION': {
      if (state.status !== 'playing') return state;

      const currentMap = state.maps[state.mapIndex];
      const newCursor = applyMotion(currentMap, state.cursor, action.motion);
      const newUsedTotal = state.usedTotal + 1;

      if (isGoalReached(currentMap, newCursor)) {
        const newLifetime: StoredStats = {
          totalMapsCleared: state.lifetimeStats.totalMapsCleared + 1,
          totalGamesPlayed: state.lifetimeStats.totalGamesPlayed,
        };

        // More mazes left in this level → advance to the next one, clock running.
        if (state.mapIndex < MAPS_PER_LEVEL - 1) {
          const nextIndex = state.mapIndex + 1;
          return {
            ...state,
            mapIndex: nextIndex,
            cursor: { ...state.maps[nextIndex].start },
            usedTotal: newUsedTotal,
            lifetimeStats: newLifetime,
          };
        }

        // Last maze cleared → level complete. Lock in the time, award score.
        const result = levelScore({
          level: state.level,
          used: newUsedTotal,
          par: state.parTotal,
          timeMs: state.elapsedMs,
          limitMs: state.limitMs,
        });
        const newScore = state.score + result.points;
        const newHighScore = Math.max(newScore, state.highScore);
        const prevBest = state.timesByLevel[state.level];
        const newTimesByLevel: TimesByLevel = {
          ...state.timesByLevel,
          [state.level]:
            prevBest === undefined ? state.elapsedMs : Math.min(prevBest, state.elapsedMs),
        };
        const newUnlocked = Math.min(
          MAX_LEVEL,
          Math.max(state.highestUnlockedLevel, state.level + 1),
        );

        return {
          ...state,
          status: 'levelcomplete',
          usedTotal: newUsedTotal,
          score: newScore,
          highScore: newHighScore,
          lastResult: result,
          timesByLevel: newTimesByLevel,
          highestUnlockedLevel: newUnlocked,
          lifetimeStats: newLifetime,
        };
      }

      return { ...state, cursor: newCursor, usedTotal: newUsedTotal };
    }

    case 'TICK': {
      if (state.status !== 'playing') return state;

      const newElapsed = state.elapsedMs + action.deltaMs;
      if (newElapsed >= state.limitMs) {
        // Out of time — the run ends on this level.
        const newHighScore = Math.max(state.score, state.highScore);
        return {
          ...state,
          status: 'gameover',
          elapsedMs: state.limitMs,
          highScore: newHighScore,
        };
      }
      return { ...state, elapsedMs: newElapsed };
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
  level: number;
  /** the maze the player is currently on */
  map: GameMap;
  /** which maze within the level (0-based) */
  mapIndex: number;
  /** mazes per level (constant; for "maze x / N" display) */
  mapsPerLevel: number;
  cursor: Pos;
  /** elapsed time this level (ms), counting up */
  elapsedMs: number;
  /** time limit for this level (ms) */
  limitMs: number;
  score: number;
  highScore: number;
  /** high score when this run began — compare final score against this for a new record */
  runStartHighScore: number;
  /** result of the most recently cleared level */
  lastResult: LevelResult | null;
  lifetimeStats: StoredStats;
  username: string;
  /** best completion time reached at each level during the current run */
  timesByLevel: TimesByLevel;
  highestUnlockedLevel: number;
  /** start a fresh run at the given level (defaults to level 1) */
  start: (level?: number) => void;
  /** continue the current run into the next level (from a level-complete screen) */
  nextLevel: () => void;
  reset: () => void;
  setUsername: (username: string) => void;
}

export function useGame(): UseGameReturn {
  const [state, dispatch] = useReducer(reducer, undefined, makeInitialState);

  // -------------------------------------------------------------------------
  // RAF-driven count-up clock — drift-free, pauses when not playing
  // -------------------------------------------------------------------------
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const isPlaying = state.status === 'playing';

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

      // Reducer caps elapsed at the limit and flips to gameover; an extra TICK
      // after that is a no-op, so no guard is needed here.
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
  // High score lives only on the server. Load it for the current handle
  // (debounced so typing a name on the start screen doesn't spam the API).
  // `replace` sets it exactly — identity changed, so don't carry over a stale
  // higher value from a different name.
  // -------------------------------------------------------------------------
  const username = state.username;
  useEffect(() => {
    if (!username) return;
    let cancelled = false;
    const id = setTimeout(() => {
      void fetchHighScore(username).then((remote) => {
        if (!cancelled) dispatch({ type: 'SET_HIGH_SCORE', highScore: remote, replace: true });
      });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [username]);

  // -------------------------------------------------------------------------
  // Persist stats / username / unlocked level to localStorage
  // -------------------------------------------------------------------------
  const lifetimeStats = state.lifetimeStats;
  useEffect(() => {
    setStats(lifetimeStats);
  }, [lifetimeStats]);

  useEffect(() => {
    if (username) persistUsername(username);
  }, [username]);

  const highestUnlockedLevel = state.highestUnlockedLevel;
  useEffect(() => {
    setHighestUnlockedLevel(highestUnlockedLevel);
  }, [highestUnlockedLevel]);

  // -------------------------------------------------------------------------
  // Submit the run once per transition into a terminal-ish state. Refs read
  // the latest values without re-firing the effect mid-run; the guard ensures
  // exactly one submit per entry into 'levelcomplete' / 'gameover'.
  // -------------------------------------------------------------------------
  const lastSubmitRef = useRef<GameStatus | null>(null);
  const usernameRef = useRef(username);
  usernameRef.current = username;
  const timesByLevelRef = useRef(state.timesByLevel);
  timesByLevelRef.current = state.timesByLevel;
  const scoreRef = useRef(state.score);
  scoreRef.current = state.score;

  useEffect(() => {
    if (state.status === 'levelcomplete' || state.status === 'gameover') {
      if (lastSubmitRef.current !== state.status) {
        lastSubmitRef.current = state.status;
        // Submit the run, then re-read the high score from the server so a new
        // record (here or on another session/device) is reflected. Ratchets up
        // only — never lowers the number on screen mid-flow.
        void (async () => {
          const name = usernameRef.current;
          await submitRun(name, {
            timesByLevel: timesByLevelRef.current,
            score: scoreRef.current,
          });
          const remote = await fetchHighScore(name);
          dispatch({ type: 'SET_HIGH_SCORE', highScore: remote });
        })();
      }
    } else {
      lastSubmitRef.current = null;
    }
  }, [state.status]);

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
  const start = useCallback((level: number = 1) => {
    dispatch({ type: 'START', level });
  }, []);

  const nextLevel = useCallback(() => {
    dispatch({ type: 'NEXT_LEVEL' });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  const setUsername = useCallback((value: string) => {
    dispatch({ type: 'SET_USERNAME', username: value });
  }, []);

  return {
    status: state.status,
    level: state.level,
    map: state.maps[state.mapIndex],
    mapIndex: state.mapIndex,
    mapsPerLevel: MAPS_PER_LEVEL,
    cursor: state.cursor,
    elapsedMs: state.elapsedMs,
    limitMs: state.limitMs,
    score: state.score,
    highScore: state.highScore,
    runStartHighScore: state.runStartHighScore,
    lastResult: state.lastResult,
    lifetimeStats: state.lifetimeStats,
    username: state.username,
    timesByLevel: state.timesByLevel,
    highestUnlockedLevel: state.highestUnlockedLevel,
    start,
    nextLevel,
    reset,
    setUsername,
  };
}
