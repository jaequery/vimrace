/**
 * map.test.ts — unit tests for generateMap and parKeystrokes.
 */

import { describe, it, expect } from 'vitest';
import { generateMap, parKeystrokes } from '@/game/map';

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------
describe('generateMap determinism', () => {
  it('returns identical maps for the same seed and level', () => {
    const a = generateMap({ level: 1, seed: 42 });
    const b = generateMap({ level: 1, seed: 42 });
    expect(a.grid).toEqual(b.grid);
    expect(a.start).toEqual(b.start);
    expect(a.goal).toEqual(b.goal);
    expect(a.par).toBe(b.par);
    expect(a.rows).toBe(b.rows);
    expect(a.cols).toBe(b.cols);
  });

  it('returns different maps for different seeds', () => {
    const a = generateMap({ level: 1, seed: 1 });
    const b = generateMap({ level: 1, seed: 99999 });
    // It's astronomically unlikely they are the same.
    expect(a.grid).not.toEqual(b.grid);
  });

  it('returns different maps for different levels (same seed)', () => {
    const a = generateMap({ level: 1, seed: 7 });
    const b = generateMap({ level: 5, seed: 7 });
    // Different levels → different grid dimensions or layout.
    const sameSize = a.rows === b.rows && a.cols === b.cols;
    const sameGrid = JSON.stringify(a.grid) === JSON.stringify(b.grid);
    expect(sameSize && sameGrid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Structural invariants
// ---------------------------------------------------------------------------
describe('generateMap invariants', () => {
  const SEEDS = [0, 1, 42, 1337, 99999];
  const LEVELS = [1, 2, 4, 7, 10];

  for (const level of LEVELS) {
    for (const seed of SEEDS) {
      it(`level=${level} seed=${seed}: start/goal on floor cells, distinct, par>0, positions in bounds`, () => {
        const map = generateMap({ level, seed });

        // Grid dimensions match declared rows/cols.
        expect(map.grid.length).toBe(map.rows);
        for (const row of map.grid) {
          expect(row.length).toBe(map.cols);
        }

        // start is on a floor cell (the cursor must be able to stand there).
        expect(map.grid[map.start.row][map.start.col]).toBe(false);

        // goal is on a floor cell.
        expect(map.grid[map.goal.row][map.goal.col]).toBe(false);

        // start ≠ goal.
        expect(map.start).not.toEqual(map.goal);

        // positions within grid bounds.
        expect(map.start.row).toBeGreaterThanOrEqual(0);
        expect(map.start.row).toBeLessThan(map.rows);
        expect(map.start.col).toBeGreaterThanOrEqual(0);
        expect(map.start.col).toBeLessThan(map.cols);
        expect(map.goal.row).toBeGreaterThanOrEqual(0);
        expect(map.goal.row).toBeLessThan(map.rows);
        expect(map.goal.col).toBeGreaterThanOrEqual(0);
        expect(map.goal.col).toBeLessThan(map.cols);

        // par is finite and positive.
        expect(isFinite(map.par)).toBe(true);
        expect(map.par).toBeGreaterThan(0);

        // par is consistent with parKeystrokes.
        expect(parKeystrokes(map)).toBe(map.par);
      });
    }
  }
});

// ---------------------------------------------------------------------------
// Grid size scaling
// ---------------------------------------------------------------------------
describe('generateMap grid size scales with level', () => {
  it('level 1 starts small', () => {
    const m = generateMap({ level: 1, seed: 5 });
    expect(m.rows).toBeGreaterThanOrEqual(6);
    expect(m.cols).toBeGreaterThanOrEqual(14);
  });

  it('level 10 is larger than level 1', () => {
    const lo = generateMap({ level: 1, seed: 5 });
    const hi = generateMap({ level: 10, seed: 5 });
    expect(hi.rows * hi.cols).toBeGreaterThan(lo.rows * lo.cols);
  });

  it('never exceeds max bounds', () => {
    const m = generateMap({ level: 20, seed: 5 });
    expect(m.rows).toBeLessThanOrEqual(18);
    expect(m.cols).toBeLessThanOrEqual(36);
  });
});

// ---------------------------------------------------------------------------
// Solvability — parKeystrokes returns a finite positive number
// ---------------------------------------------------------------------------
describe('parKeystrokes solvability', () => {
  it('is always finite for generated maps', () => {
    for (let level = 1; level <= 5; level++) {
      for (let seed = 0; seed < 5; seed++) {
        const map = generateMap({ level, seed });
        expect(isFinite(parKeystrokes(map))).toBe(true);
      }
    }
  });

  it('stays small and positive at every level (leaps keep optimal paths short)', () => {
    // The wall-hopping leap motions (row-wise w/b/e/0/$ and column-wise
    // gg/G/PageUp/PageDown) let an expert cross any maze in a handful of
    // moves, so par no longer grows with level — it stays a small, finite,
    // positive number. The difficulty ramp lives in grid SIZE (see the
    // "grid size scales with level" suite) and the clock, not in par.
    for (const level of [1, 3, 5, 8, 12]) {
      for (let s = 0; s < 8; s++) {
        const par = generateMap({ level, seed: s }).par;
        expect(par).toBeGreaterThan(0);
        expect(par).toBeLessThanOrEqual(12);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// seed field is preserved on map
// ---------------------------------------------------------------------------
describe('map seed field', () => {
  it('records the caller-supplied seed', () => {
    const map = generateMap({ level: 1, seed: 12345 });
    expect(map.seed).toBe(12345);
  });

  it('level field matches the requested level', () => {
    const map = generateMap({ level: 3, seed: 7 });
    expect(map.level).toBe(3);
  });
});
