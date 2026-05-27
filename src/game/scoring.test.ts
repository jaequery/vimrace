/**
 * scoring.test.ts — unit tests for the discrete-level, time-based scoring.
 */

import { describe, it, expect } from 'vitest';
import {
  levelScore,
  medalForLevel,
  levelLimitMs,
  scheduledLimitMs,
  seedForLevelMap,
  MAPS_PER_LEVEL,
  MAX_LEVEL,
  BASE_POINTS_PER_LEVEL,
  SAFETY_MS_PER_KEYSTROKE,
  MIN_LEVEL_LIMIT_MS,
  MAX_LEVEL_LIMIT_MS,
  LEVEL_START_LIMIT_MS,
  LEVEL_END_LIMIT_MS,
} from '@/game/scoring';

// ---------------------------------------------------------------------------
// Medal thresholds
// ---------------------------------------------------------------------------
describe('medalForLevel', () => {
  const par = 10;

  it('gold when used === par (ratio 1.0)', () => {
    expect(medalForLevel(10, par)).toBe('gold');
  });
  it('gold when used < par', () => {
    expect(medalForLevel(8, par)).toBe('gold');
  });
  it('silver at exactly 1.5× par', () => {
    expect(medalForLevel(15, par)).toBe('silver');
  });
  it('bronze at exactly 2.5× par', () => {
    expect(medalForLevel(25, par)).toBe('bronze');
  });
  it('none above 2.5× par', () => {
    expect(medalForLevel(26, par)).toBe('none');
  });
  it('none when par is non-positive', () => {
    expect(medalForLevel(5, 0)).toBe('none');
  });
});

// ---------------------------------------------------------------------------
// levelScore points
// ---------------------------------------------------------------------------
describe('levelScore points', () => {
  const par = 12;
  const limitMs = 30_000;

  it('are positive for any valid clear', () => {
    const r = levelScore({ level: 1, used: par, par, timeMs: limitMs, limitMs });
    expect(r.points).toBeGreaterThan(0);
  });

  it('scale with level (higher level → more points, all else equal)', () => {
    const l1 = levelScore({ level: 1, used: par, par, timeMs: 0, limitMs });
    const l2 = levelScore({ level: 2, used: par, par, timeMs: 0, limitMs });
    expect(l2.points).toBeGreaterThan(l1.points);
  });

  it('reward finishing faster (more time left under the limit)', () => {
    const fast = levelScore({ level: 1, used: par, par, timeMs: 2_000, limitMs });
    const slow = levelScore({ level: 1, used: par, par, timeMs: 28_000, limitMs });
    expect(fast.points).toBeGreaterThan(slow.points);
  });

  it('reward efficiency (fewer keystrokes → more points)', () => {
    const efficient = levelScore({ level: 3, used: par - 4, par, timeMs: 10_000, limitMs });
    const wasteful = levelScore({ level: 3, used: par + 4, par, timeMs: 10_000, limitMs });
    expect(efficient.points).toBeGreaterThan(wasteful.points);
  });

  it('include at least the base reward at par with no time left', () => {
    const r = levelScore({ level: 1, used: par, par, timeMs: limitMs, limitMs });
    // base + eff(=BASE at par) → at least BASE_POINTS_PER_LEVEL
    expect(r.points).toBeGreaterThanOrEqual(BASE_POINTS_PER_LEVEL);
  });

  it('echo level/time/used/par/limit back in the result', () => {
    const r = levelScore({ level: 4, used: 7, par: 9, timeMs: 5_000, limitMs: 20_000 });
    expect(r).toMatchObject({ level: 4, used: 7, par: 9, timeMs: 5_000, limitMs: 20_000 });
    expect(r.medal).toBe('gold'); // 7/9 < 1.0
  });
});

// ---------------------------------------------------------------------------
// Time limit
// ---------------------------------------------------------------------------
describe('scheduledLimitMs', () => {
  it('starts generous and ends tight', () => {
    expect(scheduledLimitMs(1)).toBe(LEVEL_START_LIMIT_MS);
    expect(scheduledLimitMs(MAX_LEVEL)).toBe(LEVEL_END_LIMIT_MS);
  });
  it('is monotonically non-increasing across levels', () => {
    let prev = scheduledLimitMs(1);
    for (let lvl = 2; lvl <= MAX_LEVEL; lvl++) {
      const cur = scheduledLimitMs(lvl);
      expect(cur).toBeLessThanOrEqual(prev);
      prev = cur;
    }
  });
});

describe('levelLimitMs', () => {
  it('follows the schedule for normal (small) par values', () => {
    // Vim leaps keep par tiny, so the schedule dominates: same level, same limit.
    expect(levelLimitMs(1, 8)).toBe(scheduledLimitMs(1));
    expect(levelLimitMs(1, 11)).toBe(scheduledLimitMs(1));
  });

  it('shrinks overall from level 1 to the final level', () => {
    expect(levelLimitMs(1, 9)).toBeGreaterThan(levelLimitMs(MAX_LEVEL, 9));
  });

  it('stays within the absolute clamps', () => {
    for (let lvl = 1; lvl <= MAX_LEVEL; lvl++) {
      for (const par of [1, 10, 30, 100, 1000]) {
        const limit = levelLimitMs(lvl, par);
        expect(limit).toBeGreaterThanOrEqual(MIN_LEVEL_LIMIT_MS);
        expect(limit).toBeLessThanOrEqual(MAX_LEVEL_LIMIT_MS);
      }
    }
  });

  it('bumps up to keep an unusually long optimal path winnable', () => {
    // A pathological par far exceeds the schedule → safety floor kicks in.
    const par = 60;
    expect(levelLimitMs(MAX_LEVEL, par)).toBeGreaterThanOrEqual(
      Math.min(MAX_LEVEL_LIMIT_MS, par * SAFETY_MS_PER_KEYSTROKE),
    );
  });
});

// ---------------------------------------------------------------------------
// Deterministic seeds
// ---------------------------------------------------------------------------
describe('seedForLevelMap', () => {
  it('is deterministic for the same (level, index)', () => {
    expect(seedForLevelMap(3, 1)).toBe(seedForLevelMap(3, 1));
  });
  it('differs across indices within a level', () => {
    const seeds = new Set([
      seedForLevelMap(5, 0),
      seedForLevelMap(5, 1),
      seedForLevelMap(5, 2),
    ]);
    expect(seeds.size).toBe(3);
  });
  it('differs across levels for the same index', () => {
    expect(seedForLevelMap(1, 0)).not.toBe(seedForLevelMap(2, 0));
  });
  it('is always a positive 32-bit integer', () => {
    for (let lvl = 1; lvl <= MAX_LEVEL; lvl++) {
      for (let i = 0; i < MAPS_PER_LEVEL; i++) {
        const seed = seedForLevelMap(lvl, i);
        expect(Number.isInteger(seed)).toBe(true);
        expect(seed).toBeGreaterThan(0);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Constants sanity
// ---------------------------------------------------------------------------
describe('exported constants', () => {
  it('MAPS_PER_LEVEL is a positive integer', () => {
    expect(Number.isInteger(MAPS_PER_LEVEL)).toBe(true);
    expect(MAPS_PER_LEVEL).toBeGreaterThan(0);
  });
  it('MAX_LEVEL is at least 1', () => {
    expect(MAX_LEVEL).toBeGreaterThanOrEqual(1);
  });
  it('MIN_LEVEL_LIMIT_MS <= MAX_LEVEL_LIMIT_MS', () => {
    expect(MIN_LEVEL_LIMIT_MS).toBeLessThanOrEqual(MAX_LEVEL_LIMIT_MS);
  });
});
