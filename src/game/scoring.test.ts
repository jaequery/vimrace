/**
 * scoring.test.ts — unit tests for mapBonus and levelForMapsCleared.
 */

import { describe, it, expect } from 'vitest';
import {
  mapBonus,
  levelForMapsCleared,
  INITIAL_CLOCK_MS,
  BASE_BONUS_MS,
  BONUS_MS_PER_SAVED_KEYSTROKE,
  MAX_BONUS_MS,
  BASE_POINTS_PER_MAP,
} from '@/game/scoring';

// ---------------------------------------------------------------------------
// Medal thresholds
// ---------------------------------------------------------------------------
describe('mapBonus medal thresholds', () => {
  const par = 10;
  const time = 10_000;
  const level = 1;

  it('gold when used === par (ratio 1.0)', () => {
    expect(mapBonus({ par, used: 10, timeLeftMs: time, level }).medal).toBe('gold');
  });

  it('gold when used < par (ratio < 1.0)', () => {
    expect(mapBonus({ par, used: 8, timeLeftMs: time, level }).medal).toBe('gold');
  });

  it('silver at exactly 1.5× par (ratio 1.5)', () => {
    expect(mapBonus({ par, used: 15, timeLeftMs: time, level }).medal).toBe('silver');
  });

  it('silver between 1.0 and 1.5', () => {
    expect(mapBonus({ par, used: 12, timeLeftMs: time, level }).medal).toBe('silver');
  });

  it('bronze at exactly 2.5× par (ratio 2.5)', () => {
    expect(mapBonus({ par, used: 25, timeLeftMs: time, level }).medal).toBe('bronze');
  });

  it('bronze between 1.5 and 2.5', () => {
    expect(mapBonus({ par, used: 20, timeLeftMs: time, level }).medal).toBe('bronze');
  });

  it('none above 2.5× par', () => {
    expect(mapBonus({ par, used: 26, timeLeftMs: time, level }).medal).toBe('none');
  });
});

// ---------------------------------------------------------------------------
// Bonus time
// ---------------------------------------------------------------------------
describe('mapBonus bonusTimeMs', () => {
  const par = 10;
  const level = 1;

  it('equals BASE_BONUS_MS when used === par (no saved keystrokes)', () => {
    const result = mapBonus({ par, used: par, timeLeftMs: 5_000, level });
    expect(result.bonusTimeMs).toBe(BASE_BONUS_MS);
  });

  it('increases when fewer keystrokes are used', () => {
    const atPar = mapBonus({ par, used: 10, timeLeftMs: 5_000, level });
    const belowPar = mapBonus({ par, used: 7, timeLeftMs: 5_000, level });
    expect(belowPar.bonusTimeMs).toBeGreaterThan(atPar.bonusTimeMs);
  });

  it('never exceeds MAX_BONUS_MS', () => {
    // used=0 would save all par keystrokes; pick a large par to saturate.
    const result = mapBonus({ par: 100, used: 0, timeLeftMs: 0, level });
    expect(result.bonusTimeMs).toBeLessThanOrEqual(MAX_BONUS_MS);
  });

  it('equals BASE_BONUS_MS + saved*BONUS_MS_PER_SAVED_KEYSTROKE when below cap', () => {
    const used = 5;
    const saved = par - used; // 5
    const expected = Math.min(BASE_BONUS_MS + saved * BONUS_MS_PER_SAVED_KEYSTROKE, MAX_BONUS_MS);
    const result = mapBonus({ par, used, timeLeftMs: 5_000, level });
    expect(result.bonusTimeMs).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// Points
// ---------------------------------------------------------------------------
describe('mapBonus points', () => {
  const par = 10;
  const level = 1;

  it('are positive for any valid clear', () => {
    const result = mapBonus({ par, used: par, timeLeftMs: 0, level });
    expect(result.points).toBeGreaterThan(0);
  });

  it('include a base proportional to level', () => {
    const l1 = mapBonus({ par, used: par, timeLeftMs: 0, level: 1 });
    const l2 = mapBonus({ par, used: par, timeLeftMs: 0, level: 2 });
    expect(l2.points).toBeGreaterThan(l1.points);
  });

  it('are higher with time remaining (speed bonus)', () => {
    const fast = mapBonus({ par, used: par, timeLeftMs: 20_000, level });
    const slow = mapBonus({ par, used: par, timeLeftMs: 0, level });
    expect(fast.points).toBeGreaterThan(slow.points);
  });

  it('reflect BASE_POINTS_PER_MAP in the base', () => {
    // At exactly par with no time left, the base should be at minimum
    // BASE_POINTS_PER_MAP * level (efficiency multiplier at ratio=1 is 1, so eff=BASE*level too)
    const result = mapBonus({ par, used: par, timeLeftMs: 0, level: 1 });
    expect(result.points).toBeGreaterThanOrEqual(BASE_POINTS_PER_MAP);
  });
});

// ---------------------------------------------------------------------------
// Monotonicity — fewer keystrokes must never yield worse reward
// ---------------------------------------------------------------------------
describe('mapBonus monotonicity', () => {
  const par = 10;
  const level = 3;
  const time = 15_000;

  it('more efficient (fewer keystrokes) never yields fewer points', () => {
    for (let used = 1; used <= 30; used++) {
      const fewer = mapBonus({ par, used: used - 1 >= 1 ? used - 1 : 1, timeLeftMs: time, level });
      const more = mapBonus({ par, used, timeLeftMs: time, level });
      if (used > 1) {
        expect(fewer.points).toBeGreaterThanOrEqual(more.points);
      }
    }
  });

  it('more efficient never yields less bonus time', () => {
    for (let used = 1; used <= 30; used++) {
      const fewer = mapBonus({ par, used: used - 1 >= 1 ? used - 1 : 1, timeLeftMs: time, level });
      const more = mapBonus({ par, used, timeLeftMs: time, level });
      if (used > 1) {
        expect(fewer.bonusTimeMs).toBeGreaterThanOrEqual(more.bonusTimeMs);
      }
    }
  });

  it('at-par beats over-par on points', () => {
    const atPar = mapBonus({ par, used: par, timeLeftMs: time, level });
    const overPar = mapBonus({ par, used: par + 5, timeLeftMs: time, level });
    expect(atPar.points).toBeGreaterThan(overPar.points);
  });
});

// ---------------------------------------------------------------------------
// MapResult fields are echoed back
// ---------------------------------------------------------------------------
describe('mapBonus result fields', () => {
  it('echoes used and par correctly', () => {
    const result = mapBonus({ par: 8, used: 6, timeLeftMs: 5_000, level: 2 });
    expect(result.used).toBe(6);
    expect(result.par).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// levelForMapsCleared ramp
// ---------------------------------------------------------------------------
describe('levelForMapsCleared', () => {
  it('starts at level 1 for 0 maps cleared', () => {
    expect(levelForMapsCleared(0)).toBe(1);
  });

  it('stays at level 1 for maps 0–2', () => {
    expect(levelForMapsCleared(1)).toBe(1);
    expect(levelForMapsCleared(2)).toBe(1);
  });

  it('advances to level 2 at 3 maps cleared', () => {
    expect(levelForMapsCleared(3)).toBe(2);
  });

  it('advances to level 3 at 6 maps cleared', () => {
    expect(levelForMapsCleared(6)).toBe(3);
  });

  it('caps at level 20', () => {
    expect(levelForMapsCleared(1000)).toBe(20);
  });

  it('is non-decreasing', () => {
    let prev = levelForMapsCleared(0);
    for (let n = 1; n <= 100; n++) {
      const cur = levelForMapsCleared(n);
      expect(cur).toBeGreaterThanOrEqual(prev);
      prev = cur;
    }
  });
});

// ---------------------------------------------------------------------------
// Exported constants sanity
// ---------------------------------------------------------------------------
describe('exported constants', () => {
  it('INITIAL_CLOCK_MS is positive', () => {
    expect(INITIAL_CLOCK_MS).toBeGreaterThan(0);
  });

  it('BASE_BONUS_MS is positive', () => {
    expect(BASE_BONUS_MS).toBeGreaterThan(0);
  });

  it('MAX_BONUS_MS >= BASE_BONUS_MS', () => {
    expect(MAX_BONUS_MS).toBeGreaterThanOrEqual(BASE_BONUS_MS);
  });
});
