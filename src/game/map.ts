/**
 * map.ts — deterministic map generation for VimRace.
 *
 * Uses mulberry32 as the seeded PRNG so maps are reproducible given the
 * same seed. Math.random is never called here.
 *
 * Grid model (a maze):
 *   - Rows grow with level starting from MIN_ROWS.
 *   - Cols grow with level starting from MIN_COLS.
 *   - Each row scatters short "wall runs" (contiguous wall cells of length
 *     1–3) over an open floor base, separated by floor gaps of 2–4 cells, so
 *     floor dominates and the maze stays well-connected.
 *   - Start is placed near the top-left, goal near the bottom-right;
 *     both on FLOOR cells; start ≠ goal; minimum Manhattan distance
 *     increases with level.
 *   - Solvability is guaranteed: BFS is run from start; if goal is
 *     unreachable the generator retries with an incremented internal seed
 *     offset until it succeeds, falling back to an all-floor grid.
 *
 * par is computed by BFS over all 9 MOTIONS (state = Pos), counting the
 * minimum number of motions needed to reach goal from start.
 */

import type { GameMap, Pos } from '@/game/types';
import { MOTIONS } from '@/game/types';
import { applyMotion, isGoalReached } from '@/game/vimEngine';

// ---------------------------------------------------------------------------
// PRNG — mulberry32
// ---------------------------------------------------------------------------

/** Returns a mulberry32 PRNG function seeded with `seed`. */
function makePRNG(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / 0x100000000;
  };
}

/** Random integer in [lo, hi] inclusive using the provided PRNG. */
function randInt(rng: () => number, lo: number, hi: number): number {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

// ---------------------------------------------------------------------------
// Grid-size scaling
// ---------------------------------------------------------------------------

const MIN_ROWS = 6;
const MIN_COLS = 14;
const ROW_GROWTH = 1;   // extra rows per 3 levels
const COL_GROWTH = 2;   // extra cols per 3 levels
const MAX_ROWS = 18;
const MAX_COLS = 36;

function gridSize(level: number): { rows: number; cols: number } {
  const steps = Math.floor((level - 1) / 3);
  const rows = Math.min(MIN_ROWS + steps * ROW_GROWTH, MAX_ROWS);
  const cols = Math.min(MIN_COLS + steps * COL_GROWTH, MAX_COLS);
  return { rows, cols };
}

// ---------------------------------------------------------------------------
// Wall-run generation
// ---------------------------------------------------------------------------

/**
 * Scatter short wall runs over an open floor row.
 * `false` = floor (walkable), `true` = wall. Returns a boolean[] of length
 * `cols`. Floor dominates so the maze stays connected; the BFS solvability
 * check in `generateMap` is the ultimate guarantee.
 */
function generateRow(rng: () => number, cols: number): boolean[] {
  const cells: boolean[] = new Array(cols).fill(false); // start fully open
  let col = randInt(rng, 0, 2); // small random leading floor gap

  while (col < cols) {
    const runLen = randInt(rng, 1, 3); // short wall run
    const end = Math.min(col + runLen - 1, cols - 1);
    for (let c = col; c <= end; c++) {
      cells[c] = true;
    }
    col = end + 1 + randInt(rng, 2, 4); // floor gap of 2–4 before next wall
  }
  return cells;
}

// ---------------------------------------------------------------------------
// Floor-cell pool helpers
// ---------------------------------------------------------------------------

function floorCellsInRegion(
  grid: boolean[][],
  rows: number,
  cols: number,
  rowLo: number,
  rowHi: number,
  colLo: number,
  colHi: number,
): Pos[] {
  const out: Pos[] = [];
  for (let r = rowLo; r <= rowHi; r++) {
    for (let c = colLo; c <= colHi; c++) {
      if (r < rows && c < cols && grid[r][c] === false) {
        out.push({ row: r, col: c });
      }
    }
  }
  return out;
}

function pickRandom(rng: () => number, candidates: Pos[]): Pos | null {
  if (candidates.length === 0) return null;
  return candidates[Math.floor(rng() * candidates.length)];
}

// ---------------------------------------------------------------------------
// BFS helpers
// ---------------------------------------------------------------------------

/** Column stride used to pack (row, col) into one integer key. Must exceed any map's column count. */
const POS_KEY_STRIDE = 1024;

function posKey(pos: Pos): number {
  // Pack row/col into a single number for O(1) visited check.
  return pos.row * POS_KEY_STRIDE + pos.col;
}

/**
 * BFS from `start` to `goal` over the 9 MOTIONS.
 * Returns the minimum motion count, or Infinity if unreachable.
 */
export function parKeystrokes(map: GameMap): number {
  // posKey packs col into a fixed stride; guard against silent collisions if
  // map dimensions ever grow past it.
  if (map.cols > POS_KEY_STRIDE) {
    throw new Error(`map.cols (${map.cols}) exceeds POS_KEY_STRIDE (${POS_KEY_STRIDE})`);
  }
  if (isGoalReached(map, map.start)) return 0;

  const visited = new Set<number>();
  // FIFO queue. `shift()` is O(n) but the state space is bounded by the grid
  // (≤ MAX_ROWS × MAX_COLS cells), so this is comfortably fast in practice.
  const queue: [Pos, number][] = [[map.start, 0]];
  visited.add(posKey(map.start));

  while (queue.length > 0) {
    const [pos, depth] = queue.shift()!;
    for (const motion of MOTIONS) {
      const next = applyMotion(map, pos, motion);
      const key = posKey(next);
      if (visited.has(key)) continue;
      visited.add(key);
      if (isGoalReached(map, next)) return depth + 1;
      queue.push([next, depth + 1]);
    }
  }
  return Infinity;
}

// ---------------------------------------------------------------------------
// Map generation
// ---------------------------------------------------------------------------

const MIN_MANHATTAN_BASE = 6;
const MANHATTAN_GROWTH = 3; // extra required distance per 2 levels

function minManhattan(level: number): number {
  return MIN_MANHATTAN_BASE + Math.floor((level - 1) / 2) * MANHATTAN_GROWTH;
}

/**
 * Generate a deterministic GameMap.
 *
 * The generator may internally retry (up to 50 times) with shifted seeds
 * if the random placement doesn't satisfy distance or solvability
 * requirements. The public `seed` recorded on the map is always the
 * caller-supplied seed (or the auto-generated one).
 */
export function generateMap(opts: { level: number; seed?: number }): GameMap {
  const { level } = opts;
  const publicSeed = opts.seed ?? (Date.now() & 0xffffffff);

  const { rows, cols } = gridSize(level);
  const minDist = minManhattan(level);

  for (let attempt = 0; attempt < 50; attempt++) {
    const rng = makePRNG(publicSeed + attempt * 997);

    // Build grid row by row.
    const grid: boolean[][] = [];
    for (let r = 0; r < rows; r++) {
      grid.push(generateRow(rng, cols));
    }

    // Ensure at least one floor cell per row so the cursor can pass through
    // it vertically (a fully walled row would split the maze in two).
    for (let r = 0; r < rows; r++) {
      if (grid[r].every(Boolean)) {
        grid[r][0] = false;
      }
    }

    // Pick start from top-left quadrant (a floor cell).
    const startRowHi = Math.max(0, Math.floor(rows / 3));
    const startColHi = Math.max(0, Math.floor(cols / 3));
    const startCandidates = floorCellsInRegion(grid, rows, cols, 0, startRowHi, 0, startColHi);
    const start = pickRandom(rng, startCandidates);
    if (!start) continue;

    // Pick goal from bottom-right quadrant (a floor cell), min Manhattan
    // distance from start.
    const goalRowLo = Math.min(rows - 1, Math.ceil(rows * 2 / 3));
    const goalColLo = Math.min(cols - 1, Math.ceil(cols * 2 / 3));
    const goalCandidates = floorCellsInRegion(
      grid, rows, cols,
      goalRowLo, rows - 1,
      goalColLo, cols - 1,
    ).filter(
      (p) => Math.abs(p.row - start.row) + Math.abs(p.col - start.col) >= minDist
        && !(p.row === start.row && p.col === start.col),
    );
    const goal = pickRandom(rng, goalCandidates);
    if (!goal) continue;

    // Build a candidate map to run BFS on.
    const candidate: GameMap = { rows, cols, grid, start, goal, level, seed: publicSeed, par: 0 };
    const par = parKeystrokes(candidate);
    if (!isFinite(par) || par === 0) continue;

    return { ...candidate, par };
  }

  // Fallback: construct a guaranteed-solvable minimal map (all cells floor,
  // start at (0,0), goal at far corner). This should almost never trigger.
  const fallbackGrid = Array.from({ length: rows }, () => new Array(cols).fill(false) as boolean[]);
  const fallbackStart: Pos = { row: 0, col: 0 };
  const fallbackGoal: Pos = { row: rows - 1, col: cols - 1 };
  const fallback: GameMap = {
    rows,
    cols,
    grid: fallbackGrid,
    start: fallbackStart,
    goal: fallbackGoal,
    level,
    seed: publicSeed,
    par: 0,
  };
  return { ...fallback, par: parKeystrokes(fallback) };
}
