import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mock the modules owned by other agents so this test suite is self-contained
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
  generateMap: vi.fn(() => mockMap),
  parKeystrokes: vi.fn(() => 5),
}));

vi.mock('@/game/vimEngine', () => ({
  applyMotion: vi.fn((_map: unknown, pos: { row: number; col: number }, _motion: string) => pos),
  isGoalReached: vi.fn(() => false),
}));

vi.mock('@/game/scoring', () => ({
  mapBonus: vi.fn(() => ({
    points: 100,
    bonusTimeMs: 5000,
    medal: 'gold',
    used: 1,
    par: 5,
  })),
  INITIAL_CLOCK_MS: 60_000,
  levelForMapsCleared: vi.fn((cleared: number) => cleared + 1),
}));

vi.mock('@/game/storage', () => ({
  getHighScore: vi.fn(() => 0),
  setHighScore: vi.fn(),
}));

// Import after mocks are set up
import { useGame } from './useGame';
import * as vimEngine from '@/game/vimEngine';
import * as scoring from '@/game/scoring';

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

  it('starts with score 0 and mapsCleared 0', () => {
    const { result } = renderHook(() => useGame());
    act(() => result.current.start());
    expect(result.current.score).toBe(0);
    expect(result.current.mapsCleared).toBe(0);
  });

  it('increments score and mapsCleared when goal is reached', () => {
    // Make isGoalReached return true on first call after motion
    vi.mocked(vimEngine.isGoalReached).mockReturnValueOnce(true);
    vi.mocked(scoring.mapBonus).mockReturnValueOnce({
      points: 200,
      bonusTimeMs: 3000,
      medal: 'silver',
      used: 3,
      par: 5,
    });

    const { result } = renderHook(() => useGame());
    act(() => result.current.start());

    act(() => {
      // Simulate a motion that reaches the goal
      // useKeyboard dispatches via APPLY_MOTION; we can invoke via keyboard event
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'l', bubbles: true }),
      );
    });

    expect(result.current.score).toBe(200);
    expect(result.current.mapsCleared).toBe(1);
    expect(result.current.lastResult).not.toBeNull();
    expect(result.current.lastResult?.medal).toBe('silver');
  });

  it('resets to idle status after reset()', () => {
    const { result } = renderHook(() => useGame());
    act(() => result.current.start());
    act(() => result.current.reset());
    expect(result.current.status).toBe('idle');
    expect(result.current.score).toBe(0);
    expect(result.current.mapsCleared).toBe(0);
  });

  it('exposes required public API shape', () => {
    const { result } = renderHook(() => useGame());
    const g = result.current;
    expect(typeof g.status).toBe('string');
    expect(g.map).toBeDefined();
    expect(g.cursor).toBeDefined();
    expect(typeof g.score).toBe('number');
    expect(typeof g.mapsCleared).toBe('number');
    expect(typeof g.timeLeftMs).toBe('number');
    expect(typeof g.maxTimeMs).toBe('number');
    expect(typeof g.highScore).toBe('number');
    expect(typeof g.start).toBe('function');
    expect(typeof g.reset).toBe('function');
  });
});
