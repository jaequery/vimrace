/**
 * scoring.ts — discrete-level, time-based reward logic for VimRace.
 *
 * The game is a speedrun: each level is a fixed sequence of MAPS_PER_LEVEL mazes
 * (deterministic seeds, so every player races the *same* layout). A clock counts
 * UP from 0; clearing the level locks in your elapsed time. The per-level
 * leaderboard ranks by that time, fastest first.
 *
 * Two metrics come out of a level clear:
 *   - timeMs  — elapsed time, the thing the per-level leaderboard ranks by.
 *   - points  — a score, accumulated across the run and tracked as a high score.
 *
 * Difficulty ramp ("harder = shorter time"):
 *   Every level carries a *time limit*. Exceed it before finishing and the run
 *   ends. The limit is a per-optimal-keystroke time budget that shrinks as the
 *   level rises, multiplied by the level's total par. Because the budget is
 *   par-relative it can never become un-winnable, yet the pressure tightens
 *   level over level.
 *
 * Medal thresholds (total used / total par across the level):
 *   gold   ≤ 1.0  (at or below par)
 *   silver ≤ 1.5  (up to 50 % over par)
 *   bronze ≤ 2.5  (up to 150 % over par)
 *   none   > 2.5  (too many keystrokes)
 */

import type { LevelResult, Medal } from '@/game/types';

// ---------------------------------------------------------------------------
// Structural constants
// ---------------------------------------------------------------------------

/** Maximum difficulty level. */
export const MAX_LEVEL = 20;

/** Number of mazes a player must clear, in order, to finish one level. */
export const MAPS_PER_LEVEL = 3;

// ---------------------------------------------------------------------------
// Time-limit tuning
// ---------------------------------------------------------------------------

/**
 * The limit follows a smooth, level-based schedule: generous at level 1 (room
 * to learn) and tight at the final level (a real speedrun). We deliberately do
 * NOT scale the limit by par — Vim *leaps* keep the optimal par tiny (single
 * digits) even on big mazes, so par is a poor proxy for how long a level takes.
 */

/** Time limit (ms) at level 1 — comfortable while you learn the motions. */
export const LEVEL_START_LIMIT_MS = 45_000;

/** Time limit (ms) at MAX_LEVEL — tight; bigger mazes, less time = harder. */
export const LEVEL_END_LIMIT_MS = 18_000;

/**
 * Safety floor (ms) per optimal keystroke. If an unusually long optimal path
 * ever needs more than the scheduled time, the limit is bumped up to keep the
 * level winnable. In practice par stays small, so the schedule dominates.
 */
export const SAFETY_MS_PER_KEYSTROKE = 900;

/** Absolute clamps on a level's limit. */
export const MIN_LEVEL_LIMIT_MS = 12_000;
export const MAX_LEVEL_LIMIT_MS = 90_000;

// ---------------------------------------------------------------------------
// Score tuning
// ---------------------------------------------------------------------------

/** Base points awarded for clearing a level, scaled by level. */
export const BASE_POINTS_PER_LEVEL = 100;

/** Extra points per whole second of time left under the limit, scaled by level. */
export const SPEED_POINTS_PER_SECOND = 5;

// ---------------------------------------------------------------------------
// Deterministic seeds — every player races the same maze for a given level/slot
// ---------------------------------------------------------------------------

/**
 * Deterministic seed for the `index`-th maze of a level. Fixed per (level,
 * index) pair so the layout is identical for everyone — a hard requirement for
 * comparing completion times across players.
 */
export function seedForLevelMap(level: number, index: number): number {
  // Mix level and index into a well-spread 32-bit seed.
  return (((level * 73_856_093) ^ ((index + 1) * 19_349_663)) >>> 0) || 1;
}

// ---------------------------------------------------------------------------
// Time limit
// ---------------------------------------------------------------------------

/**
 * The scheduled limit (ms) for a level: a smooth linear ramp from
 * LEVEL_START_LIMIT_MS at level 1 down to LEVEL_END_LIMIT_MS at MAX_LEVEL.
 * Monotonically non-increasing — every level is at least as tight as the last.
 */
export function scheduledLimitMs(level: number): number {
  if (MAX_LEVEL <= 1) return LEVEL_START_LIMIT_MS;
  const clamped = Math.min(MAX_LEVEL, Math.max(1, level));
  const t = (clamped - 1) / (MAX_LEVEL - 1);
  return Math.round(LEVEL_START_LIMIT_MS + (LEVEL_END_LIMIT_MS - LEVEL_START_LIMIT_MS) * t);
}

/**
 * Time limit (ms) for a level. Exceeding it before clearing the level ends the
 * run. Follows the level schedule, bumped up only if an unusually long optimal
 * path would otherwise make the level unwinnable, then clamped to a sane window.
 */
export function levelLimitMs(level: number, parTotal: number): number {
  const scheduled = scheduledLimitMs(level);
  const safety = Math.max(0, parTotal) * SAFETY_MS_PER_KEYSTROKE;
  return Math.min(MAX_LEVEL_LIMIT_MS, Math.max(MIN_LEVEL_LIMIT_MS, scheduled, safety));
}

// ---------------------------------------------------------------------------
// Medals
// ---------------------------------------------------------------------------

export function medalForLevel(used: number, par: number): Medal {
  if (par <= 0) return 'none';
  const ratio = used / par;
  if (ratio <= 1.0) return 'gold';
  if (ratio <= 1.5) return 'silver';
  if (ratio <= 2.5) return 'bronze';
  return 'none';
}

// ---------------------------------------------------------------------------
// Score
// ---------------------------------------------------------------------------

/**
 * Compute the result of clearing a level.
 *
 * @param level    - 1-based difficulty level just cleared
 * @param used     - total keystrokes across the level's mazes
 * @param par      - total near-optimal keystrokes across the level's mazes
 * @param timeMs   - elapsed time to clear the level (the leaderboard metric)
 * @param limitMs  - the level's time limit (for the speed bonus)
 */
export function levelScore(args: {
  level: number;
  used: number;
  par: number;
  timeMs: number;
  limitMs: number;
}): LevelResult {
  const { level, used, par, timeMs, limitMs } = args;

  const medal = medalForLevel(used, par);

  // Base: flat reward for clearing, scaled by level.
  const base = BASE_POINTS_PER_LEVEL * level;

  // Efficiency: reward beating par; no penalty past par, just no bonus.
  // multiplier = max(0, 2 - used/par): 1 at par, 2 at zero keystrokes, floors at 0.
  const ratio = par > 0 ? used / par : 1;
  const eff = Math.floor(BASE_POINTS_PER_LEVEL * Math.max(0, 2 - ratio) * level);

  // Speed: reward time left under the limit, scaled by level.
  const secondsLeft = Math.floor(Math.max(0, limitMs - timeMs) / 1000);
  const speed = secondsLeft * SPEED_POINTS_PER_SECOND * level;

  const points = base + eff + speed;

  return { level, timeMs, limitMs, used, par, medal, points };
}
