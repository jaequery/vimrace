import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mock the modules useGame depends on so this suite is self-contained.
// MAPS_PER_LEVEL is mocked to 1 so a single goal-reach completes a level.
// ---------------------------------------------------------------------------

const mockMap = {
  rows: 5,
  cols: 10,
  grid: Array.from({ length: 5 }, () => Array(10).fill(true) as boolean[]),
  start: { row: 0, col: 0 },
  goal: { row: 4, col: 9 },
  level: 1,
  seed: 42,
  par: 5,
};

vi.mock('@/game/map', () => ({
  generateMap: vi.fn(() => ({ ...mockMap })),
  parKeystrokes: vi.fn(() => 5),
}));

vi.mock('@/game/vimEngine', () => ({
  applyMotion: vi.fn((_map: unknown, pos: { row: number; col: number }) => pos),
  isGoalReached: vi.fn(() => false),
}));

vi.mock('@/game/scoring', () => ({
  MAPS_PER_LEVEL: 1,
  MAX_LEVEL: 20,
  levelLimitMs: vi.fn(() => 30_000),
  levelScore: vi.fn(() => ({
    level: 1,
    timeMs: 1_234,
    limitMs: 30_000,
    used: 1,
    par: 5,
    medal: 'gold',
    points: 200,
  })),
  seedForLevelMap: vi.fn((level: number, index: number) => level * 10 + index + 1),
}));

vi.mock('@/game/storage', () => ({
  getStats: vi.fn(() => ({ totalMapsCleared: 0, totalGamesPlayed: 0 })),
  setStats: vi.fn(),
  getUsername: vi.fn(() => ''),
  setUsername: vi.fn(),
  getHighestUnlockedLevel: vi.fn(() => 5),
  setHighestUnlockedLevel: vi.fn(),
  normalizeUsername: vi.fn((s: string) => s.trim()),
}));

vi.mock('@/game/leaderboard', () => ({
  submitRun: vi.fn(() => Promise.resolve(true)),
  fetchHighScore: vi.fn(() => Promise.resolve(0)),
}));

// Import after mocks are set up
import { useGame } from './useGame';
import * as vimEngine from '@/game/vimEngine';

function reachGoalKey() {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'l', bubbles: true }));
}

describe('useGame', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts in idle status', () => {
    const { result } = renderHook(() => useGame());
    expect(result.current.status).toBe('idle');
  });

  it('transitions to playing after start()', () => {
    const { result } = renderHook(() => useGame());
    act(() => result.current.start());
    expect(result.current.status).toBe('playing');
  });

  it('starts a run at level 1 with score 0 by default', () => {
    const { result } = renderHook(() => useGame());
    act(() => result.current.start());
    expect(result.current.score).toBe(0);
    expect(result.current.level).toBe(1);
    expect(result.current.mapIndex).toBe(0);
  });

  it('starts at the requested level when unlocked', () => {
    const { result } = renderHook(() => useGame());
    act(() => result.current.start(3));
    expect(result.current.level).toBe(3);
  });

  it('clamps the start level to the highest unlocked', () => {
    const { result } = renderHook(() => useGame());
    act(() => result.current.start(99));
    expect(result.current.level).toBe(5); // mocked highest unlocked
  });

  it('completes the level and awards score when the goal is reached', () => {
    vi.mocked(vimEngine.isGoalReached).mockReturnValueOnce(true);

    const { result } = renderHook(() => useGame());
    act(() => result.current.start());
    act(() => reachGoalKey());

    expect(result.current.status).toBe('levelcomplete');
    expect(result.current.score).toBe(200);
    expect(result.current.lastResult).not.toBeNull();
    expect(result.current.lastResult?.medal).toBe('gold');
  });

  it('records the completed level time and unlocks the next level', () => {
    vi.mocked(vimEngine.isGoalReached).mockReturnValueOnce(true);

    const { result } = renderHook(() => useGame());
    act(() => result.current.start(2));
    act(() => reachGoalKey());

    // The recorded time is the *actual* elapsed time at completion (0 here, as
    // no animation frames advanced the clock in the test) — the level is logged.
    expect(result.current.timesByLevel).toHaveProperty('2');
    expect(typeof result.current.timesByLevel[2]).toBe('number');
    expect(result.current.highestUnlockedLevel).toBeGreaterThanOrEqual(3);
  });

  it('continues the run into the next level via nextLevel()', () => {
    vi.mocked(vimEngine.isGoalReached).mockReturnValueOnce(true);

    const { result } = renderHook(() => useGame());
    act(() => result.current.start(2));
    act(() => reachGoalKey());
    expect(result.current.status).toBe('levelcomplete');

    act(() => result.current.nextLevel());
    expect(result.current.status).toBe('playing');
    expect(result.current.level).toBe(3);
    expect(result.current.score).toBe(200); // score carries over
  });

  it('resets to idle after reset()', () => {
    const { result } = renderHook(() => useGame());
    act(() => result.current.start());
    act(() => result.current.reset());
    expect(result.current.status).toBe('idle');
    expect(result.current.score).toBe(0);
  });

  it('exposes the required public API shape', () => {
    const { result } = renderHook(() => useGame());
    const g = result.current;
    expect(typeof g.status).toBe('string');
    expect(g.map).toBeDefined();
    expect(g.cursor).toBeDefined();
    expect(typeof g.score).toBe('number');
    expect(typeof g.level).toBe('number');
    expect(typeof g.mapIndex).toBe('number');
    expect(typeof g.mapsPerLevel).toBe('number');
    expect(typeof g.elapsedMs).toBe('number');
    expect(typeof g.limitMs).toBe('number');
    expect(typeof g.highScore).toBe('number');
    expect(typeof g.highestUnlockedLevel).toBe('number');
    expect(typeof g.start).toBe('function');
    expect(typeof g.nextLevel).toBe('function');
    expect(typeof g.reset).toBe('function');
  });
});
