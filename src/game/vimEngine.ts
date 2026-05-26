/**
 * vimEngine.ts — pure Vim-motion logic for VimRace (maze edition).
 *
 * Maze model:
 *   - Wall cells   (grid[r][c] === true)  → impassable
 *   - Floor cells  (grid[r][c] === false) → open; the cursor stands on floor
 *
 * Two families of motion:
 *
 *   STEP — h/j/k/l. Move exactly one cell. They COLLIDE with walls: if the
 *   target cell is a wall (or out of bounds) the cursor stays put.
 *
 *   LEAP — w/b/e/0/$. Operate within the current row only (never wrap) and are
 *   allowed to jump OVER walls, always landing on a floor cell. A "corridor" is
 *   a maximal contiguous run of floor cells in a row; leaps move between
 *   corridors, treating the walls between them as gaps to hop across.
 *
 * Leap edge-case decisions (documented so MOTION_HELP can stay honest):
 *   w  Jump to the FIRST floor cell of the next corridor to the right (hopping
 *      the wall between). If there is no corridor further right, land on the
 *      rightmost floor cell of the row.
 *   b  If not already at the left edge of the current corridor, jump to that
 *      edge; otherwise hop left over the wall to the LEFT edge of the previous
 *      corridor. If none exists, land on the leftmost floor cell of the row.
 *   e  If not already at the right edge of the current corridor, jump to that
 *      edge; otherwise hop right to the RIGHT edge of the next corridor. If
 *      none exists, land on the rightmost floor cell of the row.
 *   0  Jump to the leftmost floor cell of the row (hopping any leading walls).
 *   $  Jump to the rightmost floor cell of the row (hopping any trailing walls).
 *
 * If a row has no floor at all (degenerate), leap motions leave the cursor
 * where it is rather than inventing an illegal position.
 */

import type { GameMap, Motion, Pos } from '@/game/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** True when (row,col) is in bounds and an open floor cell. */
function isFloor(map: GameMap, row: number, col: number): boolean {
  if (row < 0 || row >= map.rows || col < 0 || col >= map.cols) return false;
  return map.grid[row][col] === false;
}

/**
 * Build a compact list of floor "corridors" for a single row.
 * Each corridor is [start, end] (inclusive column indices) of contiguous floor.
 */
function floorRuns(grid: boolean[][], row: number, cols: number): [number, number][] {
  const runs: [number, number][] = [];
  let i = 0;
  while (i < cols) {
    if (grid[row][i] === false) {
      const start = i;
      while (i < cols && grid[row][i] === false) i++;
      runs.push([start, i - 1]);
    } else {
      i++;
    }
  }
  return runs;
}

/** The corridor containing `col`, or null if `col` sits on a wall. */
function runContaining(runs: [number, number][], col: number): [number, number] | null {
  for (const run of runs) {
    if (col >= run[0] && col <= run[1]) return run;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Step motions (collide with walls)
// ---------------------------------------------------------------------------

/** Step one cell to `next` if it is open floor; otherwise stay at `pos`. */
function step(map: GameMap, pos: Pos, dRow: number, dCol: number): Pos {
  const row = pos.row + dRow;
  const col = pos.col + dCol;
  return isFloor(map, row, col) ? { row, col } : pos;
}

const moveH = (map: GameMap, pos: Pos): Pos => step(map, pos, 0, -1);
const moveL = (map: GameMap, pos: Pos): Pos => step(map, pos, 0, +1);
const moveJ = (map: GameMap, pos: Pos): Pos => step(map, pos, +1, 0);
const moveK = (map: GameMap, pos: Pos): Pos => step(map, pos, -1, 0);

// ---------------------------------------------------------------------------
// Leap motions (hop over walls, land on floor)
// ---------------------------------------------------------------------------

/** 0 — leftmost floor cell of the row. */
function moveRow0(map: GameMap, pos: Pos): Pos {
  const runs = floorRuns(map.grid, pos.row, map.cols);
  if (runs.length === 0) return pos;
  return { row: pos.row, col: runs[0][0] };
}

/** $ — rightmost floor cell of the row. */
function moveDollar(map: GameMap, pos: Pos): Pos {
  const runs = floorRuns(map.grid, pos.row, map.cols);
  if (runs.length === 0) return pos;
  return { row: pos.row, col: runs[runs.length - 1][1] };
}

/** w — first floor cell of the next corridor to the right (else rightmost floor). */
function moveW(map: GameMap, pos: Pos): Pos {
  const runs = floorRuns(map.grid, pos.row, map.cols);
  if (runs.length === 0) return pos;
  for (const [start] of runs) {
    if (start > pos.col) return { row: pos.row, col: start };
  }
  // No corridor further right — land on rightmost floor cell of the row.
  return { row: pos.row, col: runs[runs.length - 1][1] };
}

/** b — left edge of current corridor, else left edge of the previous one. */
function moveB(map: GameMap, pos: Pos): Pos {
  const runs = floorRuns(map.grid, pos.row, map.cols);
  if (runs.length === 0) return pos;

  // Inside a corridor but not at its left edge → snap to that edge.
  const cur = runContaining(runs, pos.col);
  if (cur && pos.col > cur[0]) return { row: pos.row, col: cur[0] };

  // Otherwise hop to the left edge of the rightmost corridor entirely left of us.
  let best: number | null = null;
  for (const [start, end] of runs) {
    if (end < pos.col) best = start;
  }
  if (best !== null) return { row: pos.row, col: best };

  // Nothing to the left — leftmost floor cell of the row.
  return { row: pos.row, col: runs[0][0] };
}

/** e — right edge of current corridor, else right edge of the next one. */
function moveE(map: GameMap, pos: Pos): Pos {
  const runs = floorRuns(map.grid, pos.row, map.cols);
  if (runs.length === 0) return pos;

  // Inside a corridor but not at its right edge → snap to that edge.
  const cur = runContaining(runs, pos.col);
  if (cur && pos.col < cur[1]) return { row: pos.row, col: cur[1] };

  // Otherwise hop to the right edge of the next corridor to the right.
  for (const [start, end] of runs) {
    if (start > pos.col) return { row: pos.row, col: end };
  }

  // Nothing further right — rightmost floor cell of the row.
  return { row: pos.row, col: runs[runs.length - 1][1] };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Apply a single Vim motion to the cursor, returning the new position.
 * Pure function — does not mutate anything.
 */
export function applyMotion(map: GameMap, pos: Pos, motion: Motion): Pos {
  switch (motion) {
    case 'h':  return moveH(map, pos);
    case 'l':  return moveL(map, pos);
    case 'j':  return moveJ(map, pos);
    case 'k':  return moveK(map, pos);
    case '0':  return moveRow0(map, pos);
    case '$':  return moveDollar(map, pos);
    case 'w':  return moveW(map, pos);
    case 'b':  return moveB(map, pos);
    case 'e':  return moveE(map, pos);
  }
}

/**
 * Return true when the cursor occupies the goal cell.
 */
export function isGoalReached(map: GameMap, pos: Pos): boolean {
  return pos.row === map.goal.row && pos.col === map.goal.col;
}
