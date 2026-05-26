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
 * A VimRace map.
 *
 * The grid is row-major: `grid[row][col] === true` means the cell is a
 * "filled" glyph (part of a word), `false` means blank floor.
 *
 * For word motions, **each row is treated as an independent line of text**
 * where filled cells are word-characters and blank cells are spaces. Word
 * motions (`w`/`b`/`e`) never wrap to another row — see `vimEngine` for the
 * exact, documented semantics.
 */
export interface GameMap {
  rows: number;
  cols: number;
  /** row-major occupancy; `grid[r][c] === true` => filled glyph */
  grid: boolean[][];
  /** cursor start — always on a filled cell */
  start: Pos;
  /** goal cell — always on a filled cell, never equal to `start` */
  goal: Pos;
  /** difficulty level this map was generated for (1-based) */
  level: number;
  /** RNG seed used to generate this map (deterministic / testable) */
  seed: number;
  /** near-optimal number of motions from `start` to `goal` (BFS over MOTIONS) */
  par: number;
}

/** The supported Vim motions. */
export type Motion = 'h' | 'j' | 'k' | 'l' | 'w' | 'b' | 'e' | '0' | '$';

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
] as const;

/**
 * Short, human-readable description of each motion for the on-screen
 * cheat-sheet. MUST stay in sync with the behavior implemented in
 * `vimEngine.applyMotion` — if the engine's edge semantics change, update
 * the copy here so the cheat-sheet never lies to the player.
 */
export const MOTION_HELP: Record<Motion, string> = {
  h: 'left',
  j: 'down',
  k: 'up',
  l: 'right',
  w: 'next word',
  b: 'word back',
  e: 'word end',
  '0': 'row start',
  $: 'row end',
};

export type Medal = 'gold' | 'silver' | 'bronze' | 'none';

/** Result of clearing a single map (produced by `scoring.mapBonus`). */
export interface MapResult {
  /** points awarded for clearing this map */
  points: number;
  /** bonus time (ms) added to the countdown clock for clearing this map */
  bonusTimeMs: number;
  /** medal earned from keystroke efficiency vs. par */
  medal: Medal;
  /** keystrokes the player actually used on this map */
  used: number;
  /** par (near-optimal) keystroke count for this map */
  par: number;
}

/** High-level phase of a play session. */
export type GameStatus = 'idle' | 'playing' | 'gameover';
