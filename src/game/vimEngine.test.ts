/**
 * vimEngine.test.ts — unit tests for applyMotion and isGoalReached.
 *
 * Test map convention:
 *   T (true)  = filled cell (word character)
 *   F (false) = blank cell (space)
 *
 * Most tests use a small hand-crafted map so expected outcomes are obvious.
 */

import { describe, it, expect } from 'vitest';
import { applyMotion, isGoalReached } from '@/game/vimEngine';
import type { GameMap, Pos } from '@/game/types';

// ---------------------------------------------------------------------------
// Helpers to build minimal test maps
// ---------------------------------------------------------------------------

const T = true;
const F = false;

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
// Canonical test map (4 rows × 8 cols)
//
// Row 0: F T T F T T F F   (words: [1,2], [4,5])
// Row 1: T T F F F T T F   (words: [0,1], [5,6])
// Row 2: F F T T T F F T   (words: [2,4], [7,7])
// Row 3: T T F T T T F F   (words: [0,1], [3,5])
// ---------------------------------------------------------------------------

const MAP = makeMap([
  [F, T, T, F, T, T, F, F],
  [T, T, F, F, F, T, T, F],
  [F, F, T, T, T, F, F, T],
  [T, T, F, T, T, T, F, F],
]);

// ---------------------------------------------------------------------------
// h — move left, clamp at col 0
// ---------------------------------------------------------------------------
describe('h', () => {
  it('moves one cell left', () => {
    expect(applyMotion(MAP, pos(0, 3), 'h')).toEqual(pos(0, 2));
  });
  it('clamps at col 0', () => {
    expect(applyMotion(MAP, pos(1, 0), 'h')).toEqual(pos(1, 0));
  });
  it('does not change row', () => {
    const r = applyMotion(MAP, pos(2, 4), 'h');
    expect(r.row).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// l — move right, clamp at last col
// ---------------------------------------------------------------------------
describe('l', () => {
  it('moves one cell right', () => {
    expect(applyMotion(MAP, pos(0, 2), 'l')).toEqual(pos(0, 3));
  });
  it('clamps at last col', () => {
    expect(applyMotion(MAP, pos(0, 7), 'l')).toEqual(pos(0, 7));
  });
  it('does not change row', () => {
    const r = applyMotion(MAP, pos(3, 2), 'l');
    expect(r.row).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// j — move one row down, preserve col, clamp at last row
// ---------------------------------------------------------------------------
describe('j', () => {
  it('moves one row down', () => {
    expect(applyMotion(MAP, pos(0, 3), 'j')).toEqual(pos(1, 3));
  });
  it('clamps at last row', () => {
    expect(applyMotion(MAP, pos(3, 2), 'j')).toEqual(pos(3, 2));
  });
  it('preserves column', () => {
    expect(applyMotion(MAP, pos(1, 5), 'j').col).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// k — move one row up, preserve col, clamp at row 0
// ---------------------------------------------------------------------------
describe('k', () => {
  it('moves one row up', () => {
    expect(applyMotion(MAP, pos(2, 4), 'k')).toEqual(pos(1, 4));
  });
  it('clamps at row 0', () => {
    expect(applyMotion(MAP, pos(0, 5), 'k')).toEqual(pos(0, 5));
  });
  it('preserves column', () => {
    expect(applyMotion(MAP, pos(3, 3), 'k').col).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// 0 — jump to col 0
// ---------------------------------------------------------------------------
describe('0', () => {
  it('jumps to col 0 from the middle', () => {
    expect(applyMotion(MAP, pos(1, 5), '0')).toEqual(pos(1, 0));
  });
  it('stays at col 0 when already there', () => {
    expect(applyMotion(MAP, pos(0, 0), '0')).toEqual(pos(0, 0));
  });
  it('does not change row', () => {
    expect(applyMotion(MAP, pos(2, 7), '0').row).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// $ — jump to last col
// ---------------------------------------------------------------------------
describe('$', () => {
  it('jumps to last col from the middle', () => {
    expect(applyMotion(MAP, pos(0, 2), '$')).toEqual(pos(0, 7));
  });
  it('stays at last col when already there', () => {
    expect(applyMotion(MAP, pos(3, 7), '$')).toEqual(pos(3, 7));
  });
  it('does not change row', () => {
    expect(applyMotion(MAP, pos(1, 0), '$').row).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// w — next word start on the same row
// Row 0: F T T F T T F F   (words: [1,2], [4,5])
// ---------------------------------------------------------------------------
describe('w', () => {
  it('from inside first word → lands on start of second word', () => {
    // cursor at col 1 (inside word [1,2]), next word starts at col 4
    expect(applyMotion(MAP, pos(0, 1), 'w')).toEqual(pos(0, 4));
  });
  it('from blank before first word → lands on first word start', () => {
    // cursor at col 0 (blank), first word starts at col 1
    expect(applyMotion(MAP, pos(0, 0), 'w')).toEqual(pos(0, 1));
  });
  it('from last word → lands on last cell of row (no next word)', () => {
    // cursor at col 4 (start of second word [4,5]), no further word
    expect(applyMotion(MAP, pos(0, 4), 'w')).toEqual(pos(0, 7));
  });
  it('from end of last word → stays at last cell of row', () => {
    // cursor at col 5 (end of last word), still no next word
    expect(applyMotion(MAP, pos(0, 5), 'w')).toEqual(pos(0, 7));
  });
  it('from last cell of row already → stays there', () => {
    expect(applyMotion(MAP, pos(0, 7), 'w')).toEqual(pos(0, 7));
  });
  it('does not wrap to another row', () => {
    expect(applyMotion(MAP, pos(0, 5), 'w').row).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// b — word start at/left of cursor on the same row
// Row 1: T T F F F T T F   (words: [0,1], [5,6])
// ---------------------------------------------------------------------------
describe('b', () => {
  it('from inside a word (not at its start) → lands on word start', () => {
    // cursor at col 1 (inside word [0,1]), start is col 0
    expect(applyMotion(MAP, pos(1, 1), 'b')).toEqual(pos(1, 0));
  });
  it('from start of second word → lands on start of first word', () => {
    // cursor at col 5 (start of [5,6]), previous word starts at col 0
    expect(applyMotion(MAP, pos(1, 5), 'b')).toEqual(pos(1, 0));
  });
  it('from blank between words → lands on start of word to the left', () => {
    // cursor at col 3 (blank), word to the left is [0,1], start = 0
    expect(applyMotion(MAP, pos(1, 3), 'b')).toEqual(pos(1, 0));
  });
  it('from start of first word → lands on col 0 (no prior word)', () => {
    expect(applyMotion(MAP, pos(1, 0), 'b')).toEqual(pos(1, 0));
  });
  it('from blank before any word → lands on col 0', () => {
    // Row 0 col 0 is blank, no word to the left
    expect(applyMotion(MAP, pos(0, 0), 'b')).toEqual(pos(0, 0));
  });
  it('does not wrap to another row', () => {
    expect(applyMotion(MAP, pos(1, 5), 'b').row).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// e — last cell of next word on the same row
// Row 0: F T T F T T F F   (words: [1,2], [4,5])
// Row 2: F F T T T F F T   (words: [2,4], [7,7])
// ---------------------------------------------------------------------------
describe('e', () => {
  it('from start of a word → lands on end of that word', () => {
    // cursor at col 1 (start of [1,2]), end is col 2
    expect(applyMotion(MAP, pos(0, 1), 'e')).toEqual(pos(0, 2));
  });
  it('from end of a word → lands on end of NEXT word', () => {
    // cursor at col 2 (end of [1,2]), next word ends at col 5
    expect(applyMotion(MAP, pos(0, 2), 'e')).toEqual(pos(0, 5));
  });
  it('from blank → lands on end of next word to the right', () => {
    // cursor at col 0 (blank), next word is [1,2] → end col 2
    expect(applyMotion(MAP, pos(0, 0), 'e')).toEqual(pos(0, 2));
  });
  it('from last word (single-cell word at col 7) → lands on last cell of row', () => {
    // Row 2: last word is [7,7]; cursor at col 7 (end), no next word
    expect(applyMotion(MAP, pos(2, 7), 'e')).toEqual(pos(2, 7));
  });
  it('from last word end → stays at last cell of row', () => {
    // cursor at col 5 (end of [4,5]), no next word → last col = 7
    expect(applyMotion(MAP, pos(0, 5), 'e')).toEqual(pos(0, 7));
  });
  it('does not wrap to another row', () => {
    expect(applyMotion(MAP, pos(0, 2), 'e').row).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Edge: single-cell map (1 row × 1 col, filled)
// ---------------------------------------------------------------------------
describe('single-cell map', () => {
  const TINY = makeMap([[T]]);

  it('h stays at (0,0)', () => expect(applyMotion(TINY, pos(0, 0), 'h')).toEqual(pos(0, 0)));
  it('l stays at (0,0)', () => expect(applyMotion(TINY, pos(0, 0), 'l')).toEqual(pos(0, 0)));
  it('j stays at (0,0)', () => expect(applyMotion(TINY, pos(0, 0), 'j')).toEqual(pos(0, 0)));
  it('k stays at (0,0)', () => expect(applyMotion(TINY, pos(0, 0), 'k')).toEqual(pos(0, 0)));
  it('w stays at (0,0)', () => expect(applyMotion(TINY, pos(0, 0), 'w')).toEqual(pos(0, 0)));
  it('b stays at (0,0)', () => expect(applyMotion(TINY, pos(0, 0), 'b')).toEqual(pos(0, 0)));
  it('e stays at (0,0)', () => expect(applyMotion(TINY, pos(0, 0), 'e')).toEqual(pos(0, 0)));
});

// ---------------------------------------------------------------------------
// Edge: single-row map (1 row × 6 cols)
// Row 0: T T F T T T   (words: [0,1], [3,5])
// ---------------------------------------------------------------------------
describe('single-row map', () => {
  const SR = makeMap([[T, T, F, T, T, T]]);

  it('j stays on row 0', () => expect(applyMotion(SR, pos(0, 2), 'j').row).toBe(0));
  it('k stays on row 0', () => expect(applyMotion(SR, pos(0, 2), 'k').row).toBe(0));
  it('w from col 0 → col 3 (next word)', () => expect(applyMotion(SR, pos(0, 0), 'w')).toEqual(pos(0, 3)));
  it('w from col 3 → col 5 (last cell, no further word)', () => expect(applyMotion(SR, pos(0, 3), 'w')).toEqual(pos(0, 5)));
  it('b from col 4 → col 3 (start of current word)', () => expect(applyMotion(SR, pos(0, 4), 'b')).toEqual(pos(0, 3)));
  it('b from col 3 → col 0 (start of prior word)', () => expect(applyMotion(SR, pos(0, 3), 'b')).toEqual(pos(0, 0)));
  it('e from col 0 → col 1 (end of current word)', () => expect(applyMotion(SR, pos(0, 0), 'e')).toEqual(pos(0, 1)));
  it('e from col 1 → col 5 (end of next word)', () => expect(applyMotion(SR, pos(0, 1), 'e')).toEqual(pos(0, 5)));
});

// ---------------------------------------------------------------------------
// Edge: cursor on a blank cell — word motions still work correctly
// Row 3: T T F T T T F F   (words: [0,1], [3,5])
// ---------------------------------------------------------------------------
describe('cursor on blank cell', () => {
  it('w from blank (col 2) → next word start (col 3)', () => {
    expect(applyMotion(MAP, pos(3, 2), 'w')).toEqual(pos(3, 3));
  });
  it('b from blank (col 2) → prior word start (col 0)', () => {
    expect(applyMotion(MAP, pos(3, 2), 'b')).toEqual(pos(3, 0));
  });
  it('e from blank (col 2) → end of next word (col 5)', () => {
    expect(applyMotion(MAP, pos(3, 2), 'e')).toEqual(pos(3, 5));
  });
});

// ---------------------------------------------------------------------------
// isGoalReached
// ---------------------------------------------------------------------------
describe('isGoalReached', () => {
  it('returns true when cursor is at goal', () => {
    expect(isGoalReached(MAP, MAP.goal)).toBe(true);
  });
  it('returns false when cursor is not at goal', () => {
    expect(isGoalReached(MAP, MAP.start)).toBe(false);
  });
  it('false for position adjacent to goal', () => {
    const near = pos(MAP.goal.row, MAP.goal.col - 1);
    expect(isGoalReached(MAP, near)).toBe(false);
  });
});
