/**
 * format.ts — shared display formatting for VimRace.
 */

/**
 * Format a duration in milliseconds as a speedrun clock.
 *
 *   <  1 min → `S.cc`        e.g.  9.07,  42.50
 *   ≥  1 min → `M:SS.cc`     e.g.  1:03.42
 *
 * `cc` is centiseconds (hundredths), always two digits. Negative inputs clamp
 * to 0. Used everywhere a time is shown so the HUD, result screens, and
 * leaderboard read identically.
 */
export function formatTimeMs(ms: number): string {
  const total = Math.max(0, Math.round(ms));
  const cs = Math.floor((total % 1000) / 10);
  const totalSeconds = Math.floor(total / 1000);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60);
  const cc = String(cs).padStart(2, '0');
  if (minutes > 0) {
    return `${minutes}:${String(seconds).padStart(2, '0')}.${cc}`;
  }
  return `${seconds}.${cc}`;
}
