import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getHighScore, setHighScore, getStats, setStats } from './storage';

describe('storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('isStorageAvailable memoization', () => {
    it('probes localStorage exactly once across many reads (memoized)', () => {
      // Warm the cache with one call, then spy to confirm no further probes occur.
      getHighScore(); // may or may not be the first call — warms cache if not already warm
      const spy = vi.spyOn(Storage.prototype, 'setItem');
      // All subsequent calls must use the cached result — no further probe setItem calls.
      getHighScore();
      getStats();
      getHighScore();
      getStats();
      const probeCalls = spy.mock.calls.filter(([key]) => key === '__vimrace_test__');
      expect(probeCalls.length).toBe(0);
      spy.mockRestore();
    });
  });

  describe('getHighScore / setHighScore', () => {
    it('returns 0 when nothing is stored', () => {
      expect(getHighScore()).toBe(0);
    });

    it('round-trips a positive integer', () => {
      setHighScore(1234);
      expect(getHighScore()).toBe(1234);
    });

    it('clamps negative values to 0', () => {
      setHighScore(-50);
      expect(getHighScore()).toBe(0);
    });

    it('floors floating-point values', () => {
      setHighScore(99.9);
      expect(getHighScore()).toBe(99);
    });

    it('returns 0 for corrupt data', () => {
      localStorage.setItem('vimrace.highscore', 'not-a-number');
      expect(getHighScore()).toBe(0);
    });
  });

  describe('getStats / setStats', () => {
    it('returns zero stats when nothing is stored', () => {
      const stats = getStats();
      expect(stats.totalMapsCleared).toBe(0);
      expect(stats.totalGamesPlayed).toBe(0);
    });

    it('round-trips stats', () => {
      setStats({ totalMapsCleared: 42, totalGamesPlayed: 7 });
      const stats = getStats();
      expect(stats.totalMapsCleared).toBe(42);
      expect(stats.totalGamesPlayed).toBe(7);
    });

    it('clamps negative stats values to 0', () => {
      setStats({ totalMapsCleared: -1, totalGamesPlayed: -3 });
      const stats = getStats();
      expect(stats.totalMapsCleared).toBe(0);
      expect(stats.totalGamesPlayed).toBe(0);
    });

    it('returns zero stats for corrupt JSON', () => {
      localStorage.setItem('vimrace.stats', '{bad json}');
      const stats = getStats();
      expect(stats.totalMapsCleared).toBe(0);
      expect(stats.totalGamesPlayed).toBe(0);
    });
  });
});
