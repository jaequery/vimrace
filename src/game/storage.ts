/**
 * Typed localStorage wrapper for VimRace persistence.
 * Availability-safe: never throws if storage is blocked or unavailable.
 */

const HIGH_SCORE_KEY = 'vimrace.highscore';
const STATS_KEY = 'vimrace.stats';
const USERNAME_KEY = 'vimrace.username';

/** Max username length — mirrors the server's MAX_USERNAME_LEN in api/_redis.ts. */
export const MAX_USERNAME_LEN = 16;

export interface StoredStats {
  totalMapsCleared: number;
  totalGamesPlayed: number;
}

/** Cached result of the storage probe — undefined means not yet checked. */
let _storageAvailable: boolean | undefined;

function isStorageAvailable(): boolean {
  if (_storageAvailable !== undefined) return _storageAvailable;
  try {
    const test = '__vimrace_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    _storageAvailable = true;
  } catch {
    _storageAvailable = false;
  }
  return _storageAvailable;
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

/**
 * Normalize a raw username for client-side use: strip control characters,
 * collapse whitespace runs, trim, and cap length. Returns '' if nothing usable
 * remains. Mirrors `normalizeUsername` on the server so the UI can pre-validate.
 */
export function normalizeUsername(raw: string): string {
  return raw
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_USERNAME_LEN);
}

export function getUsername(): string {
  if (!isStorageAvailable()) return '';
  try {
    return normalizeUsername(localStorage.getItem(USERNAME_KEY) ?? '');
  } catch {
    return '';
  }
}

export function setUsername(username: string): void {
  if (!isStorageAvailable()) return;
  try {
    const cleaned = normalizeUsername(username);
    if (cleaned) localStorage.setItem(USERNAME_KEY, cleaned);
  } catch {
    // storage blocked — silently ignore
  }
}
