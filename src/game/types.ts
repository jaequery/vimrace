/**
 * VimRace shared contract.
 *
 * This file is the single source of truth for the data shapes that flow
 * between the pure game logic (`vimEngine`, `map`, `scoring`), the React
 * state machine (`useGame`), and the presentational components. Keep it
 * dependency-free so every layer can import it.
 */

/** A position on the grid. `row` 0 = top, `col` 0 = left. */
export interface Pos {
  row: number;
  col: number;
}

/**
 * A VimRace map — a maze.
 *
 * The grid is row-major: `grid[row][col] === true` means the cell is a
 * **wall** (impassable), `false` means open **floor** the cursor can stand on.
 *
 * Step motions (`h`/`j`/`k`/`l`) collide with walls — they refuse to move onto
 * a wall cell. The "leap" motions (`w`/`b`/`e`/`0`/`$`) operate within a single
 * row and are allowed to *jump over* walls, always landing on a floor cell.
 * Leap motions never wrap to another row — see `vimEngine` for the exact,
 * documented semantics.
 */
export interface GameMap {
  rows: number;
  cols: number;
  /** row-major occupancy; `grid[r][c] === true` => wall (impassable) */
  grid: boolean[][];
  /** cursor start — always on a floor cell */
  start: Pos;
  /** goal cell — always on a floor cell, never equal to `start` */
  goal: Pos;
  /** difficulty level this map was generated for (1-based) */
  level: number;
  /** RNG seed used to generate this map (deterministic / testable) */
  seed: number;
  /** near-optimal number of motions from `start` to `goal` (BFS over MOTIONS) */
  par: number;
}

/**
 * The supported Vim motions.
 *
 * `gg`/`G`/`pgup`/`pgdn` are vertical "leap" motions — the column-wise
 * complement to the row-wise leaps `0`/`$`/`w`/`b`/`e`. They hop over walls and
 * land on floor, just along a column instead of a row. (`gg` is keyed as the
 * two-press `g g` sequence; `pgup`/`pgdn` are Vim's half-page `Ctrl-u`/`Ctrl-d`.)
 */
export type Motion =
  | 'h' | 'j' | 'k' | 'l'
  | 'w' | 'b' | 'e' | '0' | '$'
  | 'gg' | 'G' | 'pgup' | 'pgdn';

/** All supported motions, in cheat-sheet display order. */
export const MOTIONS: readonly Motion[] = [
  'h',
  'j',
  'k',
  'l',
  'w',
  'b',
  'e',
  '0',
  '$',
  'gg',
  'G',
  'pgup',
  'pgdn',
] as const;

/**
 * Keycap text for the on-screen cheat-sheet. Most motions render as their own
 * id, but the PageUp/PageDown keys need friendlier labels.
 */
export const MOTION_KEYCAP: Record<Motion, string> = {
  h: 'h',
  j: 'j',
  k: 'k',
  l: 'l',
  w: 'w',
  b: 'b',
  e: 'e',
  '0': '0',
  $: '$',
  gg: 'gg',
  G: 'G',
  pgup: 'C-u',
  pgdn: 'C-d',
};

/**
 * Short, human-readable description of each motion for the on-screen
 * cheat-sheet. MUST stay in sync with the behavior implemented in
 * `vimEngine.applyMotion` — if the engine's edge semantics change, update
 * the copy here so the cheat-sheet never lies to the player.
 *
 * h/j/k/l step one cell and are blocked by walls. w/b/e/0/$ leap over walls
 * (always within the current row) and land on open floor.
 *
 * Labels use Vim's "word" vocabulary (w/b/e = next/prev word, word end) while
 * the engine docs in `vimEngine.ts` describe the same behavior with the
 * "corridor" maze analog — the split is deliberate (player mnemonic vs. engine
 * mechanic), not drift: a floor corridor is the word, a wall-gap the whitespace.
 */
export const MOTION_HELP: Record<Motion, string> = {
  h: 'left',
  j: 'down',
  k: 'up',
  l: 'right',
  w: 'next word',
  b: 'prev word',
  e: 'word end',
  '0': 'row start',
  $: 'row end',
  gg: 'hop to top',
  G: 'hop to bottom',
  pgup: 'half page up',
  pgdn: 'half page dn',
};

export type Medal = 'gold' | 'silver' | 'bronze' | 'none';

/**
 * Result of clearing one level (produced by `scoring.levelScore`).
 *
 * A level is a fixed sequence of mazes raced against a count-up clock; `timeMs`
 * is the elapsed time the per-level leaderboard ranks by, `points` the score
 * accumulated across the run.
 */
export interface LevelResult {
  /** the level that was cleared (1-based) */
  level: number;
  /** elapsed time to clear the level (ms) — the leaderboard metric */
  timeMs: number;
  /** the level's time limit (ms) */
  limitMs: number;
  /** total keystrokes the player used across the level's mazes */
  used: number;
  /** total par (near-optimal) keystrokes across the level's mazes */
  par: number;
  /** medal earned from keystroke efficiency vs. par */
  medal: Medal;
  /** score awarded for clearing this level */
  points: number;
}

/**
 * High-level phase of a play session.
 *   idle          — start screen
 *   playing       — racing a level, clock counting up
 *   levelcomplete — cleared a level under its limit
 *   gameover      — ran out of time on a level
 */
export type GameStatus = 'idle' | 'playing' | 'levelcomplete' | 'gameover';
