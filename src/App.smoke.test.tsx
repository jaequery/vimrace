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
  mapBonus: vi.fn(() => ({ points: 0, bonusTimeMs: 0, medal: 'none', used: 0, par: 5 })),
  INITIAL_CLOCK_MS: 60_000,
  levelForMapsCleared: vi.fn((n: number) => n + 1),
}));

vi.mock('@/game/storage', () => ({
  getHighScore: vi.fn(() => 0),
  setHighScore: vi.fn(),
  getStats: vi.fn(() => ({ totalMapsCleared: 0, totalGamesPlayed: 0 })),
  setStats: vi.fn(),
  getUsername: vi.fn(() => ''),
  setUsername: vi.fn(),
  normalizeUsername: vi.fn((s: string) => s.trim()),
  MAX_USERNAME_LEN: 16,
}));

import App from './App';

describe('App (scaffold smoke test)', () => {
  it('renders the VimRace title', () => {
    render(<App />);
    expect(screen.getByText('VimRace')).toBeInTheDocument();
  });
});
