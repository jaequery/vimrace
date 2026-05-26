import { describe, it, expect, beforeEach } from 'vitest';
import { getHighScore, setHighScore, getStats, setStats } from './storage';

describe('storage', () => {
  beforeEach(() => {
    localStorage.clear();
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
