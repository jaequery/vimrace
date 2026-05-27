import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock game-logic modules not yet written by other agents
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
  applyMotion: vi.fn((_m: unknown, pos: unknown) => pos),
  isGoalReached: vi.fn(() => false),
}));

vi.mock('@/game/scoring', () => ({
  MAPS_PER_LEVEL: 3,
  MAX_LEVEL: 20,
  levelLimitMs: vi.fn(() => 30_000),
  levelScore: vi.fn(() => ({
    level: 1,
    timeMs: 0,
    limitMs: 30_000,
    used: 0,
    par: 5,
    medal: 'none',
    points: 0,
  })),
  seedForLevelMap: vi.fn((level: number, index: number) => level * 10 + index + 1),
}));

vi.mock('@/game/storage', () => ({
  getStats: vi.fn(() => ({ totalMapsCleared: 0, totalGamesPlayed: 0 })),
  setStats: vi.fn(),
  getUsername: vi.fn(() => ''),
  setUsername: vi.fn(),
  getHighestUnlockedLevel: vi.fn(() => 1),
  setHighestUnlockedLevel: vi.fn(),
  normalizeUsername: vi.fn((s: string) => s.trim()),
  MAX_USERNAME_LEN: 16,
  MAX_LEVEL: 20,
}));

vi.mock('@/game/leaderboard', () => ({
  submitRun: vi.fn(() => Promise.resolve(true)),
  fetchLeaderboard: vi.fn(() => Promise.resolve({ boards: {}, overall: [], ranks: {} })),
  fetchHighScore: vi.fn(() => Promise.resolve(0)),
}));

import App from './App';

describe('App (scaffold smoke test)', () => {
  it('renders the VimRace title', () => {
    render(<App />);
    expect(screen.getByText('VimRace')).toBeInTheDocument();
  });
});
