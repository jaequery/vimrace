/**
 * map.ts — deterministic map generation for VimRace.
 *
 * Uses mulberry32 as the seeded PRNG so maps are reproducible given the
 * same seed. Math.random is never called here.
 *
 * Grid model (a maze):
 *   - Rows grow with level starting from MIN_ROWS.
 *   - Cols grow with level starting from MIN_COLS.
 *   - Each row scatters "wall runs" (contiguous wall cells) over an open floor
 *     base, separated by floor gaps, so floor dominates and the maze stays
 *     well-connected. Wall DENSITY scales with level: early levels are sparse
 *     (short runs, wide gaps), later levels are denser and more maze-like
 *     (longer runs, tighter gaps). This is a difficulty knob independent of par,
 *     since the leap motions hop over walls regardless.
 *   - Start and goal are BOTH placed at random floor cells anywhere on the grid
 *     (start ≠ goal). The goal is chosen from cells at least a level-scaled
 *     FRACTION of the farthest-reachable distance away from start, so it is
 *     meaningfully far (and farther at higher levels) yet lands in varied,
 *     unpredictable positions and directions — never pinned to one fixed corner.
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
// Wall-run generation (density scales with level)
// ---------------------------------------------------------------------------

/**
 * Level at which wall density saturates. Beyond this, mazes don't get any
 * denser — they only keep growing in size (see `gridSize`). Kept local so the
 * generator stays decoupled from `scoring.MAX_LEVEL`.
 */
const DENSITY_SATURATION_LEVEL = 12;

/** Tunable per-row wall parameters: wall-run length and floor-gap ranges. */
interface WallParams {
  /** wall runs are randInt(1, maxRunLen) cells long */
  maxRunLen: number;
  /** floor gap between runs is randInt(minGap, maxGap) cells */
  minGap: number;
  maxGap: number;
}

/**
 * Wall density for a level. `t` ramps 0 → 1 across levels 1..SATURATION:
 * sparse early (short runs, wide gaps) and denser late (longer runs, tighter
 * gaps). Floor still dominates at every level so the maze stays connected; the
 * BFS solvability check in `generateMap` is the ultimate guarantee.
 */
function wallParams(level: number): WallParams {
  const t = Math.min(1, Math.max(0, (level - 1) / (DENSITY_SATURATION_LEVEL - 1)));
  return {
    maxRunLen: Math.round(2 + t * 2), // 2 → 4
    minGap: Math.max(1, Math.round(3 - t * 2)), // 3 → 1
    maxGap: Math.round(5 - t * 2), // 5 → 3
  };
}

/**
 * Scatter wall runs over an open floor row using the level's density params.
 * `false` = floor (walkable), `true` = wall. Returns a boolean[] of length
 * `cols`.
 */
function generateRow(rng: () => number, cols: number, wp: WallParams): boolean[] {
  const cells: boolean[] = new Array(cols).fill(false); // start fully open
  let col = randInt(rng, 0, 2); // small random leading floor gap

  while (col < cols) {
    const runLen = randInt(rng, 1, wp.maxRunLen); // wall run
    const end = Math.min(col + runLen - 1, cols - 1);
    for (let c = col; c <= end; c++) {
      cells[c] = true;
    }
    col = end + 1 + randInt(rng, wp.minGap, wp.maxGap); // floor gap before next wall
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

/**
 * Goal separation as a FRACTION of the farthest Manhattan distance reachable
 * from the (random) start. Ramps from GOAL_SEP_FRAC_BASE at level 1 to
 * GOAL_SEP_FRAC_MAX at DENSITY_SATURATION_LEVEL: the goal must always be a real
 * trek away (and a longer one at higher levels), but because it is a fraction —
 * not the maximum — the goal can land anywhere in a wide band of cells rather
 * than being forced into the single farthest corner. Combined with a random
 * start, this makes goal positions varied and unpredictable across maps.
 */
const GOAL_SEP_FRAC_BASE = 0.4;
const GOAL_SEP_FRAC_MAX = 0.65;

function goalSeparationFrac(level: number): number {
  const t = Math.min(1, Math.max(0, (level - 1) / (DENSITY_SATURATION_LEVEL - 1)));
  return GOAL_SEP_FRAC_BASE + (GOAL_SEP_FRAC_MAX - GOAL_SEP_FRAC_BASE) * t;
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
  const wp = wallParams(level);
  const sepFrac = goalSeparationFrac(level);

  for (let attempt = 0; attempt < 50; attempt++) {
    const rng = makePRNG(publicSeed + attempt * 997);

    // Build grid row by row at this level's wall density.
    const grid: boolean[][] = [];
    for (let r = 0; r < rows; r++) {
      grid.push(generateRow(rng, cols, wp));
    }

    // Ensure at least one floor cell per row so the cursor can pass through
    // it vertically (a fully walled row would split the maze in two).
    for (let r = 0; r < rows; r++) {
      if (grid[r].every(Boolean)) {
        grid[r][0] = false;
      }
    }

    // Pick start from ANY floor cell (no positional bias) so the navigation
    // direction varies map to map.
    const floor = floorCellsInRegion(grid, rows, cols, 0, rows - 1, 0, cols - 1);
    const start = pickRandom(rng, floor);
    if (!start) continue;

    // Pick goal from floor cells at least `sepFrac` of the farthest reachable
    // distance away from start. The far end always qualifies, so candidates are
    // never empty; picking randomly within that band keeps the goal's absolute
    // position varied rather than fixed to one corner.
    const others = floor
      .filter((p) => !(p.row === start.row && p.col === start.col))
      .map((p) => ({ pos: p, dist: Math.abs(p.row - start.row) + Math.abs(p.col - start.col) }));
    if (others.length === 0) continue;
    const maxDist = others.reduce((m, d) => Math.max(m, d.dist), 0);
    const minSep = Math.max(1, Math.round(sepFrac * maxDist));
    const goalCandidates = others.filter((d) => d.dist >= minSep).map((d) => d.pos);
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
