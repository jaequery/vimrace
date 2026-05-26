/**
 * vimEngine.ts — pure Vim-motion logic for VimRace.
 *
 * Word-motion model (each row is an independent line of text):
 *   - Filled cells  (grid[r][c] === true)  → word characters
 *   - Blank cells   (grid[r][c] === false) → spaces / separators
 *   A "word" is a maximal contiguous run of filled cells within a row.
 *
 * All motions are clamped to grid bounds; none wrap to another row.
 *
 * Edge-case decisions (documented here so MOTION_HELP can stay honest):
 *   w  On the last word of a row (no next word exists), lands on the LAST cell
 *      of the row (rightmost col). If the cursor is already at col (cols-1),
 *      it stays there.
 *   b  Moves to the first cell of the word the cursor is on, or — if the
 *      cursor sits on a blank — the first cell of the word immediately to the
 *      left. If no such word exists (cursor at or before the first word start),
 *      lands on col 0.
 *   e  Moves to the last cell of the word the cursor is on (if not already at
 *      its end), or the last cell of the NEXT word. If no such word exists,
 *      lands on the LAST cell of the row.
 */

import type { GameMap, Motion, Pos } from '@/game/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Clamp n to [lo, hi]. */
function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Build a compact list of word-spans for a single row.
 * Each span is [start, end] (inclusive column indices).
 */
function rowSpans(grid: boolean[][], row: number, cols: number): [number, number][] {
  const spans: [number, number][] = [];
  let i = 0;
  while (i < cols) {
    if (grid[row][i]) {
      const start = i;
      while (i < cols && grid[row][i]) i++;
      spans.push([start, i - 1]);
    } else {
      i++;
    }
  }
  return spans;
}

// ---------------------------------------------------------------------------
// Motion implementations
// ---------------------------------------------------------------------------

function moveH(map: GameMap, pos: Pos): Pos {
  return { row: pos.row, col: clamp(pos.col - 1, 0, map.cols - 1) };
}

function moveL(map: GameMap, pos: Pos): Pos {
  return { row: pos.row, col: clamp(pos.col + 1, 0, map.cols - 1) };
}

function moveJ(map: GameMap, pos: Pos): Pos {
  return { row: clamp(pos.row + 1, 0, map.rows - 1), col: pos.col };
}

function moveK(map: GameMap, pos: Pos): Pos {
  return { row: clamp(pos.row - 1, 0, map.rows - 1), col: pos.col };
}

function moveRow0(_map: GameMap, pos: Pos): Pos {
  return { row: pos.row, col: 0 };
}

function moveDollar(map: GameMap, pos: Pos): Pos {
  return { row: pos.row, col: map.cols - 1 };
}

/**
 * w — move to the first cell of the NEXT word to the right on this row.
 *
 * Algorithm:
 *  1. Find all word spans in the current row.
 *  2. Find the first span whose START is strictly > current col.
 *  3. If found, land on that span's start.
 *  4. If not found (no next word exists), land on the last cell of the row.
 */
function moveW(map: GameMap, pos: Pos): Pos {
  const spans = rowSpans(map.grid, pos.row, map.cols);
  for (const [start] of spans) {
    if (start > pos.col) {
      return { row: pos.row, col: start };
    }
  }
  // No next word — land on last cell of row.
  return { row: pos.row, col: map.cols - 1 };
}

/**
 * b — move to the first cell of the word at/left of the cursor on this row.
 *
 * Algorithm:
 *  1. Find all word spans.
 *  2. If cursor is INSIDE a span (start ≤ col ≤ end) AND col > start,
 *     land on that span's start (moves within the current word).
 *  3. Otherwise find the rightmost span whose END is < current col, land on
 *     its start.
 *  4. If no such span exists, land on col 0.
 */
function moveB(map: GameMap, pos: Pos): Pos {
  const spans = rowSpans(map.grid, pos.row, map.cols);

  // Check if cursor is inside a span and not already at its start.
  for (const [start, end] of spans) {
    if (pos.col >= start && pos.col <= end && pos.col > start) {
      return { row: pos.row, col: start };
    }
  }

  // Find the rightmost span ending strictly before the current col.
  let best: number | null = null;
  for (const [start, end] of spans) {
    if (end < pos.col) {
      best = start;
    }
  }
  if (best !== null) {
    return { row: pos.row, col: best };
  }

  // Nothing found — land at col 0.
  return { row: pos.row, col: 0 };
}

/**
 * e — move to the last cell of the next word (or current word if not at end).
 *
 * Algorithm:
 *  1. Find all word spans.
 *  2. If cursor is INSIDE a span and col < end, land on that span's end.
 *  3. Otherwise find the first span whose START is > current col, land on
 *     its end.
 *  4. If no such span, land on the last cell of the row.
 */
function moveE(map: GameMap, pos: Pos): Pos {
  const spans = rowSpans(map.grid, pos.row, map.cols);

  // If cursor is on a word and not yet at that word's end, land on that end.
  for (const [start, end] of spans) {
    if (pos.col >= start && pos.col <= end && pos.col < end) {
      return { row: pos.row, col: end };
    }
  }

  // Find the first span starting strictly after the current col.
  for (const [start, end] of spans) {
    if (start > pos.col) {
      return { row: pos.row, col: end };
    }
  }

  // No next word — land on the last cell of the row.
  return { row: pos.row, col: map.cols - 1 };
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
