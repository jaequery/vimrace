/**
 * vimEngine.test.ts — unit tests for applyMotion and isGoalReached (maze).
 *
 * Test map convention:
 *   T (true)  = wall  (impassable)
 *   F (false) = floor (walkable — the cursor stands here)
 *
 * Step motions (h/j/k/l) collide with walls. Leap motions (w/b/e/0/$) hop over
 * walls within the row and always land on floor.
 */

import { describe, it, expect } from 'vitest';
import { applyMotion, isGoalReached } from '@/game/vimEngine';
import type { GameMap, Pos } from '@/game/types';

// ---------------------------------------------------------------------------
// Helpers to build minimal test maps
// ---------------------------------------------------------------------------

const T = true; // wall
const F = false; // floor

/** Build a GameMap from a 2-D boolean grid. start/goal/par are placeholders. */
function makeMap(grid: boolean[][]): GameMap {
  const rows = grid.length;
  const cols = grid[0].length;
  return {
    rows,
    cols,
    grid,
    start: { row: 0, col: 0 },
    goal: { row: rows - 1, col: cols - 1 },
    level: 1,
    seed: 0,
    par: 1,
  };
}

function pos(row: number, col: number): Pos {
  return { row, col };
}

// ---------------------------------------------------------------------------
// Canonical test maze (4 rows × 8 cols)
//
// Row 0: F F T T F F F T   floor corridors: [0,1] [4,6]
// Row 1: F T T F F T F F   floor corridors: [0,0] [3,4] [6,7]
// Row 2: F F F T T F F F   floor corridors: [0,2] [5,7]
// Row 3: T F F F T F T F   floor corridors: [1,3] [5,5] [7,7]
// ---------------------------------------------------------------------------

const MAZE = makeMap([
  [F, F, T, T, F, F, F, T],
  [F, T, T, F, F, T, F, F],
  [F, F, F, T, T, F, F, F],
  [T, F, F, F, T, F, T, F],
]);

// ---------------------------------------------------------------------------
// h — step left, blocked by walls / bounds
// ---------------------------------------------------------------------------
describe('h (step left)', () => {
  it('moves one cell left onto floor', () => {
    expect(applyMotion(MAZE, pos(0, 1), 'h')).toEqual(pos(0, 0));
  });
  it('is blocked by a wall to the left (stays put)', () => {
    // (0,4): left is (0,3) = wall → no move
    expect(applyMotion(MAZE, pos(0, 4), 'h')).toEqual(pos(0, 4));
  });
  it('is blocked at the left edge', () => {
    expect(applyMotion(MAZE, pos(1, 0), 'h')).toEqual(pos(1, 0));
  });
});

// ---------------------------------------------------------------------------
// l — step right, blocked by walls / bounds
// ---------------------------------------------------------------------------
describe('l (step right)', () => {
  it('moves one cell right onto floor', () => {
    expect(applyMotion(MAZE, pos(0, 0), 'l')).toEqual(pos(0, 1));
  });
  it('is blocked by a wall to the right (stays put)', () => {
    // (0,1): right is (0,2) = wall → no move
    expect(applyMotion(MAZE, pos(0, 1), 'l')).toEqual(pos(0, 1));
  });
  it('is blocked at the right edge', () => {
    expect(applyMotion(MAZE, pos(1, 7), 'l')).toEqual(pos(1, 7));
  });
});

// ---------------------------------------------------------------------------
// j — step down, blocked by walls / bounds
// ---------------------------------------------------------------------------
describe('j (step down)', () => {
  it('moves one row down onto floor', () => {
    // col 0 is floor in rows 0,1,2
    expect(applyMotion(MAZE, pos(0, 0), 'j')).toEqual(pos(1, 0));
  });
  it('is blocked by a wall below (stays put)', () => {
    // (0,5): below is (1,5) = wall → no move
    expect(applyMotion(MAZE, pos(0, 5), 'j')).toEqual(pos(0, 5));
  });
  it('is blocked at the bottom edge', () => {
    expect(applyMotion(MAZE, pos(3, 1), 'j')).toEqual(pos(3, 1));
  });
});

// ---------------------------------------------------------------------------
// k — step up, blocked by walls / bounds
// ---------------------------------------------------------------------------
describe('k (step up)', () => {
  it('moves one row up onto floor', () => {
    expect(applyMotion(MAZE, pos(1, 0), 'k')).toEqual(pos(0, 0));
  });
  it('is blocked by a wall above (stays put)', () => {
    // (2,1): above is (1,1) = wall → no move
    expect(applyMotion(MAZE, pos(2, 1), 'k')).toEqual(pos(2, 1));
  });
  it('is blocked at the top edge', () => {
    expect(applyMotion(MAZE, pos(0, 1), 'k')).toEqual(pos(0, 1));
  });
});

// ---------------------------------------------------------------------------
// 0 — leap to leftmost floor cell of the row
// ---------------------------------------------------------------------------
describe('0 (row start)', () => {
  it('jumps to the leftmost floor cell', () => {
    expect(applyMotion(MAZE, pos(0, 5), '0')).toEqual(pos(0, 0));
  });
  it('hops over a leading wall to the first floor cell', () => {
    // Row 3 col 0 is a wall; leftmost floor is col 1
    expect(applyMotion(MAZE, pos(3, 5), '0')).toEqual(pos(3, 1));
  });
  it('stays when already at the leftmost floor cell', () => {
    expect(applyMotion(MAZE, pos(0, 0), '0')).toEqual(pos(0, 0));
  });
});

// ---------------------------------------------------------------------------
// $ — leap to rightmost floor cell of the row
// ---------------------------------------------------------------------------
describe('$ (row end)', () => {
  it('jumps to the rightmost floor cell, hopping a trailing wall', () => {
    // Row 0 col 7 is a wall; rightmost floor is col 6
    expect(applyMotion(MAZE, pos(0, 0), '$')).toEqual(pos(0, 6));
  });
  it('jumps to the last col when it is floor', () => {
    expect(applyMotion(MAZE, pos(1, 0), '$')).toEqual(pos(1, 7));
  });
  it('stays when already at the rightmost floor cell', () => {
    expect(applyMotion(MAZE, pos(1, 7), '$')).toEqual(pos(1, 7));
  });
});

// ---------------------------------------------------------------------------
// w — hop right to the start of the next corridor
// Row 0 corridors: [0,1] [4,6]   Row 1 corridors: [0,0] [3,4] [6,7]
// ---------------------------------------------------------------------------
describe('w (hop wall →)', () => {
  it('hops over the wall to the start of the next corridor', () => {
    expect(applyMotion(MAZE, pos(0, 0), 'w')).toEqual(pos(0, 4));
  });
  it('from inside the first corridor → next corridor start', () => {
    expect(applyMotion(MAZE, pos(0, 1), 'w')).toEqual(pos(0, 4));
  });
  it('no corridor further right → rightmost floor cell', () => {
    expect(applyMotion(MAZE, pos(0, 4), 'w')).toEqual(pos(0, 6));
  });
  it('chains across multiple corridors', () => {
    expect(applyMotion(MAZE, pos(1, 0), 'w')).toEqual(pos(1, 3));
    expect(applyMotion(MAZE, pos(1, 3), 'w')).toEqual(pos(1, 6));
  });
  it('does not wrap to another row', () => {
    expect(applyMotion(MAZE, pos(0, 4), 'w').row).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// b — hop left to the start of the current / previous corridor
// Row 1 corridors: [0,0] [3,4] [6,7]
// ---------------------------------------------------------------------------
describe('b (← hop wall)', () => {
  it('snaps to the left edge of the current corridor', () => {
    expect(applyMotion(MAZE, pos(1, 4), 'b')).toEqual(pos(1, 3));
  });
  it('from a corridor start → hops left to previous corridor start', () => {
    expect(applyMotion(MAZE, pos(1, 3), 'b')).toEqual(pos(1, 0));
  });
  it('hops back across multiple corridors', () => {
    expect(applyMotion(MAZE, pos(1, 6), 'b')).toEqual(pos(1, 3));
  });
  it('at the leftmost corridor → stays', () => {
    expect(applyMotion(MAZE, pos(1, 0), 'b')).toEqual(pos(1, 0));
  });
  it('does not wrap to another row', () => {
    expect(applyMotion(MAZE, pos(1, 6), 'b').row).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// e — hop right to the end of the current / next corridor
// Row 0 corridors: [0,1] [4,6]   Row 1 corridors: [0,0] [3,4] [6,7]
// ---------------------------------------------------------------------------
describe('e (hop to end)', () => {
  it('snaps to the right edge of the current corridor', () => {
    expect(applyMotion(MAZE, pos(0, 0), 'e')).toEqual(pos(0, 1));
  });
  it('from a corridor end → hops to the end of the next corridor', () => {
    expect(applyMotion(MAZE, pos(0, 1), 'e')).toEqual(pos(0, 6));
  });
  it('from a single-cell corridor → end of the next corridor', () => {
    // Row 1 corridor [0,0] is one cell; next corridor [3,4] ends at 4
    expect(applyMotion(MAZE, pos(1, 0), 'e')).toEqual(pos(1, 4));
  });
  it('no corridor further right → rightmost floor cell', () => {
    expect(applyMotion(MAZE, pos(0, 6), 'e')).toEqual(pos(0, 6));
  });
  it('does not wrap to another row', () => {
    expect(applyMotion(MAZE, pos(0, 1), 'e').row).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Vertical leaps — gg / G / pgup / pgdn hop over walls along the column.
//
//       c0 c1 c2
// row0:  F  F  F
// row1:  T  F  F
// row2:  T  T  F
// row3:  F  F  F
// row4:  F  F  F
//
// col 0 floor rows: {0, 3, 4}   col 2 floor rows: {0,1,2,3,4}
// A "page" here = floor(5/2) = 2 rows.
// ---------------------------------------------------------------------------

const VMAZE = makeMap([
  [F, F, F],
  [T, F, F],
  [T, T, F],
  [F, F, F],
  [F, F, F],
]);

describe('gg (hop to top of column)', () => {
  it('jumps to the topmost floor cell, hopping walls above', () => {
    // col 0 from row 3: floors {0,3,4}, topmost = 0 (rows 1,2 are walls)
    expect(applyMotion(VMAZE, pos(3, 0), 'gg')).toEqual(pos(0, 0));
  });
  it('jumps to row 0 in a fully open column', () => {
    expect(applyMotion(VMAZE, pos(4, 2), 'gg')).toEqual(pos(0, 2));
  });
  it('stays when already at the topmost floor cell', () => {
    expect(applyMotion(VMAZE, pos(0, 0), 'gg')).toEqual(pos(0, 0));
  });
  it('does not change column', () => {
    expect(applyMotion(VMAZE, pos(3, 0), 'gg').col).toBe(0);
  });
});

describe('G (hop to bottom of column)', () => {
  it('jumps to the bottommost floor cell', () => {
    expect(applyMotion(VMAZE, pos(0, 0), 'G')).toEqual(pos(4, 0));
  });
  it('jumps to the last row in a fully open column', () => {
    expect(applyMotion(VMAZE, pos(0, 2), 'G')).toEqual(pos(4, 2));
  });
  it('stays when already at the bottommost floor cell', () => {
    expect(applyMotion(VMAZE, pos(4, 2), 'G')).toEqual(pos(4, 2));
  });
});

describe('pgdn (page down)', () => {
  it('jumps ~half the grid down in an open column', () => {
    // from row 0, target = min(4, 0+2) = 2 → (2,2)
    expect(applyMotion(VMAZE, pos(0, 2), 'pgdn')).toEqual(pos(2, 2));
  });
  it('lands on the nearest column floor when the target is a wall', () => {
    // from (0,0): target row 2 is a wall in col 0; nearest floor {0,3,4} = row 3
    expect(applyMotion(VMAZE, pos(0, 0), 'pgdn')).toEqual(pos(3, 0));
  });
  it('does not move past the bottom edge', () => {
    expect(applyMotion(VMAZE, pos(4, 2), 'pgdn')).toEqual(pos(4, 2));
  });
});

describe('pgup (page up)', () => {
  it('jumps ~half the grid up in an open column', () => {
    // from row 4, target = max(0, 4-2) = 2 → (2,2)
    expect(applyMotion(VMAZE, pos(4, 2), 'pgup')).toEqual(pos(2, 2));
  });
  it('lands on the nearest column floor when the target is a wall', () => {
    // from (4,0): target row 2 is a wall in col 0; nearest floor {0,3,4} = row 3
    expect(applyMotion(VMAZE, pos(4, 0), 'pgup')).toEqual(pos(3, 0));
  });
  it('does not move past the top edge', () => {
    expect(applyMotion(VMAZE, pos(0, 2), 'pgup')).toEqual(pos(0, 2));
  });
});

// ---------------------------------------------------------------------------
// Edge: single floor cell (1×1)
// ---------------------------------------------------------------------------
describe('single floor-cell map', () => {
  const TINY = makeMap([[F]]);

  for (const m of ['h', 'j', 'k', 'l', 'w', 'b', 'e', '0', '$', 'gg', 'G', 'pgup', 'pgdn'] as const) {
    it(`${m} stays at (0,0)`, () =>
      expect(applyMotion(TINY, pos(0, 0), m)).toEqual(pos(0, 0)));
  }
});

// ---------------------------------------------------------------------------
// Edge: a fully walled row — leaps must not invent an illegal position
// (the cursor never legally sits here in play, but the engine must be safe).
// ---------------------------------------------------------------------------
describe('fully walled row', () => {
  const WALLED = makeMap([[T, T, T, T]]);

  for (const m of ['w', 'b', 'e', '0', '$', 'gg', 'G', 'pgup', 'pgdn'] as const) {
    it(`${m} leaves the cursor in place`, () =>
      expect(applyMotion(WALLED, pos(0, 2), m)).toEqual(pos(0, 2)));
  }
});

// ---------------------------------------------------------------------------
// isGoalReached
// ---------------------------------------------------------------------------
describe('isGoalReached', () => {
  it('returns true when cursor is at goal', () => {
    expect(isGoalReached(MAZE, MAZE.goal)).toBe(true);
  });
  it('returns false when cursor is not at goal', () => {
    expect(isGoalReached(MAZE, MAZE.start)).toBe(false);
  });
  it('false for position adjacent to goal', () => {
    const near = pos(MAZE.goal.row, MAZE.goal.col - 1);
    expect(isGoalReached(MAZE, near)).toBe(false);
  });
});
