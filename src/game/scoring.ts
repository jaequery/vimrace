/**
 * scoring.ts — map-clear reward logic for VimRace.
 *
 * Medal thresholds (used / par ratio):
 *   gold   ≤ 1.0  (at or below par)
 *   silver ≤ 1.5  (up to 50 % over par)
 *   bronze ≤ 2.5  (up to 150 % over par)
 *   none   > 2.5  (too many keystrokes)
 *
 * Points formula:
 *   base   = BASE_POINTS_PER_MAP * level
 *   eff    = efficiency bonus: max(0, BASE_POINTS_PER_MAP * (2 - ratio)) * level
 *   speed  = floor(timeLeftMs / 1000) * SPEED_POINTS_PER_SECOND
 *   total  = base + eff + speed   (always ≥ base for any positive used)
 *
 * Bonus-time formula:
 *   bonusTimeMs = BASE_BONUS_MS + max(0, floor((par - used) * BONUS_MS_PER_SAVED_KEYSTROKE))
 *   Capped at MAX_BONUS_MS; mild level scaling reduces the base slightly
 *   for later levels (encourages efficiency at high level).
 *
 * Monotonicity guarantee (tested):
 *   Fewer keystrokes (lower `used`) for the same par/level/timeLeftMs must
 *   never yield fewer points or less bonusTimeMs. This is analytically true
 *   from the formulas but is also tested explicitly.
 */

import type { MapResult, Medal } from '@/game/types';

// ---------------------------------------------------------------------------
// Exported tunable constants
// ---------------------------------------------------------------------------

/** Starting clock duration for a fresh run (ms). */
export const INITIAL_CLOCK_MS = 30_000;

/** Bonus time added for clearing any map (ms) — before efficiency bonus. */
export const BASE_BONUS_MS = 2_500;

/** Additional bonus time per keystroke saved vs. par (ms). */
export const BONUS_MS_PER_SAVED_KEYSTROKE = 400;

/** Maximum total bonus time per map clear (ms). */
export const MAX_BONUS_MS = 15_000;

/** Base points awarded per map, scaled by level. */
export const BASE_POINTS_PER_MAP = 100;

/** Extra points per second of remaining time when clearing a map. */
export const SPEED_POINTS_PER_SECOND = 5;

// ---------------------------------------------------------------------------
// Medal helpers
// ---------------------------------------------------------------------------

function calcMedal(used: number, par: number): Medal {
  if (par <= 0) return 'none';
  const ratio = used / par;
  if (ratio <= 1.0) return 'gold';
  if (ratio <= 1.5) return 'silver';
  if (ratio <= 2.5) return 'bronze';
  return 'none';
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute the reward for clearing a single map.
 *
 * @param par        - near-optimal keystroke count for this map
 * @param used       - actual keystrokes the player used
 * @param timeLeftMs - milliseconds remaining on the countdown clock
 * @param level      - current difficulty level (1-based)
 */
export function mapBonus(args: {
  par: number;
  used: number;
  timeLeftMs: number;
  level: number;
}): MapResult {
  const { par, used, timeLeftMs, level } = args;

  const medal = calcMedal(used, par);

  // --- Bonus time ---
  const savedKeystrokes = Math.max(0, par - used);
  const rawBonus = BASE_BONUS_MS + savedKeystrokes * BONUS_MS_PER_SAVED_KEYSTROKE;
  const bonusTimeMs = Math.min(rawBonus, MAX_BONUS_MS);

  // --- Points ---
  // Base: flat reward for clearing, scaled by level.
  const base = BASE_POINTS_PER_MAP * level;

  // Efficiency: reward beating par; penalty-free if over par (just no bonus).
  // ratio = used/par; efficiency multiplier = max(0, 2 - ratio) so that at
  // par=used the multiplier is 1, at used=0 it's 2, and it floors at 0.
  const ratio = par > 0 ? used / par : 1;
  const effMultiplier = Math.max(0, 2 - ratio);
  const eff = Math.floor(BASE_POINTS_PER_MAP * effMultiplier * level);

  // Speed bonus.
  const speed = Math.floor(Math.max(0, timeLeftMs) / 1000) * SPEED_POINTS_PER_SECOND;

  const points = base + eff + speed;

  return { points, bonusTimeMs, medal, used, par };
}

/**
 * Map the number of maps cleared so far to a 1-based difficulty level.
 *
 * Ramp: every 3 maps cleared increments the level by 1, up to a max of 20.
 *
 * Examples:
 *   0–2  maps cleared → level 1
 *   3–5  maps cleared → level 2
 *   6–8  maps cleared → level 3
 *   …
 *   57+  maps cleared → level 20
 */
export function levelForMapsCleared(mapsCleared: number): number {
  return Math.min(1 + Math.floor(mapsCleared / 3), 20);
}
