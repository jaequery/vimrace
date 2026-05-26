/**
 * Typed localStorage wrapper for VimRace persistence.
 * Availability-safe: never throws if storage is blocked or unavailable.
 */

const HIGH_SCORE_KEY = 'vimrace.highscore';
const STATS_KEY = 'vimrace.stats';

export interface StoredStats {
  totalMapsCleared: number;
  totalGamesPlayed: number;
}

function isStorageAvailable(): boolean {
  try {
    const test = '__vimrace_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

export function getHighScore(): number {
  if (!isStorageAvailable()) return 0;
  try {
    const raw = localStorage.getItem(HIGH_SCORE_KEY);
    if (raw === null) return 0;
    const parsed = parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

export function setHighScore(score: number): void {
  if (!isStorageAvailable()) return;
  try {
    const clamped = Math.max(0, Math.floor(score));
    localStorage.setItem(HIGH_SCORE_KEY, String(clamped));
  } catch {
    // storage blocked — silently ignore
  }
}

export function getStats(): StoredStats {
  if (!isStorageAvailable()) return { totalMapsCleared: 0, totalGamesPlayed: 0 };
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (raw === null) return { totalMapsCleared: 0, totalGamesPlayed: 0 };
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      'totalMapsCleared' in parsed &&
      'totalGamesPlayed' in parsed &&
      typeof (parsed as Record<string, unknown>).totalMapsCleared === 'number' &&
      typeof (parsed as Record<string, unknown>).totalGamesPlayed === 'number'
    ) {
      return {
        totalMapsCleared: Math.max(
          0,
          Math.floor((parsed as StoredStats).totalMapsCleared),
        ),
        totalGamesPlayed: Math.max(
          0,
          Math.floor((parsed as StoredStats).totalGamesPlayed),
        ),
      };
    }
    return { totalMapsCleared: 0, totalGamesPlayed: 0 };
  } catch {
    return { totalMapsCleared: 0, totalGamesPlayed: 0 };
  }
}

export function setStats(stats: StoredStats): void {
  if (!isStorageAvailable()) return;
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch {
    // storage blocked — silently ignore
  }
}
